import asyncio
import json
import logging
from datetime import UTC, datetime

from anthropic import APIError, AsyncAnthropic, AuthenticationError, BadRequestError
from pydantic import ValidationError

from ..prompts import cached_prompt_with_reference_date
from ..schemas import TailoringResult

_MAX_PROVIDER_ATTEMPTS = 3
_MAX_RESULT_ATTEMPTS = 2
_RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504, 529})
_RETRY_BASE_DELAY_SECONDS = 0.75
_OPTIONAL_METADATA_FIELDS = frozenset({"matched_keywords", "review_items", "truth_statement", "changes"})
logger = logging.getLogger(__name__)


class InvalidTailoringResultError(ValueError):
    """A privacy-safe description of a model response that missed our contract."""

    def __init__(self, reason: str, fields: tuple[str, ...] = ()) -> None:
        super().__init__("The model returned an invalid tailoring result.")
        self.reason = reason
        self.fields = fields


def strict_json_schema(value: object) -> object:
    """Return an Anthropic-compatible schema with every object closed."""
    if isinstance(value, dict):
        strict = {key: strict_json_schema(child) for key, child in value.items()}
        if strict.get("type") == "object":
            strict["additionalProperties"] = False
        return strict
    if isinstance(value, list):
        return [strict_json_schema(child) for child in value]
    return value


def parse_tailoring_payload(payload: str) -> TailoringResult:
    """Extract the required JSON object without retaining model response text."""
    decoder = json.JSONDecoder()
    saw_malformed_json = False
    validation_fields: set[str] = set()
    for start in (index for index, character in enumerate(payload) if character == "{"):
        try:
            parsed, _ = decoder.raw_decode(payload[start:])
        except json.JSONDecodeError:
            saw_malformed_json = True
            continue
        if isinstance(parsed, dict):
            _remove_null_optional_metadata(parsed)
        try:
            return TailoringResult.model_validate(parsed)
        except ValidationError as error:
            fields = {_validation_field(item) for item in error.errors()}
            if _discard_invalid_optional_metadata(parsed, fields):
                try:
                    return TailoringResult.model_validate(parsed)
                except ValidationError as retry_error:
                    fields = {_validation_field(item) for item in retry_error.errors()}
            validation_fields.update(fields)
            continue
    if validation_fields:
        raise InvalidTailoringResultError("schema_validation", tuple(sorted(validation_fields))[:8])
    if saw_malformed_json:
        raise InvalidTailoringResultError("malformed_json")
    raise InvalidTailoringResultError("no_json_object")


def _remove_null_optional_metadata(payload: dict[str, object]) -> None:
    """Let the schema defaults handle null supplemental UI metadata.

    The resume itself and all factual content remain subject to normal validation.
    """
    for field in ("matched_keywords", "review_items", "truth_statement", "changes"):
        if payload.get(field) is None:
            payload.pop(field, None)


def _discard_invalid_optional_metadata(payload: object, fields: set[str]) -> bool:
    """Discard only invalid non-document metadata, retaining strict resume validation."""
    if not isinstance(payload, dict) or not fields:
        return False
    roots = {field.split(".", 1)[0] for field in fields}
    if not roots <= _OPTIONAL_METADATA_FIELDS:
        return False
    for field in roots:
        payload.pop(field, None)
    return True


def _validation_field(error: dict[str, object]) -> str:
    """Keep only schema field paths; never emit invalid values or model content."""
    location = error.get("loc", ())
    if not isinstance(location, tuple):
        return "unknown"
    return ".".join("*" if isinstance(part, int) else str(part) for part in location) or "root"


class AnthropicProvider:
    def __init__(self, model: str = "claude-haiku-4-5", *, max_tokens: int = 4_096, effort: str = "medium") -> None:
        self._model = model
        self._max_tokens = max_tokens
        self._effort = effort

    async def tailor(self, *, api_key: str, resume_text: str, job_description: str, evidence_text: str = "") -> TailoringResult:
        return await self._generate(
            api_key=api_key,
            system=cached_prompt_with_reference_date(self._reference_date()),
            user_content=f"ORIGINAL_RESUME:\n{resume_text}\n\nCANDIDATE-ATTESTED_EXTERNAL_EVIDENCE:\n{evidence_text or 'None supplied.'}\n\nJOB_DESCRIPTION:\n{job_description}",
            max_resume_length=max(12_000, len(resume_text) * 2),
        )

    async def repair(self, *, api_key: str, resume_text: str, job_description: str, rejected_draft: str) -> TailoringResult:
        return await self._generate(
            api_key=api_key,
            system=[
                *cached_prompt_with_reference_date(self._reference_date()),
                {"type": "text", "text": "# REQUIRED CORRECTION\nThe prior draft was rejected because it introduced an unsupported claim. Rewrite it now. Remove or replace every unsupported number, metric, date, tool, employer, title, credential, or named claim. Do not mention this correction. Return only the required JSON object."},
            ],
            user_content=f"ORIGINAL_RESUME:\n{resume_text}\n\nJOB_DESCRIPTION:\n{job_description}\n\nREJECTED_DRAFT_TO_CORRECT:\n{rejected_draft}",
            max_resume_length=max(12_000, len(resume_text) * 2),
        )

    @staticmethod
    def _reference_date() -> str:
        return datetime.now(UTC).date().isoformat()

    async def _generate(self, *, api_key: str, system: list[dict[str, object]], user_content: str, max_resume_length: int) -> TailoringResult:
        # Own the retry policy here so one tailoring operation has a predictable
        # upper bound. The SDK's automatic retries are disabled to avoid stacking
        # separate retry policies.
        client = AsyncAnthropic(api_key=api_key, max_retries=0)
        request = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user_content}],
        }
        output_config = self._output_config()
        for result_attempt in range(_MAX_RESULT_ATTEMPTS):
            try:
                response = await self._create_with_retries(client, request, output_config)
            except BadRequestError:
                # Structured outputs are not enabled for every compatible account/model.
                # Prompt-only JSON remains validated locally before it can reach users.
                response = await self._create_with_retries(client, request)
            except AuthenticationError as error:
                raise ValueError("Anthropic rejected the API key. Check the key and try again.") from error
            except APIError as error:
                raise ValueError("Claude could not complete the request. Try again in a moment.") from error
            if response.stop_reason == "refusal":
                raise ValueError("Claude declined this tailoring request.")
            content_types = tuple(str(getattr(part, "type", "unknown")) for part in response.content)
            payload = "".join(str(getattr(part, "text", "")) for part in response.content if getattr(part, "type", None) == "text")
            try:
                result = parse_tailoring_payload(payload)
                if len(result.tailored_resume) > max_resume_length:
                    raise InvalidTailoringResultError("tailored_resume_too_long", ("tailored_resume",))
                return result
            except InvalidTailoringResultError as error:
                logger.warning(
                    "Anthropic tailoring result failed validation: model=%s result_attempt=%d stop_reason=%s content_types=%s text_characters=%d diagnostic=%s fields=%s",
                    self._model,
                    result_attempt + 1,
                    getattr(response, "stop_reason", "unknown"),
                    content_types,
                    len(payload),
                    error.reason,
                    error.fields,
                )
                if result_attempt == _MAX_RESULT_ATTEMPTS - 1:
                    raise
        raise RuntimeError("Model result retry loop exited unexpectedly.")

    @staticmethod
    async def _create_with_retries(
        client: AsyncAnthropic,
        request: dict[str, object],
        output_config: dict[str, object] | None = None,
    ) -> object:
        """Retry only temporary provider/network failures, never credentials or input errors."""
        for attempt in range(_MAX_PROVIDER_ATTEMPTS):
            try:
                if output_config is None:
                    return await client.messages.create(**request)
                return await client.messages.create(**request, output_config=output_config)
            except APIError as error:
                status_code = getattr(error, "status_code", None)
                transient = status_code is None or status_code in _RETRYABLE_STATUS_CODES
                if not transient or attempt == _MAX_PROVIDER_ATTEMPTS - 1:
                    raise
                await asyncio.sleep(_RETRY_BASE_DELAY_SECONDS * (2**attempt))
        raise RuntimeError("Provider retry loop exited unexpectedly.")

    def _output_config(self) -> dict[str, object]:
        """Use Sonnet 5's effort control without attempting unsupported schema output."""
        if self._model.startswith("claude-sonnet-5"):
            return {"effort": self._effort}
        schema = strict_json_schema(TailoringResult.model_json_schema())
        assert isinstance(schema, dict)
        return {"format": {"type": "json_schema", "schema": schema}}

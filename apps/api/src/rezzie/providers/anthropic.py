import json
from datetime import UTC, datetime

from anthropic import APIError, AsyncAnthropic, AuthenticationError, BadRequestError
from pydantic import ValidationError

from ..prompts import prompt_with_reference_date
from ..schemas import TailoringResult


def parse_tailoring_payload(payload: str) -> TailoringResult:
    """Extract the required JSON object without retaining model response text."""
    decoder = json.JSONDecoder()
    for start in (index for index, character in enumerate(payload) if character == "{"):
        try:
            parsed, _ = decoder.raw_decode(payload[start:])
        except json.JSONDecodeError:
            continue
        try:
            return TailoringResult.model_validate(parsed)
        except ValidationError:
            continue
    raise ValueError("The model returned an invalid tailoring result.")


class AnthropicProvider:
    def __init__(self, model: str = "claude-haiku-4-5") -> None:
        self._model = model

    async def tailor(self, *, api_key: str, resume_text: str, job_description: str, evidence_text: str = "") -> TailoringResult:
        return await self._generate(
            api_key=api_key,
            system=prompt_with_reference_date(self._reference_date()),
            user_content=f"ORIGINAL_RESUME:\n{resume_text}\n\nCANDIDATE-ATTESTED_EXTERNAL_EVIDENCE:\n{evidence_text or 'None supplied.'}\n\nJOB_DESCRIPTION:\n{job_description}",
        )

    async def repair(self, *, api_key: str, resume_text: str, job_description: str, rejected_draft: str) -> TailoringResult:
        return await self._generate(
            api_key=api_key,
            system=f"{prompt_with_reference_date(self._reference_date())}\n\n# REQUIRED CORRECTION\nThe prior draft was rejected because it introduced an unsupported claim. Rewrite it now. Remove or replace every unsupported number, metric, date, tool, employer, title, credential, or named claim. Do not mention this correction. Return only the required JSON object.",
            user_content=f"ORIGINAL_RESUME:\n{resume_text}\n\nJOB_DESCRIPTION:\n{job_description}\n\nREJECTED_DRAFT_TO_CORRECT:\n{rejected_draft}",
        )

    @staticmethod
    def _reference_date() -> str:
        return datetime.now(UTC).date().isoformat()

    async def _generate(self, *, api_key: str, system: str, user_content: str) -> TailoringResult:
        client = AsyncAnthropic(api_key=api_key)
        request = {
            "model": self._model,
            "max_tokens": 8192,
            "system": system,
            "messages": [{"role": "user", "content": user_content}],
        }
        try:
            response = await client.messages.create(**request, output_config={"format": {"type": "json_schema", "schema": TailoringResult.model_json_schema()}})
        except BadRequestError:
            # Structured outputs are not enabled for every compatible account/model.
            # Prompt-only JSON remains validated locally before it can reach users.
            response = await client.messages.create(**request)
        except AuthenticationError as error:
            raise ValueError("Anthropic rejected the API key. Check the key and try again.") from error
        except APIError as error:
            raise ValueError("Claude could not complete the request. Try again in a moment.") from error
        if response.stop_reason == "refusal":
            raise ValueError("Claude declined this tailoring request.")
        payload = "".join(part.text for part in response.content if part.type == "text")
        return parse_tailoring_payload(payload)

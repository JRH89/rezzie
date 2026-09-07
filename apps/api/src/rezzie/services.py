import httpx
from fastapi import HTTPException

from .billing import BillingRepository
from .config import Settings
from .grounding import assert_grounded, remove_unsupported_quantitative_lines
from .providers.base import LLMProvider
from .schemas import ImportResponse, TailoringChange, TailoringResult, TailorRequest
from .security import assert_safe_public_url, require_generation_key
from .trusted_sources import ExternalSource


class JobDescriptionImporter:
    _MAX_REDIRECTS = 5

    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._settings = settings
        self._transport = transport

    async def from_url(self, url: str) -> ImportResponse:
        current_url = url
        async with httpx.AsyncClient(follow_redirects=False, timeout=8.0, transport=self._transport) as client:
            for redirects_followed in range(self._MAX_REDIRECTS + 1):
                assert_safe_public_url(current_url)
                try:
                    response = await client.get(current_url, headers={"User-Agent": "RezzieJobImporter/1.0"})
                except httpx.HTTPError as error:
                    raise HTTPException(status_code=422, detail="Unable to retrieve that job-description URL.") from error

                if response.is_redirect:
                    if redirects_followed == self._MAX_REDIRECTS:
                        raise HTTPException(status_code=422, detail="The job-description URL redirected too many times.")
                    location = response.headers.get("location")
                    if not location:
                        raise HTTPException(status_code=422, detail="The job-description URL returned an invalid redirect.")
                    current_url = str(response.url.join(location))
                    continue

                try:
                    response.raise_for_status()
                except httpx.HTTPError as error:
                    raise HTTPException(status_code=422, detail="Unable to retrieve that job-description URL.") from error
                break
            else:  # pragma: no cover - the loop always exits or raises.
                raise HTTPException(status_code=422, detail="The job-description URL redirected too many times.")
        if "text/html" not in response.headers.get("content-type", ""):
            raise HTTPException(status_code=422, detail="The URL must return an HTML page.")
        text = " ".join(response.text.replace("<", " <").split())
        if len(text) < 50:
            raise HTTPException(status_code=422, detail="No usable job-description text was found.")
        return ImportResponse(text=text[:100_000], source_type="url", source_url=current_url)


class TailoringService:
    def __init__(self, provider: LLMProvider, settings: Settings, billing: BillingRepository) -> None:
        self._provider, self._settings, self._billing = provider, settings, billing

    async def tailor(self, request: TailorRequest, user_id: str | None = None, external_sources: list[ExternalSource] | None = None) -> TailoringResult:
        api_key = require_generation_key(request.credential_mode, request.api_key, self._settings.anthropic_api_key)
        credit_sources: list[str] = []
        external_sources = external_sources or []
        if request.credential_mode.value == "subscription":
            if not user_id: raise HTTPException(status_code=401, detail="Authentication is required for subscription usage.")
            credit_sources = self._billing.consume_credits(user_id, 2 if external_sources else 1)
        elif external_sources:
            raise HTTPException(status_code=403, detail="Trusted Sources require subscription tailoring.")
        try:
            evidence_text = "\n\n".join(f"SOURCE: {source.url}\n{source.extracted_text}" for source in external_sources)
            provider_args = {"api_key": api_key, "resume_text": request.resume_text, "job_description": request.job_description}
            if evidence_text:
                provider_args["evidence_text"] = evidence_text
            result = await self._provider.tailor(**provider_args)
            try:
                assert_grounded(f"{request.resume_text}\n{evidence_text}", result.tailored_resume)
            except HTTPException as error:
                if error.status_code != 422:
                    raise
                result = await self._provider.repair(api_key=api_key, resume_text=request.resume_text, job_description=request.job_description, rejected_draft=result.tailored_resume)
                try:
                    assert_grounded(f"{request.resume_text}\n{evidence_text}", result.tailored_resume)
                except HTTPException as repair_error:
                    if repair_error.status_code != 422:
                        raise
                    sanitized = remove_unsupported_quantitative_lines(request.resume_text, result.tailored_resume)
                    if len(sanitized) < 50:
                        sanitized = request.resume_text
                    try:
                        assert_grounded(request.resume_text, sanitized)
                    except HTTPException:
                        sanitized = request.resume_text
                    result = result.model_copy(update={"tailored_resume": sanitized, "review_items": [*result.review_items, "VERIFY: Rezzie removed generated content that could not be grounded in the supplied resume."][:20], "truth_statement": "This draft preserves only claims grounded in the supplied resume; generated unsupported content was removed for review."})
            return result.model_copy(update={"changes": self._changes(request.resume_text, result.tailored_resume, external_sources)})
        except Exception:
            for credit_source in credit_sources:
                self._billing.refund_credit(user_id or "", credit_source)
            raise

    @staticmethod
    def _changes(resume_text: str, tailored_resume: str, sources: list[ExternalSource]) -> list[TailoringChange]:
        original_lines = {line.strip().casefold() for line in resume_text.splitlines() if line.strip()}
        source_tokens = [(source.url, {token.casefold() for token in source.extracted_text.split() if len(token) > 4}) for source in sources]
        changes: list[TailoringChange] = []
        for line in tailored_resume.splitlines():
            normalized = line.strip()
            if len(normalized) < 12 or normalized.casefold() in original_lines:
                continue
            words = {token.strip(".,:;()[]{}!?\"'").casefold() for token in normalized.split() if len(token) > 4}
            source_url = next((url for url, tokens in source_tokens if len(words & tokens) >= 2), None)
            changes.append(TailoringChange(text=normalized, kind="source_backed" if source_url else "tailored", source_url=source_url))
        return changes[:40]

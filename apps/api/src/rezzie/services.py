import re

import httpx
from fastapi import HTTPException

from .billing import BillingRepository
from .config import Settings
from .documents import is_section_heading
from .grounding import assert_grounded, remove_unsupported_quantitative_lines
from .providers.base import LLMProvider
from .schemas import (
    CoverLetterRequest,
    CoverLetterResult,
    ImportResponse,
    TailoringChange,
    TailoringResult,
    TailorRequest,
)
from .security import assert_safe_public_url, require_generation_key
from .trusted_sources import ExternalSource

SUMMARY_HEADINGS = {
    "SUMMARY",
    "PROFESSIONAL SUMMARY",
    "CAREER SUMMARY",
    "PROFILE",
    "PROFESSIONAL PROFILE",
    "CAREER PROFILE",
    "OBJECTIVE",
}
_MAX_CHANGE_TEXT_LENGTH = 10_000
_BULLET_PREFIXES = ("- ", "* ", "• ", "‣ ", "◦ ", "– ")


def _heading_name(line: str) -> str:
    stripped = line.strip()
    stripped = re.sub(r"^(?:[-*\u2022\u2023\u25e6\u2013]\s*)+", "", stripped)
    return " ".join(stripped.replace(":", "").split()).upper()


def _is_section_heading(line: str) -> bool:
    return is_section_heading(_heading_name(line))


def normalize_bulleted_section_headings(resume_text: str) -> str:
    """Render recognized section labels as headings even when the model prefixes one as a bullet."""
    normalized_lines = []
    for line in resume_text.splitlines():
        stripped = line.strip()
        heading = next(
            (
                stripped.removeprefix(prefix)
                for prefix in _BULLET_PREFIXES
                if stripped.startswith(prefix)
            ),
            None,
        )
        normalized_lines.append(
            heading if heading and is_section_heading(heading) else line
        )
    return "\n".join(normalized_lines)


def _summary_bounds(lines: list[str]) -> tuple[int, int] | None:
    for index, line in enumerate(lines):
        if _heading_name(line) not in SUMMARY_HEADINGS:
            continue
        end = index + 1
        while end < len(lines) and not _is_section_heading(lines[end]):
            end += 1
        return index, end
    return None


def preserve_source_summary(source_resume: str, tailored_resume: str) -> str:
    """Prevent an empty model-produced summary from discarding source content."""
    source_lines = source_resume.splitlines()
    source_bounds = _summary_bounds(source_lines)
    if not source_bounds:
        return tailored_resume
    source_summary = "\n".join(
        source_lines[source_bounds[0] + 1 : source_bounds[1]]
    ).strip()
    if not source_summary:
        return tailored_resume

    tailored_lines = tailored_resume.splitlines()
    tailored_bounds = _summary_bounds(tailored_lines)
    if tailored_bounds:
        existing_summary = "\n".join(
            tailored_lines[tailored_bounds[0] + 1 : tailored_bounds[1]]
        ).strip()
        if existing_summary:
            return tailored_resume
        replacement = [
            *tailored_lines[: tailored_bounds[0] + 1],
            source_summary,
            *tailored_lines[tailored_bounds[1] :],
        ]
        return "\n".join(replacement).strip()

    insertion_index = next(
        (
            index
            for index, line in enumerate(tailored_lines)
            if is_section_heading(line)
        ),
        len(tailored_lines),
    )
    replacement = [
        *tailored_lines[:insertion_index],
        "SUMMARY",
        source_summary,
        "",
        *tailored_lines[insertion_index:],
    ]
    return "\n".join(replacement).strip()


def finalize_tailored_resume(source_resume: str, tailored_resume: str) -> str:
    """Normalize section labels before enforcing a non-empty source summary."""
    normalized_source = normalize_bulleted_section_headings(source_resume)
    normalized_draft = normalize_bulleted_section_headings(tailored_resume)
    return preserve_source_summary(normalized_source, normalized_draft)


class JobDescriptionImporter:
    _MAX_REDIRECTS = 5

    def __init__(
        self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self._settings = settings
        self._transport = transport

    async def from_url(self, url: str) -> ImportResponse:
        current_url = url
        async with httpx.AsyncClient(
            follow_redirects=False, timeout=8.0, transport=self._transport
        ) as client:
            for redirects_followed in range(self._MAX_REDIRECTS + 1):
                assert_safe_public_url(current_url)
                try:
                    response = await client.get(
                        current_url, headers={"User-Agent": "RezzieJobImporter/1.0"}
                    )
                except httpx.HTTPError as error:
                    raise HTTPException(
                        status_code=422,
                        detail="Unable to retrieve that job-description URL.",
                    ) from error

                if response.is_redirect:
                    if redirects_followed == self._MAX_REDIRECTS:
                        raise HTTPException(
                            status_code=422,
                            detail="The job-description URL redirected too many times.",
                        )
                    location = response.headers.get("location")
                    if not location:
                        raise HTTPException(
                            status_code=422,
                            detail="The job-description URL returned an invalid redirect.",
                        )
                    current_url = str(response.url.join(location))
                    continue

                try:
                    response.raise_for_status()
                except httpx.HTTPError as error:
                    raise HTTPException(
                        status_code=422,
                        detail="Unable to retrieve that job-description URL.",
                    ) from error
                break
            else:  # pragma: no cover - the loop always exits or raises.
                raise HTTPException(
                    status_code=422,
                    detail="The job-description URL redirected too many times.",
                )
        if "text/html" not in response.headers.get("content-type", ""):
            raise HTTPException(
                status_code=422, detail="The URL must return an HTML page."
            )
        text = " ".join(response.text.replace("<", " <").split())
        if len(text) < 50:
            raise HTTPException(
                status_code=422, detail="No usable job-description text was found."
            )
        return ImportResponse(
            text=text[:100_000], source_type="url", source_url=current_url
        )


class TailoringService:
    def __init__(
        self, provider: LLMProvider, settings: Settings, billing: BillingRepository
    ) -> None:
        self._provider, self._settings, self._billing = provider, settings, billing

    def _consume_generation_credits(
        self,
        *,
        credential_mode: str,
        user_id: str | None,
        has_external_sources: bool,
        includes_resume_tailoring: bool,
        cover_letter_count: int,
        admin_override: bool,
    ) -> list[str]:
        """Charge only successful managed work and the non-member source supplement."""
        if admin_override:
            return []
        subscriber = bool(user_id and self._billing.has_active_subscription(user_id))
        base_credits = (
            1 if credential_mode == "subscription" and includes_resume_tailoring else 0
        )
        source_supplement = 1 if has_external_sources and not subscriber else 0
        total = base_credits + cover_letter_count + source_supplement
        if not total:
            return []
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Authentication is required when this request uses Rezzie credits.",
            )
        return self._billing.consume_credits(user_id, total)

    @staticmethod
    def _evidence_text(sources: list[ExternalSource]) -> str:
        return "\n\n".join(
            f"SOURCE: {source.url}\n{source.extracted_text}" for source in sources
        )

    async def tailor(
        self,
        request: TailorRequest,
        user_id: str | None = None,
        external_sources: list[ExternalSource] | None = None,
        *,
        admin_override: bool = False,
    ) -> TailoringResult:
        api_key = require_generation_key(
            request.credential_mode, request.api_key, self._settings.anthropic_api_key
        )
        external_sources = external_sources or []
        credit_sources = self._consume_generation_credits(
            credential_mode=request.credential_mode.value,
            user_id=user_id,
            has_external_sources=bool(external_sources),
            includes_resume_tailoring=True,
            cover_letter_count=1 if request.include_cover_letter else 0,
            admin_override=admin_override,
        )
        try:
            evidence_text = self._evidence_text(external_sources)
            provider_args = {
                "api_key": api_key,
                "resume_text": request.resume_text,
                "job_description": request.job_description,
            }
            if evidence_text:
                provider_args["evidence_text"] = evidence_text
            result = await self._provider.tailor(**provider_args)
            result = result.model_copy(
                update={
                    "tailored_resume": finalize_tailored_resume(
                        request.resume_text, result.tailored_resume
                    )
                }
            )
            try:
                assert_grounded(
                    f"{request.resume_text}\n{evidence_text}", result.tailored_resume
                )
            except HTTPException as error:
                if error.status_code != 422:
                    raise
                result = await self._provider.repair(
                    api_key=api_key,
                    resume_text=request.resume_text,
                    job_description=request.job_description,
                    rejected_draft=result.tailored_resume,
                )
                result = result.model_copy(
                    update={
                        "tailored_resume": finalize_tailored_resume(
                            request.resume_text, result.tailored_resume
                        )
                    }
                )
                try:
                    assert_grounded(
                        f"{request.resume_text}\n{evidence_text}",
                        result.tailored_resume,
                    )
                except HTTPException as repair_error:
                    if repair_error.status_code != 422:
                        raise
                    sanitized = remove_unsupported_quantitative_lines(
                        request.resume_text, result.tailored_resume
                    )
                    if len(sanitized) < 50:
                        sanitized = request.resume_text
                    try:
                        assert_grounded(request.resume_text, sanitized)
                    except HTTPException:
                        sanitized = request.resume_text
                    result = result.model_copy(
                        update={
                            "tailored_resume": sanitized,
                            "review_items": [
                                *result.review_items,
                                "VERIFY: Rezzie removed generated content that could not be grounded in the supplied resume.",
                            ][:20],
                            "truth_statement": "This draft preserves only claims grounded in the supplied resume; generated unsupported content was removed for review.",
                        }
                    )
            cover_letter = None
            if request.include_cover_letter:
                cover_letter = await self._generate_cover_letter(
                    api_key=api_key,
                    resume_text=request.resume_text,
                    job_description=request.job_description,
                    evidence_text=evidence_text,
                )
            return result.model_copy(
                update={
                    "changes": self._changes(
                        request.resume_text, result.tailored_resume, external_sources
                    ),
                    "cover_letter": cover_letter,
                }
            )
        except Exception:
            for credit_source in credit_sources:
                self._billing.refund_credit(user_id or "", credit_source)
            raise

    async def cover_letter(
        self,
        request: CoverLetterRequest,
        user_id: str | None,
        external_sources: list[ExternalSource] | None = None,
        *,
        admin_override: bool = False,
    ) -> CoverLetterResult:
        """Create a standalone, evidence-bound cover letter for the current role."""
        api_key = require_generation_key(
            request.credential_mode, request.api_key, self._settings.anthropic_api_key
        )
        sources = external_sources or []
        credit_sources = self._consume_generation_credits(
            credential_mode=request.credential_mode.value,
            user_id=user_id,
            has_external_sources=bool(sources),
            includes_resume_tailoring=False,
            cover_letter_count=1,
            admin_override=admin_override,
        )
        try:
            return await self._generate_cover_letter(
                api_key=api_key,
                resume_text=request.resume_text,
                job_description=request.job_description,
                evidence_text=self._evidence_text(sources),
            )
        except Exception:
            for credit_source in credit_sources:
                self._billing.refund_credit(user_id or "", credit_source)
            raise

    async def _generate_cover_letter(
        self,
        *,
        api_key: str,
        resume_text: str,
        job_description: str,
        evidence_text: str,
    ) -> CoverLetterResult:
        result = await self._provider.cover_letter(
            api_key=api_key,
            resume_text=resume_text,
            job_description=job_description,
            evidence_text=evidence_text,
        )
        assert_grounded(f"{resume_text}\n{evidence_text}", result.cover_letter)
        return result

    @staticmethod
    def _changes(
        resume_text: str, tailored_resume: str, sources: list[ExternalSource]
    ) -> list[TailoringChange]:
        original_lines = {
            line.strip().casefold() for line in resume_text.splitlines() if line.strip()
        }
        source_tokens = [
            (
                source.url,
                {
                    token.casefold()
                    for token in source.extracted_text.split()
                    if len(token) > 4
                },
            )
            for source in sources
        ]
        changes: list[TailoringChange] = []
        for line in tailored_resume.splitlines():
            normalized = line.strip()
            if (
                len(normalized) < 12
                or len(normalized) > _MAX_CHANGE_TEXT_LENGTH
                or normalized.casefold() in original_lines
            ):
                continue
            words = {
                token.strip(".,:;()[]{}!?\"'").casefold()
                for token in normalized.split()
                if len(token) > 4
            }
            source_url = next(
                (url for url, tokens in source_tokens if len(words & tokens) >= 2), None
            )
            changes.append(
                TailoringChange(
                    text=normalized,
                    kind="source_backed" if source_url else "tailored",
                    source_url=source_url,
                )
            )
        return changes[:40]

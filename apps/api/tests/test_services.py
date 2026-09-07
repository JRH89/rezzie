import httpx
import pytest
from fastapi import HTTPException

from rezzie.billing import BillingRepository
from rezzie.config import Settings
from rezzie.schemas import CredentialMode, TailoringResult, TailorRequest
from rezzie.services import (
    JobDescriptionImporter,
    TailoringService,
    preserve_source_summary,
)


class RepairingProvider:
    def __init__(self) -> None:
        self.repair_calls = 0

    async def tailor(self, *, api_key: str, resume_text: str, job_description: str) -> TailoringResult:
        return TailoringResult(tailored_resume="Acme Corp\nIncreased conversion by 40% with focused delivery work.", matched_keywords=[], review_items=[], truth_statement="Draft one.")

    async def repair(self, *, api_key: str, resume_text: str, job_description: str, rejected_draft: str) -> TailoringResult:
        self.repair_calls += 1
        return TailoringResult(tailored_resume="Acme Corp\nIncreased conversion by 25% with focused delivery work.", matched_keywords=[], review_items=[], truth_statement="Every claim is grounded in the supplied resume.")


@pytest.mark.asyncio
async def test_truth_guard_repairs_one_unsupported_draft(tmp_path: object) -> None:
    provider = RepairingProvider()
    service = TailoringService(provider, Settings(), BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True))
    request = TailorRequest(resume_text="Acme Corp\nIncreased conversion by 25% through delivery work.", job_description="B" * 50, credential_mode=CredentialMode.BYOK, api_key="test-api-key")

    result = await service.tailor(request)

    assert provider.repair_calls == 1
    assert "25%" in result.tailored_resume


class PersistentlyUnsafeProvider(RepairingProvider):
    async def repair(self, *, api_key: str, resume_text: str, job_description: str, rejected_draft: str) -> TailoringResult:
        self.repair_calls += 1
        return TailoringResult(tailored_resume="Acme Corp\nIncreased conversion by 40%\nLed product discovery.", matched_keywords=[], review_items=[], truth_statement="Draft two.")


@pytest.mark.asyncio
async def test_truth_guard_returns_sanitized_draft_after_a_failed_repair(tmp_path: object) -> None:
    provider = PersistentlyUnsafeProvider()
    service = TailoringService(provider, Settings(), BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True))
    request = TailorRequest(resume_text="Acme Corp\nIncreased conversion by 25% through delivery work.", job_description="B" * 50, credential_mode=CredentialMode.BYOK, api_key="test-api-key")

    result = await service.tailor(request)

    assert "40%" not in result.tailored_resume
    assert any(item.startswith("VERIFY:") for item in result.review_items)


def test_preserves_a_source_summary_when_the_generated_section_is_empty() -> None:
    source = "Taylor Example\n\nPROFESSIONAL SUMMARY\nGrounded product leader with platform delivery experience.\n\nEXPERIENCE\nAcme Corp | Product Manager"
    generated = "Taylor Example\n\nPROFESSIONAL SUMMARY\n\nEXPERIENCE\nAcme Corp | Product Manager"

    result = preserve_source_summary(source, generated)

    assert "Grounded product leader with platform delivery experience." in result


def test_does_not_overwrite_a_nonempty_generated_summary() -> None:
    source = "SUMMARY\nOriginal source summary.\n\nEXPERIENCE\nAcme Corp | Product Manager"
    generated = "SUMMARY\nTailored, grounded summary.\n\nEXPERIENCE\nAcme Corp | Product Manager"

    assert preserve_source_summary(source, generated) == generated


@pytest.mark.asyncio
async def test_job_importer_follows_and_validates_a_redirect(monkeypatch: pytest.MonkeyPatch) -> None:
    checked_urls: list[str] = []
    monkeypatch.setattr("rezzie.services.assert_safe_public_url", checked_urls.append)

    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == "https://jobs.example.test/opening":
            return httpx.Response(302, headers={"location": "/opening/backend"}, request=request)
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<html>Backend engineer responsibilities and requirements for this role.</html>", request=request)

    importer = JobDescriptionImporter(Settings(), transport=httpx.MockTransport(handler))
    result = await importer.from_url("https://jobs.example.test/opening")

    assert checked_urls == ["https://jobs.example.test/opening", "https://jobs.example.test/opening/backend"]
    assert result.source_url == "https://jobs.example.test/opening/backend"


@pytest.mark.asyncio
async def test_job_importer_rejects_an_unsafe_redirect(monkeypatch: pytest.MonkeyPatch) -> None:
    def validate_url(url: str) -> None:
        if "localhost" in url:
            raise HTTPException(status_code=422, detail="Private or local URL targets are not allowed.")

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://jobs.example.test/opening"
        return httpx.Response(302, headers={"location": "https://localhost/internal"}, request=request)

    monkeypatch.setattr("rezzie.services.assert_safe_public_url", validate_url)
    importer = JobDescriptionImporter(Settings(), transport=httpx.MockTransport(handler))

    with pytest.raises(HTTPException, match="Private or local"):
        await importer.from_url("https://jobs.example.test/opening")

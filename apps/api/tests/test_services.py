import pytest

from rezzie.billing import BillingRepository
from rezzie.config import Settings
from rezzie.schemas import CredentialMode, TailoringResult, TailorRequest
from rezzie.services import TailoringService


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


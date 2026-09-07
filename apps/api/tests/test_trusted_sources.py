import pytest
from fastapi import HTTPException

from rezzie.billing import BillingRepository
from rezzie.rate_limits import RateLimiter
from rezzie.trusted_sources import (
    TrustedSourceFetcher,
    TrustedSourceRepository,
    TrustedSourceService,
)


class FakeFetcher(TrustedSourceFetcher):
    async def fetch(self, url: str) -> tuple[str, str]:
        return url, "Built and maintained a public portfolio project with documented implementation details."


@pytest.mark.asyncio
async def test_trusted_sources_require_active_subscription_and_are_private(tmp_path: object) -> None:
    billing = BillingRepository(f"sqlite:///{tmp_path}/sources.db", bootstrap_schema=True)
    repository = TrustedSourceRepository(billing.sessions)
    service = TrustedSourceService(repository, billing, FakeFetcher())

    with pytest.raises(HTTPException, match="active Rezzie subscription"):
        await service.add("user-a", url="https://github.com/example", label="GitHub")

    billing.save_customer("user-a", "cus_a")
    billing.set_subscription("cus_a", "active", credits=50)
    source = await service.add("user-a", url="https://github.com/example", label="GitHub")

    assert source.source_type == "github"
    assert [item.id for item in repository.list("user-a")] == [source.id]
    assert repository.list("user-b") == []
    with pytest.raises(HTTPException, match="could not be found"):
        repository.selected("user-b", [source.id])


def test_rate_limiter_blocks_after_window_limit(tmp_path: object) -> None:
    billing = BillingRepository(f"sqlite:///{tmp_path}/limits.db", bootstrap_schema=True)
    limiter = RateLimiter(billing.sessions, "test-salt")
    limiter.enforce("tailor", "user-a", limit=2, seconds=60)
    limiter.enforce("tailor", "user-a", limit=2, seconds=60)
    with pytest.raises(HTTPException) as error:
        limiter.enforce("tailor", "user-a", limit=2, seconds=60)
    assert error.value.status_code == 429

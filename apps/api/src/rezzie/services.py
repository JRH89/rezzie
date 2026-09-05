import httpx
from fastapi import HTTPException

from .billing import BillingRepository
from .config import Settings
from .providers.base import LLMProvider
from .schemas import ImportResponse, TailoringResult, TailorRequest
from .security import assert_safe_public_url, require_generation_key


class JobDescriptionImporter:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def from_url(self, url: str) -> ImportResponse:
        assert_safe_public_url(url)
        try:
            async with httpx.AsyncClient(follow_redirects=False, timeout=8.0) as client:
                response = await client.get(url, headers={"User-Agent": "RezzieJobImporter/1.0"})
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise HTTPException(status_code=422, detail="Unable to retrieve that job-description URL.") from error
        if "text/html" not in response.headers.get("content-type", ""):
            raise HTTPException(status_code=422, detail="The URL must return an HTML page.")
        text = " ".join(response.text.replace("<", " <").split())
        if len(text) < 50:
            raise HTTPException(status_code=422, detail="No usable job-description text was found.")
        return ImportResponse(text=text[:100_000], source_type="url", source_url=url)


class TailoringService:
    def __init__(self, provider: LLMProvider, settings: Settings, billing: BillingRepository) -> None:
        self._provider, self._settings, self._billing = provider, settings, billing

    async def tailor(self, request: TailorRequest, user_id: str | None = None) -> TailoringResult:
        api_key = require_generation_key(request.credential_mode, request.api_key, self._settings.anthropic_api_key)
        credit_source: str | None = None
        if request.credential_mode.value == "subscription":
            if not user_id: raise HTTPException(status_code=401, detail="Authentication is required for subscription usage.")
            credit_source = self._billing.consume_credit(user_id)
        try: return await self._provider.tailor(api_key=api_key, resume_text=request.resume_text, job_description=request.job_description)
        except Exception:
            if credit_source: self._billing.refund_credit(user_id or "", credit_source)
            raise

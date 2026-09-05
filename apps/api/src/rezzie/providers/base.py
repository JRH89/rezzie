from typing import Protocol

from ..schemas import TailoringResult


class LLMProvider(Protocol):
    async def tailor(self, *, api_key: str, resume_text: str, job_description: str) -> TailoringResult: ...
    async def repair(self, *, api_key: str, resume_text: str, job_description: str, rejected_draft: str) -> TailoringResult: ...

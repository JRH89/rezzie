import json

from anthropic import AsyncAnthropic
from pydantic import ValidationError

from ..prompts import RESUME_TAILORING_MASTER_PROMPT
from ..schemas import TailoringResult


class AnthropicProvider:
    async def tailor(self, *, api_key: str, resume_text: str, job_description: str) -> TailoringResult:
        client = AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model="claude-3-5-haiku-latest", max_tokens=4096, temperature=0,
            system=RESUME_TAILORING_MASTER_PROMPT,
            messages=[{"role": "user", "content": f"ORIGINAL_RESUME:\n{resume_text}\n\nJOB_DESCRIPTION:\n{job_description}"}],
        )
        payload = "".join(part.text for part in response.content if part.type == "text")
        try:
            return TailoringResult.model_validate(json.loads(payload))
        except (json.JSONDecodeError, ValidationError) as error:
            raise ValueError("The model returned an invalid tailoring result.") from error

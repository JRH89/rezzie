import json

from anthropic import APIError, AsyncAnthropic, AuthenticationError
from pydantic import ValidationError

from ..prompts import RESUME_TAILORING_MASTER_PROMPT
from ..schemas import TailoringResult


class AnthropicProvider:
    def __init__(self, model: str = "claude-haiku-4-5") -> None:
        self._model = model

    async def tailor(self, *, api_key: str, resume_text: str, job_description: str) -> TailoringResult:
        client = AsyncAnthropic(api_key=api_key)
        try:
            response = await client.messages.create(
                model=self._model,
                max_tokens=4096,
                system=RESUME_TAILORING_MASTER_PROMPT,
                messages=[{"role": "user", "content": f"ORIGINAL_RESUME:\n{resume_text}\n\nJOB_DESCRIPTION:\n{job_description}"}],
            )
        except AuthenticationError as error:
            raise ValueError("Anthropic rejected the API key. Check the key and try again.") from error
        except APIError as error:
            raise ValueError("Claude could not complete the request. Try again in a moment.") from error
        if response.stop_reason == "refusal":
            raise ValueError("Claude declined this tailoring request.")
        payload = "".join(part.text for part in response.content if part.type == "text")
        try:
            return TailoringResult.model_validate(json.loads(payload))
        except (json.JSONDecodeError, ValidationError) as error:
            raise ValueError("The model returned an invalid tailoring result.") from error

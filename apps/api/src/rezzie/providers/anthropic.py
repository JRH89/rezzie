import json

from anthropic import AsyncAnthropic
from pydantic import ValidationError

from ..schemas import TailoringResult

SYSTEM_PROMPT = """You are Rezzie's truth-preserving resume editor. Rewrite only using facts explicitly present in ORIGINAL_RESUME. Do not add, infer, exaggerate, or fabricate any employer, role, date, credential, skill, project, metric, responsibility, or result. Improve prioritization, clarity and ATS keyword alignment only where the resume fact supports it. If a job requirement lacks evidence, put it in review_items rather than the resume. Return valid JSON only: tailored_resume (string), matched_keywords (string array), review_items (string array), truth_statement (string)."""


class AnthropicProvider:
    async def tailor(self, *, api_key: str, resume_text: str, job_description: str) -> TailoringResult:
        client = AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model="claude-3-5-haiku-latest", max_tokens=4096, temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"ORIGINAL_RESUME:\n{resume_text}\n\nJOB_DESCRIPTION:\n{job_description}"}],
        )
        payload = "".join(part.text for part in response.content if part.type == "text")
        try:
            return TailoringResult.model_validate(json.loads(payload))
        except (json.JSONDecodeError, ValidationError) as error:
            raise ValueError("The model returned an invalid tailoring result.") from error

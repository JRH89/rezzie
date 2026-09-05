import json
from types import SimpleNamespace

import pytest

from rezzie.providers.anthropic import AnthropicProvider


@pytest.mark.asyncio
async def test_provider_uses_supported_messages_parameters(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    payload = {
        "tailored_resume": "A grounded resume result that is long enough to pass response validation safely.",
        "matched_keywords": ["Python"],
        "review_items": [],
        "truth_statement": "Every claim remains grounded in the supplied resume.",
    }

    class Messages:
        async def create(self, **kwargs: object) -> object:
            captured.update(kwargs)
            return SimpleNamespace(
                stop_reason="end_turn",
                content=[SimpleNamespace(type="text", text=json.dumps(payload))],
            )

    class Client:
        def __init__(self, *, api_key: str) -> None:
            assert api_key == "test-api-key"
            self.messages = Messages()

    monkeypatch.setattr("rezzie.providers.anthropic.AsyncAnthropic", Client)
    result = await AnthropicProvider("claude-haiku-4-5").tailor(
        api_key="test-api-key",
        resume_text="A" * 50,
        job_description="B" * 50,
    )

    assert captured["model"] == "claude-haiku-4-5"
    assert "temperature" not in captured
    assert result.matched_keywords == ["Python"]

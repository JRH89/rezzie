import json
from types import SimpleNamespace

import httpx
import pytest
from anthropic import BadRequestError, InternalServerError
from rezzie.providers.anthropic import (
    AnthropicProvider,
    parse_tailoring_payload,
    strict_json_schema,
)
from rezzie.schemas import TailoringResult


def test_strict_json_schema_closes_every_object() -> None:
    schema = strict_json_schema(TailoringResult.model_json_schema())

    def object_schemas(value: object) -> list[dict[str, object]]:
        if isinstance(value, dict):
            nested = [value, *(item for child in value.values() for item in object_schemas(child))]
            return nested
        if isinstance(value, list):
            return [item for child in value for item in object_schemas(child)]
        return []

    assert all(item.get("additionalProperties") is False for item in object_schemas(schema) if item.get("type") == "object")


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
        def __init__(self, *, api_key: str, **_: object) -> None:
            assert api_key == "test-api-key"
            self.messages = Messages()

    monkeypatch.setattr("rezzie.providers.anthropic.AsyncAnthropic", Client)
    monkeypatch.setattr(AnthropicProvider, "_reference_date", staticmethod(lambda: "2026-09-06"))
    result = await AnthropicProvider("claude-haiku-4-5", max_tokens=8192).tailor(
        api_key="test-api-key",
        resume_text="A" * 50,
        job_description="B" * 50,
    )

    assert captured["model"] == "claude-haiku-4-5"
    assert "temperature" not in captured
    assert captured["max_tokens"] == 8192
    system = captured["system"]
    assert isinstance(system, list)
    assert system[0]["cache_control"] == {"type": "ephemeral"}
    assert "The authoritative current date is 2026-09-06" in str(system)
    output_config = captured["output_config"]
    assert isinstance(output_config, dict)
    assert output_config["format"]["type"] == "json_schema"
    assert result.matched_keywords == ["Python"]


@pytest.mark.asyncio
async def test_sonnet_five_uses_configured_effort_without_schema_output(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}
    payload = {
        "tailored_resume": "A grounded resume result that is long enough to pass response validation safely.",
        "matched_keywords": [],
        "review_items": [],
        "truth_statement": "Every claim remains grounded in the supplied resume.",
    }

    class Messages:
        async def create(self, **kwargs: object) -> object:
            captured.update(kwargs)
            return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json.dumps(payload))])

    class Client:
        def __init__(self, *, api_key: str, **_: object) -> None:
            self.messages = Messages()

    monkeypatch.setattr("rezzie.providers.anthropic.AsyncAnthropic", Client)
    await AnthropicProvider("claude-sonnet-5", max_tokens=12_288, effort="medium").tailor(
        api_key="test-api-key",
        resume_text="A" * 50,
        job_description="B" * 50,
    )

    assert captured["model"] == "claude-sonnet-5"
    assert captured["max_tokens"] == 12_288
    assert captured["output_config"] == {"effort": "medium"}


def test_parser_extracts_json_from_prose_and_discards_extra_fields() -> None:
    payload = """Here is the tailored result:
```json
{"tailored_resume":"A grounded resume result that is long enough to pass response validation safely.","matched_keywords":[],"review_items":[],"truth_statement":"Every claim is grounded.","unused_model_note":"discard me"}
```
"""
    assert parse_tailoring_payload(payload).truth_statement == "Every claim is grounded."


@pytest.mark.asyncio
async def test_provider_falls_back_when_structured_outputs_are_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []
    payload = {"tailored_resume": "A grounded resume result that is long enough to pass response validation safely.", "matched_keywords": [], "review_items": [], "truth_statement": "Every claim is grounded."}

    class Messages:
        async def create(self, **kwargs: object) -> object:
            calls.append(kwargs)
            if "output_config" in kwargs:
                raise BadRequestError("Unsupported output format", response=httpx.Response(400, request=httpx.Request("POST", "https://api.anthropic.com")), body=None)
            return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json.dumps(payload))])

    class Client:
        def __init__(self, *, api_key: str, **_: object) -> None:
            self.messages = Messages()

    monkeypatch.setattr("rezzie.providers.anthropic.AsyncAnthropic", Client)
    result = await AnthropicProvider().tailor(api_key="test-api-key", resume_text="A" * 50, job_description="B" * 50)
    assert result.truth_statement == "Every claim is grounded."
    assert len(calls) == 2
    assert "output_config" in calls[0]
    assert "output_config" not in calls[1]


@pytest.mark.asyncio
async def test_provider_retries_a_transient_upstream_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0
    delays: list[float] = []
    payload = {
        "tailored_resume": "A grounded resume result that is long enough to pass response validation safely.",
        "matched_keywords": [],
        "review_items": [],
        "truth_statement": "Every claim is grounded.",
    }

    class Messages:
        async def create(self, **_: object) -> object:
            nonlocal calls
            calls += 1
            if calls == 1:
                request = httpx.Request("POST", "https://api.anthropic.com")
                raise InternalServerError("Temporary overload", response=httpx.Response(529, request=request), body=None)
            return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json.dumps(payload))])

    class Client:
        def __init__(self, **_: object) -> None:
            self.messages = Messages()

    async def record_delay(seconds: float) -> None:
        delays.append(seconds)

    monkeypatch.setattr("rezzie.providers.anthropic.AsyncAnthropic", Client)
    monkeypatch.setattr("rezzie.providers.anthropic.asyncio.sleep", record_delay)
    result = await AnthropicProvider().tailor(api_key="test-api-key", resume_text="A" * 50, job_description="B" * 50)

    assert result.truth_statement == "Every claim is grounded."
    assert calls == 2
    assert delays == [0.75]

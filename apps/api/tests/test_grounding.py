import pytest
from fastapi import HTTPException

from rezzie.grounding import assert_grounded, remove_unsupported_quantitative_lines


def test_allows_claims_present_in_source_resume() -> None:
    assert_grounded("Acme Corp | Increased conversion by 25%", "Acme Corp\nIncreased conversion by 25%")


def test_rejects_invented_metric() -> None:
    with pytest.raises(HTTPException, match="quantitative"):
        assert_grounded("Acme Corp | Increased conversion by 25%", "Acme Corp\nIncreased conversion by 40%")


def test_allows_job_description_keywords_and_terminology() -> None:
    assert_grounded(
        "Acme Corp | Product manager",
        "Globex Inc\nProduct manager\nStakeholder management, roadmapping, and agile delivery.",
    )


def test_allows_ordered_list_formatting_but_removes_unsupported_metric_lines() -> None:
    assert_grounded("Acme Corp | Increased conversion by 25%", "1. Acme Corp\nIncreased conversion by 25%")
    sanitized = remove_unsupported_quantitative_lines("Acme Corp | Increased conversion by 25%", "Acme Corp\nIncreased conversion by 40%\nLed product discovery.")
    assert sanitized == "Acme Corp\nLed product discovery."

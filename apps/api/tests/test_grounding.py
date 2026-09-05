import pytest
from fastapi import HTTPException

from rezzie.grounding import assert_grounded


def test_allows_claims_present_in_source_resume() -> None:
    assert_grounded("Acme Corp | Increased conversion by 25%", "Acme Corp\nIncreased conversion by 25%")


def test_rejects_invented_metric() -> None:
    with pytest.raises(HTTPException, match="quantitative"):
        assert_grounded("Acme Corp | Increased conversion by 25%", "Acme Corp\nIncreased conversion by 40%")


def test_rejects_invented_named_company() -> None:
    with pytest.raises(HTTPException, match="named claim"):
        assert_grounded("Acme Corp | Product manager", "Globex Inc\nProduct manager")

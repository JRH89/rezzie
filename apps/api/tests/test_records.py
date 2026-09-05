import pytest
from fastapi import HTTPException

from rezzie.billing import BillingRepository
from rezzie.records import CareerRecordRepository


def test_imported_facts_require_confirmation_before_becoming_tailoring_source(tmp_path: object) -> None:
    billing = BillingRepository(f"sqlite:///{tmp_path}/records.db", bootstrap_schema=True)
    records = CareerRecordRepository(billing.sessions)
    record = records.create(
        "candidate-1",
        "Primary record",
        "Jordan Doe\nSkills\nPython, SQL\nBuilt reporting workflows used by the operations team.",
    )

    facts = records.facts("candidate-1", record.id)
    assert facts
    assert {fact.status for fact in facts} == {"needs_review"}
    with pytest.raises(HTTPException, match="Confirm at least one"):
        records.confirmed_source("candidate-1", record.id)

    confirmed = facts[0]
    records.update_fact(
        "candidate-1", record.id, confirmed.id,
        text=confirmed.text, status="confirmed", evidence_note="Confirmed by candidate.",
    )
    source = records.confirmed_source("candidate-1", record.id)
    assert confirmed.text in source


def test_candidate_can_add_and_confirm_a_fact_without_cross_user_access(tmp_path: object) -> None:
    billing = BillingRepository(f"sqlite:///{tmp_path}/records.db", bootstrap_schema=True)
    records = CareerRecordRepository(billing.sessions)
    record = records.create("candidate-1", "Primary record", "A sufficiently long original resume source line for this test.")
    fact = records.add_fact("candidate-1", record.id, fact_type="skill", text="TypeScript", evidence_note=None)
    assert fact.status == "needs_review"
    with pytest.raises(HTTPException) as error:
        records.facts("candidate-2", record.id)
    assert error.value.status_code == 404

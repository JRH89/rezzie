import pytest
from fastapi import HTTPException

from rezzie.billing import BillingRepository


def test_purchased_credit_grant_is_idempotent(tmp_path: object) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    repository.grant_purchase_once("user-1", "checkout-1", 5)
    repository.grant_purchase_once("user-1", "checkout-1", 5)
    account = repository.account("user-1")
    assert account.purchased_credits == 5


def test_credit_is_consumed_and_refundable(tmp_path: object) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    repository.grant_purchase_once("user-1", "checkout-1", 1)
    assert repository.consume_credit("user-1") == "purchased"
    with pytest.raises(HTTPException) as error: repository.consume_credit("user-1")
    assert error.value.status_code == 402
    repository.refund_credit("user-1", "purchased")
    assert repository.consume_credit("user-1") == "purchased"


def test_balance_keeps_credit_types_separate(tmp_path: object) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    repository.grant_purchase_once("user-1", "checkout-1", 3)
    assert repository.balance("user-1") == ("none", 0, 3)

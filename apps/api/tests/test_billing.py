from types import SimpleNamespace

import pytest
import stripe
from fastapi import HTTPException

from rezzie.billing import BillingRepository, CheckoutRequest, StripeBillingService
from rezzie.config import Settings


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


def test_source_backed_credit_charge_consumes_two_credits(tmp_path: object) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    repository.grant_purchase_once("user-1", "checkout-1", 2)
    assert repository.consume_credits("user-1", 2) == ["purchased", "purchased"]
    assert repository.balance("user-1") == ("none", 0, 0)


def test_balance_keeps_credit_types_separate(tmp_path: object) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    repository.grant_purchase_once("user-1", "checkout-1", 3)
    assert repository.balance("user-1") == ("none", 0, 3)


def test_webhook_grants_a_credit_pack_once(tmp_path: object, monkeypatch: pytest.MonkeyPatch) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    service = StripeBillingService(Settings(stripe_webhook_secret="whsec_test"), repository)
    event = {"id": "evt_purchase", "type": "checkout.session.completed", "data": {"object": {"id": "cs_1", "mode": "payment", "payment_status": "paid", "client_reference_id": "user-1", "metadata": {"credits": "5"}}}}
    monkeypatch.setattr("rezzie.billing.stripe.Webhook.construct_event", lambda *_: event)
    service.webhook(b"{}", "signature")
    service.webhook(b"{}", "signature")
    assert repository.balance("user-1") == ("none", 0, 5)


def test_paid_invoice_resets_monthly_credit_allowance(tmp_path: object, monkeypatch: pytest.MonkeyPatch) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    repository.save_customer("user-1", "cus_1")
    service = StripeBillingService(Settings(stripe_webhook_secret="whsec_test", stripe_subscription_monthly_credits=20), repository)
    event = {"id": "evt_invoice", "type": "invoice.paid", "data": {"object": {"subscription": "sub_1", "customer": "cus_1"}}}
    monkeypatch.setattr("rezzie.billing.stripe.Webhook.construct_event", lambda *_: event)
    service.webhook(b"{}", "signature")
    assert repository.balance("user-1") == ("active", 20, 0)


def test_credit_checkout_uses_selected_pack_quantity(tmp_path: object, monkeypatch: pytest.MonkeyPatch) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    service = StripeBillingService(Settings(stripe_secret_key="sk_test", stripe_credit_packs='{"price_pack":20}'), repository)
    captured: dict[str, object] = {}
    monkeypatch.setattr("rezzie.billing.stripe.Customer.create", lambda **_: {"id": "cus_1"})
    monkeypatch.setattr("rezzie.billing.stripe.checkout.Session.create", lambda **kwargs: captured.update(kwargs) or SimpleNamespace(url="https://checkout.example"))

    assert service.checkout("user-1", CheckoutRequest(kind="credits", price_id="price_pack", quantity=3)) == "https://checkout.example"
    assert captured["line_items"] == [{"price": "price_pack", "quantity": 3}]
    assert captured["metadata"] == {"rezzie_kind": "credits", "credits": "60"}


@pytest.mark.parametrize("quantity", [0, 11])
def test_credit_checkout_rejects_out_of_range_quantity(tmp_path: object, quantity: int) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    service = StripeBillingService(Settings(stripe_secret_key="sk_test", stripe_credit_packs='{"price_pack":20}'), repository)

    with pytest.raises(HTTPException, match="quantity must be between 1 and 10"):
        service.checkout("user-1", CheckoutRequest(kind="credits", price_id="price_pack", quantity=quantity))


def test_credit_checkout_returns_safe_error_when_stripe_rejects_configuration(tmp_path: object, monkeypatch: pytest.MonkeyPatch) -> None:
    repository = BillingRepository(f"sqlite:///{tmp_path}/billing.db", bootstrap_schema=True)
    service = StripeBillingService(Settings(stripe_secret_key="sk_test", stripe_credit_packs='{"price_pack":20}'), repository)
    monkeypatch.setattr("rezzie.billing.stripe.Customer.create", lambda **_: (_ for _ in ()).throw(stripe.error.AuthenticationError("bad key")))

    with pytest.raises(HTTPException, match="Verify the server's live Stripe key") as error:
        service.checkout("user-1", CheckoutRequest(kind="credits", price_id="price_pack"))
    assert error.value.status_code == 502

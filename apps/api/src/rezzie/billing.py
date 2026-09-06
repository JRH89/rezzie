"""Stripe-backed billing and a local, idempotent entitlement ledger."""
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

import stripe
from fastapi import HTTPException
from sqlalchemy import DateTime, Integer, String, create_engine, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import Settings


class Base(DeclarativeBase):
    pass


class BillingAccount(Base):
    __tablename__ = "billing_accounts"
    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    subscription_status: Mapped[str] = mapped_column(String(32), default="none")
    subscription_credits: Mapped[int] = mapped_column(Integer, default=0)
    subscription_used: Mapped[int] = mapped_column(Integer, default=0)
    purchased_credits: Mapped[int] = mapped_column(Integer, default=0)


class ProcessedStripeEvent(Base):
    __tablename__ = "processed_stripe_events"
    event_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class CreditGrant(Base):
    __tablename__ = "credit_grants"
    reference: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128))
    credits: Mapped[int] = mapped_column(Integer)


class BillingRepository:
    def __init__(self, database_url: str, *, bootstrap_schema: bool = False) -> None:
        connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        self._engine = create_engine(database_url, connect_args=connect_args)
        if bootstrap_schema: Base.metadata.create_all(self._engine)
        self._sessions = sessionmaker(self._engine, expire_on_commit=False)

    def is_ready(self) -> bool:
        with self._engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True

    @property
    def sessions(self) -> sessionmaker:
        return self._sessions

    @staticmethod
    def _new_account(user_id: str) -> BillingAccount:
        return BillingAccount(user_id=user_id, stripe_customer_id=None, subscription_status="none", subscription_credits=0, subscription_used=0, purchased_credits=0)

    def account(self, user_id: str) -> BillingAccount:
        with self._sessions.begin() as session:
            account = session.get(BillingAccount, user_id)
            if account is None:
                account = self._new_account(user_id)
                session.add(account)
            return account

    def account_by_customer(self, customer_id: str) -> BillingAccount | None:
        with self._sessions() as session:
            return session.scalar(select(BillingAccount).where(BillingAccount.stripe_customer_id == customer_id))

    def save_customer(self, user_id: str, customer_id: str) -> None:
        with self._sessions.begin() as session:
            account = session.get(BillingAccount, user_id) or self._new_account(user_id)
            account.stripe_customer_id = customer_id
            session.merge(account)

    def mark_event_once(self, event_id: str) -> bool:
        with self._sessions.begin() as session:
            if session.get(ProcessedStripeEvent, event_id): return False
            session.add(ProcessedStripeEvent(event_id=event_id)); return True

    def grant_purchase_once(self, user_id: str, reference: str, credits: int) -> None:
        with self._sessions.begin() as session:
            if session.get(CreditGrant, reference): return
            account = session.get(BillingAccount, user_id) or self._new_account(user_id)
            account.purchased_credits += credits
            session.add(CreditGrant(reference=reference, user_id=user_id, credits=credits)); session.merge(account)

    def set_subscription(self, customer_id: str, status: str, credits: int | None = None) -> None:
        with self._sessions.begin() as session:
            account = session.scalar(select(BillingAccount).where(BillingAccount.stripe_customer_id == customer_id))
            if account is None: return
            account.subscription_status = status
            if credits is not None: account.subscription_credits, account.subscription_used = credits, 0

    def consume_credit(self, user_id: str) -> Literal["subscription", "purchased"]:
        with self._sessions.begin() as session:
            account = session.get(BillingAccount, user_id)
            if account and account.subscription_status in {"active", "trialing"} and account.subscription_used < account.subscription_credits:
                account.subscription_used += 1; return "subscription"
            if account and account.purchased_credits > 0:
                account.purchased_credits -= 1; return "purchased"
        raise HTTPException(status_code=402, detail="No tailoring credits available. Purchase credits or subscribe.")

    def refund_credit(self, user_id: str, source: str) -> None:
        with self._sessions.begin() as session:
            account = session.get(BillingAccount, user_id)
            if not account: return
            if source == "subscription": account.subscription_used = max(0, account.subscription_used - 1)
            else: account.purchased_credits += 1

    def balance(self, user_id: str) -> tuple[str, int, int]:
        account = self.account(user_id)
        monthly = max(0, account.subscription_credits - account.subscription_used)
        return account.subscription_status, monthly, account.purchased_credits


@dataclass(frozen=True)
class CheckoutRequest:
    kind: Literal["credits", "subscription"]
    price_id: str
    quantity: int = 1


class StripeBillingService:
    def __init__(self, settings: Settings, repository: BillingRepository) -> None:
        self._settings, self._repository = settings, repository
        if settings.stripe_secret_key: stripe.api_key = settings.stripe_secret_key

    def checkout(self, user_id: str, request: CheckoutRequest) -> str:
        if not self._settings.stripe_secret_key: raise HTTPException(status_code=503, detail="Stripe billing is not configured.")
        packs = json.loads(self._settings.stripe_credit_packs)
        if request.kind == "credits" and request.price_id not in packs: raise HTTPException(status_code=422, detail="Unknown credit pack.")
        if request.kind == "subscription" and request.price_id != self._settings.stripe_subscription_price_id: raise HTTPException(status_code=422, detail="Unknown subscription plan.")
        if request.kind == "credits" and not 1 <= request.quantity <= 10: raise HTTPException(status_code=422, detail="Credit pack quantity must be between 1 and 10.")
        if request.kind == "subscription" and request.quantity != 1: raise HTTPException(status_code=422, detail="Subscription quantity must be 1.")
        account = self._repository.account(user_id)
        try:
            customer = account.stripe_customer_id or stripe.Customer.create(metadata={"rezzie_user_id": user_id})["id"]
            self._repository.save_customer(user_id, customer)
            credits = packs.get(request.price_id, 0) * request.quantity
            session = stripe.checkout.Session.create(customer=customer, mode="payment" if request.kind == "credits" else "subscription", line_items=[{"price": request.price_id, "quantity": request.quantity}], client_reference_id=user_id, metadata={"rezzie_kind": request.kind, "credits": str(credits)}, success_url=f"{self._settings.app_url}/?checkout=success&session_id={{CHECKOUT_SESSION_ID}}", cancel_url=f"{self._settings.app_url}/?checkout=cancelled")
        except stripe.error.StripeError as error:
            raise HTTPException(status_code=502, detail="Stripe Checkout could not start. Verify the server's live Stripe key and matching Price IDs.") from error
        return session.url

    def portal(self, user_id: str) -> str:
        if not self._settings.stripe_secret_key: raise HTTPException(status_code=503, detail="Stripe billing is not configured.")
        customer = self._repository.account(user_id).stripe_customer_id
        if not customer: raise HTTPException(status_code=404, detail="No billing account exists yet.")
        try:
            return stripe.billing_portal.Session.create(customer=customer, return_url=self._settings.app_url)["url"]
        except stripe.error.StripeError as error:
            raise HTTPException(status_code=502, detail="Stripe billing portal could not open. Verify the server's live Stripe configuration.") from error

    def webhook(self, payload: bytes, signature: str | None) -> None:
        if not self._settings.stripe_webhook_secret or not signature: raise HTTPException(status_code=400, detail="Invalid webhook signature.")
        try: event = stripe.Webhook.construct_event(payload, signature, self._settings.stripe_webhook_secret)
        except (ValueError, stripe.error.SignatureVerificationError) as error: raise HTTPException(status_code=400, detail="Invalid webhook signature.") from error
        if not self._repository.mark_event_once(event["id"]): return
        obj, event_type = event["data"]["object"], event["type"]
        if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"} and obj.get("mode") == "payment" and obj.get("payment_status") == "paid":
            credits = int(obj.get("metadata", {}).get("credits", "0")); user_id = obj.get("client_reference_id")
            if user_id and credits > 0: self._repository.grant_purchase_once(user_id, obj["id"], credits)
        elif event_type == "invoice.paid" and obj.get("subscription"):
            self._repository.set_subscription(obj["customer"], "active", self._settings.stripe_subscription_monthly_credits)
        elif event_type == "invoice.payment_failed" and obj.get("subscription"):
            self._repository.set_subscription(obj["customer"], "past_due")
        elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
            self._repository.set_subscription(obj["customer"], obj["status"])

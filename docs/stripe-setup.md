# Stripe setup: credits and monthly plans

Rezzie charges **one credit per completed tailoring run**. A credit pack is a one-time Checkout purchase; a monthly subscription grants `STRIPE_SUBSCRIPTION_MONTHLY_CREDITS` at each successful paid renewal. Purchased credits carry over. Monthly credits reset each period and are consumed first.

## Dashboard configuration

1. In Stripe **test mode**, create a `Rezzie credits` product and one or more one-time Prices (for example, 5 credits and 20 credits).
2. Create a `Rezzie Pro` product and a recurring monthly Price.
3. Set these server-only values in `apps/api/.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_PRICE_ID`, `STRIPE_SUBSCRIPTION_MONTHLY_CREDITS`, and `STRIPE_CREDIT_PACKS`. `STRIPE_CREDIT_PACKS` maps a Stripe Price ID to a positive integer, for example `{"price_123":5,"price_456":20}`.
4. Configure `APP_URL` to the public web origin. Configure `DATABASE_URL` to managed Postgres before production; SQLite is only for local development.
5. Enable the Stripe Customer Portal if customers should self-manage/cancel subscriptions. Add a portal endpoint before exposing its link in the UI.

## Webhook endpoint

Create an endpoint at `https://api.your-domain.example/api/v1/billing/webhook`. Copy its signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`; never place it in the browser.

Subscribe the endpoint to these events:

- `checkout.session.completed` — grants a paid credit-pack purchase and associates a Checkout customer.
- `checkout.session.async_payment_succeeded` — grants credit packs for delayed payment methods.
- `invoice.paid` — resets the subscribed customer’s monthly included credits after each successful period payment.
- `invoice.payment_failed` — required for customer notification/recovery once email/portal flows are enabled.
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` — keeps subscription entitlement status current.

The handler verifies Stripe’s signature against the raw request body and saves every event ID before applying effects. This makes Stripe retries safe. Do not use the success redirect as the source of truth: fulfillment happens in the webhook.

## Local test

Run the API, then use Stripe CLI:

```powershell
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

Copy the CLI-provided `whsec_...` into local `.env`, restart the API, create a Checkout Session, and complete it with Stripe’s test card `4242 4242 4242 4242`. Test both a one-time pack and a real test subscription; Dashboard/CLI-triggered fixtures do not always correspond to a real Customer/payment sequence.

## Production gate

The checkout route deliberately accepts an `X-Rezzie-User-Id` header only when `ENVIRONMENT=development`. Replace it with the verified subject from the chosen identity provider before production. Stripe metadata is correlation data, not authorization; server-side identity, signed webhook verification, and the credit ledger determine access.

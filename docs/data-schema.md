# Data schema

| Entity | Key fields | Retention/security |
| --- | --- | --- |
| User | `id`, `subscription_status` | Identity provider owned; API verifies server-side. |
| Resume | `id`, `user_id`, `source_text`, `created_at` | Encrypt at rest; user-deletable. |
| JobDescription | `id`, `user_id`, `source_type`, `source_url?`, `text` | Encrypt at rest; URL fetch audit stores metadata only. |
| TailoringRun | `id`, `resume_id`, `job_id`, `provider`, `model`, `result`, `created_at` | No API key; record consent/version. |
| Subscription | `user_id`, `provider_customer_id`, `status` | Billing webhook is authoritative. |
| BillingAccount | `user_id`, `stripe_customer_id`, subscription/purchased credit balances | Server-only; credit consumption is transactional. |
| ProcessedStripeEvent | `event_id`, `received_at` | Idempotency record; do not re-apply delivery retries. |
| CreditGrant | `reference`, `user_id`, `credits` | Unique Checkout-session fulfillment record. |

BYOK values are intentionally absent: they are request-scoped secrets, never database fields.

# Production deployment runbook

## Prerequisites

- Managed PostgreSQL reachable only from the API host. Set `DATABASE_URL` to the `postgresql+psycopg://` connection string.
- A public web origin and an API hostname, both behind Cloudflare. Put only the API origin behind Cloudflare Tunnel or a reverse proxy; the provided production Compose binding is loopback-only.
- OIDC provider configuration that issues JWT access tokens for the web app/API.
- Anthropic, Stripe, and Stripe webhook secrets stored only in the hosting secret manager.

## Required environment values

Set `ENVIRONMENT=production`, `APP_URL`, exact `ALLOWED_ORIGINS`, exact `ALLOWED_HOSTS`, `DATABASE_URL`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, `ANTHROPIC_API_KEY`, all `STRIPE_*` values, and `CLAMAV_HOST=clamav` when using the provided Compose service. Do not use localhost defaults in production.

## Launch sequence

1. Configure the Stripe Prices and webhook as described in `stripe-setup.md`.
2. Configure the OIDC application’s allowed redirect origin and API audience. Set `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, and `VITE_OIDC_AUDIENCE` at web-build time; the bundled standards-based authorization-code client attaches the bearer token. The API rejects production header-based identities.
3. Deploy the web static build and API/ClamAV services. The API container executes `alembic upgrade head` before serving traffic.
4. In Cloudflare, allow traffic only to required domains, enforce HTTPS, set a WAF rule that blocks non-Stripe traffic to the webhook only if signature validation remains untouched, and rate-limit `/api/v1/tailor`, URL/file import, and checkout routes by authenticated identity/IP.
5. Register `/health` for liveness and `/ready` for database readiness. Run test-mode Stripe checkout and a real OIDC login against the deployed URLs before switching Stripe to live mode.

## Operations

- Back up Postgres, test restore, and alert on API 5xx/latency and Stripe webhook delivery failures.
- Rotate Anthropic/Stripe/OIDC secrets using the host secret manager. Rotate the Stripe webhook signing secret with overlap rather than downtime.
- Keep ClamAV signatures current and fail closed if the scanner is unhealthy. Review document/upload and model usage costs regularly.

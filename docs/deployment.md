# Production deployment runbook

## Prerequisites

- Managed PostgreSQL reachable only from the API host. Set `DATABASE_URL` to the `postgresql+psycopg://` connection string.
- A public web origin and an API hostname, both behind Cloudflare. Put only the API origin behind Cloudflare Tunnel or a reverse proxy; the provided production Compose binding is loopback-only.
- OIDC provider configuration that issues JWT access tokens for the web app/API.
- Anthropic, Stripe, and Stripe webhook secrets stored only in the hosting secret manager.

## Required environment values

Use `apps/api/.env.production.example` as the template: production web traffic is `https://rezzie.org`, API traffic is `https://api.rezzie.org`, and those exact origins/hosts must be used in `APP_URL`, `ALLOWED_ORIGINS`, and `ALLOWED_HOSTS`. Set `DATABASE_URL`, Firebase token verification values, `ANTHROPIC_API_KEY`, all `STRIPE_*` values, and `CLAMAV_HOST=clamav` when using the provided Compose service. Do not use localhost defaults in production.

## Launch sequence

1. Configure the Stripe Prices and webhook as described in `stripe-setup.md`.
2. Configure Firebase Authentication: enable Google and Email/Password, add `rezzie.org` to Firebase Authorized domains, and set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` at web-build time. Set the Firebase token issuer, project-ID audience, and Google JWKS URL in the API. The API rejects production header-based identities; see `docs/firebase-auth-setup.md`.
3. Deploy the web static build and API/ClamAV services. The API container executes `alembic upgrade head` before serving traffic.
4. In Cloudflare, allow traffic only to required domains, enforce HTTPS, set a WAF rule that blocks non-Stripe traffic to the webhook only if signature validation remains untouched, and rate-limit `/api/v1/tailor`, URL/file import, and checkout routes by authenticated identity/IP.
5. Register `/health` for liveness and `/ready` for database readiness. Run test-mode Stripe checkout and a real OIDC login against the deployed URLs before switching Stripe to live mode.

## Operations

- Back up Postgres, test restore, and alert on API 5xx/latency and Stripe webhook delivery failures.
- Rotate Anthropic/Stripe/OIDC secrets using the host secret manager. Rotate the Stripe webhook signing secret with overlap rather than downtime.
- Keep ClamAV signatures current and fail closed if the scanner is unhealthy. Review document/upload and model usage costs regularly.

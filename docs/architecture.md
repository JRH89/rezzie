# Architecture

## Runtime topology

`React browser -> Cloudflare -> FastAPI -> Claude API`. The browser talks only to the API; all model keys remain server-side except a user’s transient BYOK value in the request body. The current one-instance production deployment stores relational data in a persistent SQLite Docker volume. Original files are not retained; normalized resume text and explicitly saved drafts are private database records. Supabase/Postgres and private object storage are future scale/retention choices.

In production the API validates a standard OIDC bearer access token against `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URL`. Any provider that issues compatible JWT access tokens can be used. The web app needs that provider’s chosen login SDK/configuration to obtain and attach the token; this is intentionally not guessed without a provider decision.

## Modules

- `api/routes`: versioned HTTP boundary and error mapping.
- `api/services`: import, source-grounding, and generation orchestration.
- `api/providers`: Claude/OpenAI interchangeable implementations of `LLMProvider`.
- `api/billing`: Stripe Checkout, verified raw-body webhooks, and an idempotent local entitlement ledger.
- `api/security`: URL validation and credential/entitlement policy.
- `web`: accessible import/tailor workflow; it never calls Anthropic directly.

## Tailoring safety contract

The model receives the original resume as the sole facts source. It may reorganize or tighten wording and surface job-description keywords only when grounded by those facts. It must return a structured `TailoringResult` with a changed-text candidate and a review list. The server rejects malformed output and runs a deterministic grounding floor that blocks new numerical or proper-name-style claims. The prompt requires unsupported requirements to be surfaced as review items, and users must approve every result. A stronger semantic-grounding evaluator remains necessary before treating this as an automated safety guarantee.

`RESUME_TAILORING_MASTER_PROMPT` is the production instruction source. It combines evidence-led summary/skills, experience, and project tailoring but keeps the original resume as the only factual authority. See `docs/master-tailoring-prompt.md`.

## Deployment

Build `apps/web` into static files and serve from Cloudflare Workers static assets or Nginx. Containerize FastAPI behind Cloudflare Tunnel/reverse proxy. Terminate TLS at Cloudflare, restrict API origin CORS, rate-limit import/generation endpoints, protect the SQLite Docker volume with tested backups/restores, and configure secrets only in the host/CI environment. See `docs/sqlite-operations.md`.

The API runs Alembic migrations before Uvicorn starts. The current production value is `DATABASE_URL=sqlite:////data/rezzie.db` on the named Docker volume; schema creation at application startup is permitted only in local development. Use a Supabase/Postgres connection string after a deliberate scale migration.

Billing is webhook-authoritative. Checkout redirects are UI only; `checkout.session.completed`/async success grant one-time credits, `invoice.paid` resets monthly credits, and subscription events update access status. See `docs/stripe-setup.md`.

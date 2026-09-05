# Rezzie

Truth-preserving, AI-assisted resume tailoring for a specific job description. This is a TypeScript React + Python FastAPI monorepo designed to deploy the web app as static assets and the API behind Cloudflare.

## Quick start

1. Copy `apps/api/.env.example` to `apps/api/.env` and add `ANTHROPIC_API_KEY` for subscription-mode generations.
2. Copy `apps/web/.env.example` to `apps/web/.env` for the local development identity.
3. `npm install`
4. `uv sync --directory apps/api`
5. In one terminal: `uv run --directory apps/api uvicorn rezzie.main:app --reload --port 8000`
6. In another: `npm run dev:web`

Use **your own API key** to make a live Claude request without a subscription integration. Subscription mode is deliberately disabled until an authenticated entitlement verifier is connected.

See [architecture](docs/architecture.md), [data model](docs/data-schema.md), and [delivery plan](docs/delivery-plan.md).

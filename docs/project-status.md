# Project status

| Area | Status | Evidence |
| --- | --- | --- |
| Architecture/contracts | done | `docs/architecture.md`, API schemas |
| Truth-preserving generation policy | done | Prompt, structured output, and numeric/named-claim safety guard |
| Latest local verification | done | 20 API tests passed; Ruff clean; web test and production build passed 2026-09-05 |
| Web import/tailor UX | done | React flow; `npm.cmd run check` passed 2026-09-05 |
| API/security contract tests | done | `uv run --directory apps/api pytest` — 6 passed 2026-09-05 |
| Stripe checkout/webhook/credit ledger | done | `docs/stripe-setup.md`; requires account env values and production identity adapter |
| OIDC identity integration | done | Generic OIDC JWT verification and React authorization-code client; provider values required at deployment |
| Durable billing persistence | done | Postgres-ready SQLAlchemy ledger + Alembic migration; managed DB provisioning required |
| PDF/DOCX production extraction | done | PDF/DOCX import with production fail-closed ClamAV scanning |
| Deployment/CI | remaining | CI workflow and production runbook exist; no remote or cloud credentials are configured |
| Hosted Stripe/OIDC/Cloudflare smoke test | blocked | Requires client-controlled domains, provider values, and Stripe test mode |
| Chrome extension | planned | `docs/chrome-extension-roadmap.md`; no implementation started |
| Brand and landing page | done | Native Rezzie mark, responsive conversion landing page, editorial hero asset, and brand system |

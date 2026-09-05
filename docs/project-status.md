# Project status

| Area | Status | Evidence |
| --- | --- | --- |
| Architecture/contracts | done | `docs/architecture.md`, API schemas |
| Truth-preserving generation policy | done | provider prompt + API tests |
| Web import/tailor UX | done | React flow; `npm.cmd run check` passed 2026-09-05 |
| API/security contract tests | done | `uv run --directory apps/api pytest` — 6 passed 2026-09-05 |
| Stripe checkout/webhook/credit ledger | done | `docs/stripe-setup.md`; requires account env values and production identity adapter |
| Real identity/billing/persistence | blocked | External provider and hosting decisions required |
| PDF/DOCX production extraction | blocked | Requires isolated scanner/extraction service |
| Deployment/CI | remaining | No Git remote or cloud credentials in repository |

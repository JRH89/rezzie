# Developer checklist

| Owner | Item | State | Evidence |
| --- | --- | --- | --- |
| Engineering | Keep providers interchangeable | complete | `providers/base.py`, `providers/anthropic.py` |
| Engineering | Do not persist BYOK | complete | request-scoped credentials policy |
| Product/Legal | Define data retention and AI consent | pending | Required before launch |
| Platform | Configure identity + verified subscription webhooks | pending | Required to enable subscription mode |
| Platform | Create Stripe Prices + production webhook | pending | Follow `docs/stripe-setup.md`; store only server-side secrets |
| Platform | Provision Postgres/object storage/secrets/Cloudflare | pending | Required before deployment |
| QA | Run local API/web checks | complete | 2026-09-05: web unit test + production build passed; API pytest: 6 passed; Ruff clean |
| QA | Run hosted smoke tests in provisioned environment | pending | Requires deployment credentials |

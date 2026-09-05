# Developer checklist

| Owner | Item | State | Evidence |
| --- | --- | --- | --- |
| Engineering | Keep providers interchangeable | complete | `providers/base.py`, `providers/anthropic.py` |
| Engineering | Do not persist BYOK | complete | request-scoped credentials policy |
| Product/Legal | Define data retention and AI consent | pending | Required before launch |
| Platform | Configure OIDC identity + verified subscription webhooks | pending | Set issuer, audience, JWKS URL, client ID, and web redirect origin |
| Platform | Create Stripe Prices + production webhook | pending | Follow `docs/stripe-setup.md`; store only server-side secrets |
| Platform | Provision Postgres/object storage/secrets/Cloudflare | pending | Required before deployment |
| QA | Run local API/web checks | complete | 2026-09-05: 24 API tests, 2 web tests, Ruff, ESLint, and production build passed |
| QA | Run hosted smoke tests in provisioned environment | pending | Requires deployment credentials |
| QA | Validate grounding and Stripe lifecycle behavior | complete | API tests cover claim guard, credit idempotency, and monthly renewal grant |
| Engineering | Career Record evidence gate | complete | Imported facts begin `needs_review`; only confirmed facts can be used in record tailoring |

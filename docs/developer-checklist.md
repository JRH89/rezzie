# Developer checklist

| Owner | Item | State | Evidence |
| --- | --- | --- | --- |
| Engineering | Keep providers interchangeable | complete | `providers/base.py`, `providers/anthropic.py` |
| Engineering | Do not persist BYOK | complete | request-scoped credentials policy |
| Product/Legal | Define data retention and AI consent | pending | Required before launch |
| Platform | Configure Firebase identity + verified subscription webhooks | pending | Enable Google and Email/Password, set Firebase web values and API issuer/audience/JWKS URL |
| Platform | Create Stripe Prices + production webhook | pending | Follow `docs/stripe-setup.md`; store only server-side secrets |
| Platform | Provision Postgres/secrets/Cloudflare Tunnel | in progress | Dedicated `rezzie-api` Cloudflare Tunnel is live and API/ClamAV passed public health checks on 2026-09-06. Local SQLite is persisted in the `rezzie_rezzie_api_data` Docker volume; migrate to managed Postgres before higher-concurrency billing use. |
| Platform | Configure Cloudflare Worker frontend | in progress | Root `wrangler.jsonc` supplies static asset directory and SPA fallback; set production build variables and attach `rezzie.org` |
| QA | Run local API/web checks | complete | 2026-09-05: 35 API tests, 5 web interaction tests, Ruff, ESLint, and production build passed |
| Engineering | Preserve usable resume document structure | complete | DOCX/PDF import preserves paragraph/table or layout text; DOCX export is transient and no-store |
| Engineering | Expose signup and managed billing paths | complete | Public pricing section and OIDC-aware account CTA lead into workspace Stripe checkout |
| Engineering | Give signed-in users a billing destination | complete | Workspace Billing control opens account route with balance, checkout, upgrade, and portal actions |
| QA | Run hosted smoke tests in provisioned environment | pending | Requires deployment credentials |
| QA | Validate grounding and Stripe lifecycle behavior | complete | API tests cover claim guard, credit idempotency, and monthly renewal grant |
| Engineering | Career Record evidence gate | complete | Imported facts begin `needs_review`; only confirmed facts can be used in record tailoring |
| Product/Design | Replace prototype workspace UX | complete | Guided four-step responsive flow visually checked at 1280px and 390px widths |

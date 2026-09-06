# Developer checklist

| Owner | Item | State | Evidence |
| --- | --- | --- | --- |
| Engineering | Keep providers interchangeable | complete | `providers/base.py`, `providers/anthropic.py` |
| Engineering | Do not persist BYOK | complete | request-scoped credentials policy |
| Product/Legal | Define data retention and AI consent | pending | Required before launch |
| Platform | Configure Firebase identity + verified subscription webhooks | pending | Enable Google and Email/Password, set Firebase web values and API issuer/audience/JWKS URL |
| Platform | Create Stripe Prices + production webhook | pending | Follow `docs/stripe-setup.md`; store only server-side secrets |
| Platform | Protect SQLite volume/secrets/Cloudflare Tunnel | in progress | Dedicated `rezzie-api` Cloudflare Tunnel is live and API/ClamAV passed public health checks on 2026-09-06. SQLite persists in `rezzie_rezzie_api_data`; execute and record the backup/restore rehearsal in `docs/sqlite-operations.md`. |
| Platform | Configure Cloudflare Worker frontend | in progress | Root `wrangler.jsonc` supplies static asset directory and SPA fallback; set production build variables and attach `rezzie.org` |
| Platform | Automated API deployment | in progress | `deploy.sh` is compatible with the existing Gitea webhook service and rebuilds only Rezzie's API. Create/configure the `rezzie` Gitea repository webhook to POST push events for `main` to `http://192.168.254.54:9001/deploy`. |
| QA | Run local API/web checks | complete | 2026-09-06: 46 API tests, 11 web interaction tests, 6 extension tests, Ruff, ESLint, and web/extension production builds passed |
| Engineering | Preserve usable resume document structure | complete | DOCX/PDF import preserves paragraph/table or layout text; DOCX export is transient and no-store |
| Engineering | Expose signup and managed billing paths | complete | Public pricing section and OIDC-aware account CTA lead into workspace Stripe checkout |
| Engineering | Give signed-in users a billing destination | complete | Workspace Billing control opens account route with balance, checkout, upgrade, and portal actions |
| QA | Run hosted smoke tests in provisioned environment | pending | Requires deployment credentials |
| QA | Validate grounding and Stripe lifecycle behavior | complete | API tests cover claim guard, credit idempotency, and monthly renewal grant |
| Engineering | Career Record evidence gate | complete | Imported facts begin `needs_review`; only confirmed facts can be used in record tailoring |
| Engineering | Resume Library source persistence | complete | `saved_resumes`/`resume_versions` migration, ownership checks, entitlement limits, deletion route, and workspace selection flow |
| Engineering | Saved tailored-draft history | complete | Explicit save-only draft API, private ownership checks, free/paid limits, deletion route, and workspace save action |
| Engineering | Chrome extension shared API shell | complete | Manifest V3 side panel reuses Firebase identity and existing resume/tailor/export routes; browser store configuration remains external |
| Platform | Configure extension Google auth | pending | Build a production extension, add its `chrome-extension://EXTENSION_ID` Firebase authorized domain, set `VITE_CHROME_EXTENSION_IDS` in the Cloudflare Worker, and redeploy the web bridge |
| Engineering | Private source-file and artifact storage | pending | Current normalized source text/drafts are stored in SQLite. Define original-file retention and private object storage separately; see `docs/chrome-extension-roadmap.md` |
| Product/Design | Replace prototype workspace UX | complete | Guided four-step responsive flow visually checked at 1280px and 390px widths |

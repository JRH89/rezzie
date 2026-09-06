# Project status

| Area | Status | Evidence |
| --- | --- | --- |
| Architecture/contracts | done | `docs/architecture.md`, API schemas |
| Truth-preserving generation policy | done | Prompt, structured output, and numeric-claim safety guard; job-description terminology is allowed |
| Latest local verification | done | 41 API tests and 8 web interaction tests passed; Ruff, ESLint, and production build passed 2026-09-06 |
| Web import/tailor UX | done | Guided experience/job/access/review flow with upload, URL import, persisted Career Records, tips, copy, and download |
| API/security contract tests | done | `uv run --directory apps/api pytest` — 6 passed 2026-09-05 |
| Stripe checkout/webhook/credit ledger | done | `docs/stripe-setup.md`; requires account env values and production identity adapter |
| Public signup and pricing UX | done | Landing-page pricing, OIDC-aware account CTA, and workspace credit/subscription checkout controls |
| Signed-in billing flow | done | Account route exposes credit balance, credit-pack checkout, monthly upgrade, and Stripe portal entry point |
| Firebase identity integration | done | Firebase Authentication supports Google and email/password; API verifies Firebase ID tokens after project configuration |
| Authentication navigation | done | Distinct sign-in/sign-up entry points; successful auth enters workspace and sign-out returns to landing |
| Durable billing persistence | done | SQLAlchemy ledger + Alembic migration on the persistent SQLite Docker volume; Supabase/Postgres is the documented future scale path |
| PDF/DOCX production extraction | done | PDF/DOCX import with production fail-closed ClamAV scanning |
| Deployment/CI | in progress | API, ClamAV, and a dedicated Cloudflare Tunnel are running on 2026-09-06; `https://api.rezzie.org/health` and `/ready` passed. The API uses a persistent local SQLite Docker volume; backup/restore rehearsal is documented in `docs/sqlite-operations.md`. |
| Hosted Stripe/OIDC/Cloudflare smoke test | blocked | Requires client-controlled domains, provider values, and Stripe test mode |
| Chrome extension | in progress | Manifest V3 side panel builds locally with guarded active-tab JD extraction and common board selectors, Firebase email/password and Google relay authentication, session-only token storage, saved-resume selection, shared-credit or request-scoped BYOK tailoring, and TXT/PDF/DOCX export; Firebase extension-ID allow-list and Store testing remain external |
| Brand and landing page | done | Native Rezzie mark, responsive conversion landing page, editorial hero asset, and brand system |
| Public SEO content | done | About, Features, FAQ, 23 categorized resume guides, searchable blog, route metadata, structured data, social preview, sitemap, and robots policy |
| Master tailoring prompt | done | Production prompt synthesizes supplied summary/skills, experience, and projects frameworks |
| Career Record MVP | done | Per-user private records, review-gated facts, manual additions, and confirmed-facts-only tailoring |
| Resume Library foundation | done | Authenticated users can explicitly save, list, select, version, and delete private normalized resume sources; free/paid source limits are enforced server-side |
| Saved tailored-draft persistence | done | Users explicitly name and save a private edited draft; ownership and free/paid retention limits are enforced server-side |
| Private source-file objects and artifact storage | planned | Current library persists normalized source text and drafts in SQLite; add private object storage when original file retention is needed |
| Guided workspace UX redesign | done | Responsive four-step workspace, working home navigation, source review, contextual guidance, and result actions |
| Resume document fidelity | done | Structured PDF/DOCX extraction, formatted review preview, and transient editable DOCX export |

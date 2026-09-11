# Project status

| Area | Status | Evidence |
| --- | --- | --- |
| Architecture/contracts | done | `docs/architecture.md`, API schemas |
| Truth-preserving generation policy | done | Haiku 4.5 default with a 4,096-token ceiling, cached stable instructions, JSON-schema output, numeric-claim safety guard, server-date-based tenure handling, and source-summary preservation; job-description terminology is allowed |
| Latest local verification | done | 2026-09-10: section-heading fix passed API Ruff plus 12 focused API tests, web ESLint, 22 web tests, and the web production build. Earlier the same day, 73 API tests passed for provider diagnostics. |
| Web import/tailor UX | done | Guided experience/job/access/review flow with upload, URL import, persisted Career Records, source-summary preservation, tips, copy, and download |
| API/security contract tests | done | `ALLOWED_HOSTS=localhost,127.0.0.1,testserver ALLOWED_ORIGINS=http://localhost:5173 uv run --directory apps/api pytest` — 56 passed 2026-09-06 |
| Stripe checkout/webhook/credit ledger | done | `docs/stripe-setup.md`; requires account env values and production identity adapter |
| Public signup and pricing UX | done | Landing-page pricing, OIDC-aware account CTA, and workspace credit/subscription checkout controls |
| Signed-in billing flow | done | Account route exposes credit balance, credit-pack checkout, monthly upgrade, and Stripe portal entry point |
| Firebase identity integration | done | Firebase Authentication supports Google and email/password; API verifies Firebase ID tokens after project configuration |
| Authentication navigation | done | Distinct sign-in/sign-up entry points; successful auth enters workspace and sign-out returns to landing |
| Durable billing persistence | done | SQLAlchemy ledger + Alembic migration on the persistent SQLite Docker volume; Supabase/Postgres is the documented future scale path |
| PDF/DOCX production extraction | done | PDF/DOCX import with production fail-closed ClamAV scanning; PDF page-count metadata supports export targets |
| Deployment/CI | in progress | API, ClamAV, and a dedicated Cloudflare Tunnel are running on 2026-09-06; `https://api.rezzie.org/health` and `/ready` passed. The API uses a persistent local SQLite Docker volume; backup/restore rehearsal is documented in `docs/sqlite-operations.md`. |
| Hosted Stripe/OIDC/Cloudflare smoke test | blocked | Requires client-controlled domains, provider values, and Stripe test mode |
| Chrome extension | in progress | Manifest V3 side panel includes Rezzie PNG branding, email/password sign-up/sign-in, Google relay authentication, guarded active-tab JD extraction, direct user-selected resume upload, saved-resume selection, shared-credit or request-scoped BYOK tailoring, and TXT/PDF/DOCX export; Firebase extension-ID allow-list, Chrome Web Store screenshots, and Store testing remain external |
| Brand and landing page | done | Native Rezzie mark, responsive conversion landing page, editorial hero asset, and brand system |
| Public SEO content | done | About, Features, FAQ, 23 categorized resume guides, searchable blog, sitemap, robots policy, 10 page-specific social covers, and Cloudflare edge-rewritten canonical, Open Graph, Twitter, and structured-data metadata |
| Master tailoring prompt | done | Production prompt synthesizes supplied summary/skills, experience, and projects frameworks |
| Model-result diagnostics | done | Provider logs only model name, attempt, stop reason, content block types, text length, and contract field categories when Claude returns invalid JSON; no resume, job description, key, or model text is logged. |
| Career Record MVP | done | Per-user private records, review-gated facts, manual additions, and confirmed-facts-only tailoring |
| Trusted Sources and rate limits | done | Subscriber-only public GitHub/portfolio evidence, source-backed 2-credit tailoring, per-line undo/provenance review, SSRF-safe import, and persistent SQLite rate limits; see `docs/trusted-sources.md` |
| Resume Library foundation | done | Authenticated users can explicitly save, list, select, version, and delete private normalized resume sources; free/paid source limits are enforced server-side |
| Saved tailored-draft persistence | done | Users explicitly name and save a private edited draft; ownership and free/paid retention limits are enforced server-side |
| Private source-file objects and artifact storage | planned | Current library persists normalized source text and drafts in SQLite; add private object storage when original file retention is needed |
| Guided workspace UX redesign | done | Responsive four-step workspace, working home navigation, source review, contextual guidance, and result actions |
| Section-heading normalization | done | `SELECTED PROJECTS` is recognized in API, editor, and export formatting; a leading bullet is removed before the generated draft is returned. |
| Resume document fidelity | in progress | Rich-editor formatting survives DOCX/PDF exports; DOCX imports supply a bounded portable style profile for a matching editor/DOCX/PDF output option. Exact template-aware rewriting and source-style persistence for saved resumes still require private original-file storage. See `docs/document-fidelity.md` |
| Private support tickets | done | Authenticated users can create, view, and reply to private tickets; the configured verified Firebase admin email can manage status and respond. No transactional email notifications are sent. |

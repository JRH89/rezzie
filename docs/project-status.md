# Project status

| Area | Status | Evidence |
| --- | --- | --- |
| Architecture/contracts | done | `docs/architecture.md`, API schemas |
| Truth-preserving generation policy | done | Prompt, structured output, and numeric-claim safety guard; job-description terminology is allowed |
| Latest local verification | done | 35 API tests and 5 web interaction tests passed; Ruff, ESLint, and production build passed 2026-09-05 |
| Web import/tailor UX | done | Guided experience/job/access/review flow with upload, URL import, persisted Career Records, tips, copy, and download |
| API/security contract tests | done | `uv run --directory apps/api pytest` — 6 passed 2026-09-05 |
| Stripe checkout/webhook/credit ledger | done | `docs/stripe-setup.md`; requires account env values and production identity adapter |
| Public signup and pricing UX | done | Landing-page pricing, OIDC-aware account CTA, and workspace credit/subscription checkout controls |
| Signed-in billing flow | done | Account route exposes credit balance, credit-pack checkout, monthly upgrade, and Stripe portal entry point |
| Firebase identity integration | done | Firebase Authentication supports Google and email/password; API verifies Firebase ID tokens after project configuration |
| Authentication navigation | done | Distinct sign-in/sign-up entry points; successful auth enters workspace and sign-out returns to landing |
| Durable billing persistence | done | Postgres-ready SQLAlchemy ledger + Alembic migration; managed DB provisioning required |
| PDF/DOCX production extraction | done | PDF/DOCX import with production fail-closed ClamAV scanning |
| Deployment/CI | in progress | Cloudflare Worker static-assets configuration is committed; production Worker, Tunnel, Postgres, and provider values still require setup |
| Hosted Stripe/OIDC/Cloudflare smoke test | blocked | Requires client-controlled domains, provider values, and Stripe test mode |
| Chrome extension | planned | `docs/chrome-extension-roadmap.md`; no implementation started |
| Brand and landing page | done | Native Rezzie mark, responsive conversion landing page, editorial hero asset, and brand system |
| Public SEO content | done | About, Features, FAQ, 23 categorized resume guides, searchable blog, route metadata, structured data, social preview, sitemap, and robots policy |
| Master tailoring prompt | done | Production prompt synthesizes supplied summary/skills, experience, and projects frameworks |
| Career Record MVP | done | Per-user private records, review-gated facts, manual additions, and confirmed-facts-only tailoring |
| Guided workspace UX redesign | done | Responsive four-step workspace, working home navigation, source review, contextual guidance, and result actions |
| Resume document fidelity | done | Structured PDF/DOCX extraction, formatted review preview, and transient editable DOCX export |

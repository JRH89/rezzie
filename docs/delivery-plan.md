# Delivery plan

## Implemented foundation

- React/Tailwind import and tailoring screen.
- FastAPI API contract, text/file/URL job-description imports, SSRF checks, and Claude provider boundary.
- Truth-preserving prompt and structured output validation.
- BYOK versus subscription-mode policy boundary, tests, container handoff, and operational documentation.

## Required before public launch

- Connect a real identity provider and replace `DevelopmentIdentity`.
- Run and record the persistent SQLite backup/restore rehearsal before enabling live billing. Plan the Supabase/Postgres migration when multiple API instances, sustained concurrent writes, or managed point-in-time recovery are needed.
- Configure the included production-fail-closed ClamAV scanner and validate PDF/DOCX extraction in the deployed environment.
- Complete rate limits, abuse monitoring, consent/legal copy, error tracking, accessibility review, and threat model.
- Configure Cloudflare origin restrictions, secrets, SQLite backup/off-host encryption, CI/CD, and production smoke tests.

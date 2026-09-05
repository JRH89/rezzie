# Delivery plan

## Implemented foundation

- React/Tailwind import and tailoring screen.
- FastAPI API contract, text/file/URL job-description imports, SSRF checks, and Claude provider boundary.
- Truth-preserving prompt and structured output validation.
- BYOK versus subscription-mode policy boundary, tests, container handoff, and operational documentation.

## Required before public launch

- Connect a real identity provider and replace `DevelopmentIdentity`.
- Implement Postgres/object storage repositories, encryption/retention/deletion, and audited billing-webhook entitlement verification.
- Configure the included production-fail-closed ClamAV scanner and validate PDF/DOCX extraction in the deployed environment.
- Complete rate limits, abuse monitoring, consent/legal copy, error tracking, accessibility review, and threat model.
- Configure Cloudflare origin restrictions, secrets, managed database/backups, CI/CD, and production smoke tests.

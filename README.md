# Rezzie

**Rezzie is a truth-preserving AI resume tailoring platform.** A candidate supplies a resume and a target job description; Rezzie produces an editable, job-focused draft that improves relevance without inventing experience, metrics, qualifications, employers, or credentials.

Live product: [rezzie.org](https://rezzie.org) · API: [api.rezzie.org/health](https://api.rezzie.org/health)

## Why this project exists

Most resume tools optimize for keyword density alone. Rezzie treats a resume as a source of record: it helps candidates frame their genuine experience around an employer's language and priorities while retaining a clear boundary against fabricated claims.

The project demonstrates a production-minded, full-stack approach to an AI product: typed UI flows, a service-oriented API, identity and billing integration, private user data, document processing, third-party API safety, and deployable infrastructure.

## What it does

- Imports resumes and job descriptions from text, Markdown, PDF, DOCX, file upload, or supported public URLs.
- Uses Claude to tailor content toward a specific role while applying grounding and claim-safety rules.
- Provides a rich editor plus TXT, PDF, and editable DOCX exports.
- Supports Firebase email/password and Google authentication.
- Offers Stripe credit packs and a monthly plan, backed by a server-side credit ledger and webhook handling.
- Lets subscribers add owned public GitHub or portfolio pages as **Trusted Sources**, with SSRF-safe retrieval, provenance, per-change review, and undo controls.
- Saves private resume sources and tailored drafts for authenticated users, subject to server-enforced limits.
- Includes a Chrome MV3 side-panel extension that extracts public job descriptions and uses the same API, account, saved resumes, and credits as the web app.

## Architecture

```text
React + TypeScript                    Cloudflare Workers static assets
apps/web                  ────────►   https://rezzie.org
     │
     │ Firebase ID token / HTTPS
     ▼
FastAPI + Python                      Cloudflare Tunnel
apps/api                  ────────►   https://api.rezzie.org
     │                                      │
     ├── SQLAlchemy + Alembic                └── Arch server (Docker)
     ├── Persistent SQLite volume
     ├── Anthropic Claude provider
     ├── Stripe Checkout + webhooks
     ├── Firebase JWT verification
     └── ClamAV document scanning

Chrome MV3 extension (apps/extension) ─────► same authenticated API
```

### Repository layout

| Path | Responsibility |
| --- | --- |
| `apps/web` | React, TypeScript, Vite, Tailwind-based product and marketing site |
| `apps/api` | FastAPI application, SQLAlchemy models, Alembic migrations, business services, API tests |
| `apps/extension` | Chrome Manifest V3 side-panel job-description workflow |
| `docs` | Architecture, deployment, data model, billing, safety, and operational runbooks |
| `docker-compose.production.yml` | One-instance production API, ClamAV, SQLite volume, and Cloudflare Tunnel topology |

## Engineering highlights

### AI safety and data boundaries

- The generated draft is constrained by a master tailoring prompt and deterministic claim-safety checks.
- Candidate-provided Anthropic keys are request-scoped: never stored, returned, or written to application logs.
- Managed generation uses a server-only provider key after a server-side credit or subscription entitlement check.
- Trusted Sources require an ownership attestation, accept only bounded public HTML, block unsafe network targets, and surface source-backed changes to the candidate.
- Resume text, job descriptions, drafts, URLs, and secrets are treated as sensitive data. The repository does not contain production keys or customer documents.

### Backend design

- FastAPI route handlers stay thin; document extraction, entitlement, billing, source retrieval, rate limiting, and LLM orchestration are separated into services and repositories.
- Provider selection is isolated behind an `LLMProvider` interface, leaving room for another model provider without changing tailoring flows.
- SQLAlchemy and Alembic provide durable user-scoped records, credit events, subscription state, resumes, versions, saved drafts, sources, and persistent rate-limit windows.
- Stripe webhook processing is idempotent; webhook state—not browser redirect state—is authoritative for credit grants and subscription renewals.
- URL imports use allow-lists, size limits, timeouts, redirect limits, and SSRF protections. Production file import fails closed when malware scanning is unavailable.

### Frontend and product design

- A responsive, guided four-step workflow reduces ambiguous AI interactions: experience, job, tailoring settings, and review.
- The editor makes generated content reviewable before export, and source-backed changes can be individually undone.
- The public site includes dedicated feature, safety, pricing, FAQ, and searchable blog pages with metadata, structured data, social previews, sitemap, and robots policy.
- The Chrome extension shares the web app's authentication and API contracts instead of maintaining a duplicate backend.

## Stack

| Layer | Technology |
| --- | --- |
| Web | React, TypeScript, Vite, Tailwind CSS |
| API | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| AI | Anthropic Claude Sonnet 5 by default, via a provider abstraction |
| Identity | Firebase Authentication and Firebase JWT verification |
| Billing | Stripe Checkout, Customer Portal, signed webhooks, credit ledger |
| Documents | PDF/DOCX parsing, ClamAV scanning, TXT/PDF/DOCX export |
| Infrastructure | Docker Compose, Cloudflare Workers, Cloudflare Tunnel, SQLite persistent volume |
| Browser extension | Chrome Manifest V3, React, shared API contracts |
| Quality | Pytest, Ruff, Vitest, Testing Library, ESLint, TypeScript production builds |

## Local development

Requirements: Node.js, npm, [uv](https://docs.astral.sh/uv/), and Python supported by the API project.

```bash
git clone https://github.com/JRH89/rezzie.git
cd rezzie
npm install
uv sync --directory apps/api
```

Create local, ignored configuration files from the examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Start the API:

```bash
uv run --directory apps/api uvicorn --app-dir src rezzie.main:app --reload --port 8000
```

Start the web app in another terminal:

```bash
npm run dev:web
```

For local BYOK testing, provide a key in the UI for a request-scoped Claude call. Do not commit API keys or copy production environment files into the repository.

## Verification

```bash
uv run --directory apps/api ruff check src tests
uv run --directory apps/api pytest
npm run lint --workspace @rezzie/web
npm run test --workspace @rezzie/web
npm run build --workspace @rezzie/web
npm run lint --workspace @rezzie/extension
npm run test --workspace @rezzie/extension
npm run build --workspace @rezzie/extension
```

The current project status and verification record live in [docs/project-status.md](docs/project-status.md). Before contributing, read [AGENTS.md](AGENTS.md), which documents the truth-preserving and secret-handling rules.

## Deployment and operations

The web application deploys as Cloudflare Worker static assets. The API is a Docker Compose deployment on a single server behind a Cloudflare Tunnel; it is not exposed directly to the public internet. SQLite is intentional for the current single-instance topology and is backed by a named Docker volume, with documented backup and restore procedures.

Production configuration uses environment variables only. The repository includes safe templates and deployment checklists, never production values.

- [Server deployment runbook](docs/server-deployment.md)
- [SQLite operations](docs/sqlite-operations.md)
- [Stripe setup](docs/stripe-setup.md)
- [Trusted Sources design](docs/trusted-sources.md)
- [Chrome extension roadmap](docs/chrome-extension-roadmap.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-schema.md)

## Product roadmap

Near-term engineering work is focused on hosted end-to-end smoke tests, Chrome Web Store publication, and private object storage for optional original-file retention. A managed Postgres migration is planned only when the single-instance SQLite deployment no longer fits concurrency or recovery needs.

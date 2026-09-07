# Rezzie engineering rules

Before starting deployment or continuing work on another machine, read `docs/next-machine-handoff.md`, `docs/project-status.md`, and `docs/developer-checklist.md` in addition to this file.

## Product boundaries

- Rezzie tailors a candidate's existing resume to a job description. It must never invent employers, titles, dates, qualifications, metrics, certifications, tools, or achievements.
- Treat uploaded resumes, job descriptions, URLs, API keys, and generated content as sensitive personal data. Do not log their contents or secrets.
- Anthropic Claude is the initial production provider; provider selection must remain behind the `LLMProvider` interface so OpenAI can be enabled without feature rewrites.
- A user-provided key is transient: it is accepted per request, never persisted, never returned, and never exposed to browser logs. Subscription use selects a server-only master key after a server-side entitlement check.

## Architecture and code standards

- Keep the monorepo split into `apps/web` (React + TypeScript) and `apps/api` (FastAPI + Python). Share contracts via OpenAPI-generated types or explicit versioned JSON schemas; do not duplicate request shapes ad hoc.
- Use dependency injection at API edges and protocols/interfaces for storage, entitlement, document extraction, and LLM providers. Route handlers stay thin; business rules live in services.
- Follow SOLID, DRY, OWASP guidance, and least privilege. Validate all untrusted input at the edge. Use allow-lists, size limits, timeouts, and SSRF protections for URL imports.
- Prefer small, composable, typed functions. Do not use `any` in TypeScript or mutable module-level application state in Python.
- Never commit `.env`, real keys, customer documents, generated resumes, or production connection strings.

## Testing and verification

- Add unit tests for deterministic business rules and API integration tests for every externally visible route/negative path. Add browser tests for major user flows once the UI is stable.
- Run the relevant formatter, type checker, unit tests, and production build before claiming a change is verified. Report missing toolchain/dependency access as a blocker, never as a pass.
- Maintain `docs/project-status.md` and `docs/developer-checklist.md` with evidence and outstanding external decisions.


# Pushing to prod

Always push to both remotes (gitea, origin)
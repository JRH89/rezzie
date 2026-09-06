# Rezzie: next-machine / next-agent handoff

Read this document and `AGENTS.md` before changing code or deploying. It is intentionally secret-safe: values named below are placeholders, never values to copy from a prior machine.

## Project purpose and non-negotiable rules

Rezzie tailors an existing resume to one job description. It must not invent any employer, title, date, qualification, metric, tool, certification, or achievement. Resume content, job descriptions, URLs, API keys, and generated drafts are sensitive personal data: never log or commit them.

The repository is public at `https://github.com/JRH89/rezzie.git`, branch `main`. Do a tracked-file secret audit before every push. `.env` is ignored; do not force-add it.

## Current architecture

```text
React + TypeScript (apps/web) ── Cloudflare Pages ── https://rezzie.org
                                                     │
                                                     │ HTTPS / CORS
                                                     ▼
FastAPI + ClamAV (apps/api) ── Cloudflare Tunnel ── https://api.rezzie.org
                                                     │
                                                     ▼
                                               Managed Postgres

Firebase Authentication ── Firebase ID token ── FastAPI JWT verification
Stripe Checkout/Webhooks ── FastAPI credit ledger in Postgres
Anthropic Claude Haiku 4.5 ── server master key or transient user BYOK
```

The intended production target is the user's **Arch/Omarchy server** for API, ClamAV, and Cloudflare Tunnel. The development machine is not the server. The frontend belongs on Cloudflare Pages. Do not open the API directly to the internet; Tunnel is the sole public route.

## Current state

### Implemented and locally verified

- Claude provider defaults to `claude-haiku-4-5`; JSON parsing, structured-output fallback, request repair, and numeric-claim fallback are tested.
- Keyword tailoring is allowed. The prior named-claim hard failure was removed because it blocked legitimate JD wording.
- Resume/job import accepts text, Markdown, PDF, and DOCX. DOCX/PDF extraction preserves useful text structure; production upload scanning fails closed unless ClamAV is configured.
- Result includes a rich in-browser editor and TXT, PDF, and editable DOCX exports.
- Firebase web auth supports Google popup sign-in, email/password signup/sign-in, password reset, session restore, and sign-out.
- Stripe checkout, webhook handling, credit ledger, and subscription credit renewal are implemented; no live Stripe resources are configured.
- Public pricing and account CTAs exist.
- Warm cream / espresso / taupe visual system is active.
- Latest verified checks before this handoff: 35 API tests, 4 web tests, Ruff, ESLint, and web production build.

### Not done / external dependencies

- No production deployment exists yet.
- No managed Postgres database, Cloudflare Tunnel, Pages project, Stripe Products/Prices/webhook, or Firebase production-domain configuration is confirmed.
- No hosted end-to-end test has occurred.
- Chrome extension is planned only: `docs/chrome-extension-roadmap.md`.

## Local development on a new machine

```bash
git clone https://github.com/JRH89/rezzie.git
cd rezzie
npm install
uv sync --directory apps/api
```

Create ignored files from templates:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

For ordinary BYOK development, set only `ANTHROPIC_API_KEY` in `apps/api/.env` if testing server-managed mode, or use the UI’s request-scoped key input. Keep `ENVIRONMENT=development`; do not put production values in the local file.

Run API:

```bash
uv run --directory apps/api uvicorn --app-dir src rezzie.main:app --reload --port 8000
```

Run web:

```bash
npm run dev:web
```

Run verification:

```bash
uv run --directory apps/api ruff check src tests
uv run --directory apps/api pytest
npm run lint --workspace @rezzie/web
npm run test --workspace @rezzie/web
npm run build --workspace @rezzie/web
```

## Firebase production setup

The user already enabled Google and Email/Password in Firebase and added Firebase values on their development machine. Do not ask them to paste values into chat or commit them.

1. In Firebase Authentication, add `rezzie.org` to **Authorized domains**.
2. In Cloudflare Pages production environment variables, set:

```env
VITE_API_BASE_URL=https://api.rezzie.org
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

3. On the server, set API token verification values in `apps/api/.env`:

```env
OIDC_ISSUER=https://securetoken.google.com/YOUR_FIREBASE_PROJECT_ID
OIDC_AUDIENCE=YOUR_FIREBASE_PROJECT_ID
OIDC_JWKS_URL=https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
```

The API uses Firebase ID tokens as bearer tokens. The web configuration identifiers are public; the Firebase Admin SDK/service-account key must never be needed by this app and must never enter the repo.

## Production deployment order

Use `apps/api/.env.production.example` as a values checklist, but create the real `apps/api/.env` only on the server with restrictive permissions.

### A. Provision Postgres

Use managed Postgres (recommended) rather than Firestore. This application needs relational transactions for entitlements/credits. Store the SSL connection string as `DATABASE_URL`; use a pooler/serverless-safe connection option if the provider offers one.

### B. Prepare the Arch/Omarchy server

Run these commands **on the server only**, after SSHing into it:

```bash
sudo pacman -Syu docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in. Clone the repository into a server-owned directory, create `apps/api/.env`, and fill all production values. Never copy `.env` from the development machine into Git.

Start services:

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f api cloudflared
```

The API binds to `127.0.0.1:8000`; ClamAV is internal; `cloudflared` receives its token from the server `.env` and publishes the API over an outbound tunnel.

### C. Create the Cloudflare Tunnel

In Cloudflare Zero Trust, create a managed tunnel for the server. Put its token only in server `apps/api/.env` as `CLOUDFLARE_TUNNEL_TOKEN`. Configure public hostname:

```text
api.rezzie.org  →  http://api:8000
```

Confirm from outside the server:

```text
https://api.rezzie.org/health
https://api.rezzie.org/ready
```

Both must be healthy before connecting frontend billing.

### D. Deploy frontend with Cloudflare Pages

Connect the GitHub repository in **Workers & Pages → Pages**. Configure:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | repository root |
| Build command | `npm run build` |
| Output directory | `apps/web/dist` |

Set the Firebase values plus `VITE_API_BASE_URL=https://api.rezzie.org` in Pages production environment variables. Attach `rezzie.org` via Pages Custom Domains. Optionally attach `www.rezzie.org` and redirect it to apex.

## Stripe production setup

Follow `docs/stripe-setup.md` in **test mode first**. Create one-time credit Pack Price(s) and one recurring monthly Price. Set:

```env
# Server only
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_SUBSCRIPTION_PRICE_ID=price_...
STRIPE_SUBSCRIPTION_MONTHLY_CREDITS=20
STRIPE_CREDIT_PACKS={"price_...":5}

# Cloudflare Pages build environment
VITE_CREDIT_PACK_PRICE_ID=price_...
VITE_CREDIT_PACK_CREDITS=5
VITE_SUBSCRIPTION_PRICE_ID=price_...
```

Webhook URL:

```text
https://api.rezzie.org/api/v1/billing/webhook
```

Required event set is in `docs/stripe-setup.md`. Stripe webhook state—not a checkout success redirect—is authoritative for credits.

## Public-repository safety checklist

Before push:

```bash
git status --short
git grep -n -I -E '(sk-ant-[A-Za-z0-9_-]{12,}|whsec_[A-Za-z0-9]{12,}|sk_(live|test)_[A-Za-z0-9]{12,}|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY)' HEAD -- ':!apps/api/tests/**' ':!docs/**'
git ls-files | rg '(^|/)(\.env|.*\.pem|.*\.key)$'
```

The expected result is no real secret hits and no tracked `.env`/key files. Documentation and unit tests intentionally mention placeholder formats such as `whsec_...`; do not mistake placeholders for credentials.

## First hosted smoke test (required before live Stripe)

1. Open `https://rezzie.org`.
2. Create an email/password account and sign in with Google.
3. Upload a harmless sample DOCX/PDF, paste a sample job description, and test BYOK tailoring.
4. Test one credit-pack checkout in Stripe test mode; confirm webhook delivery and exactly one grant.
5. Test a subscription checkout, renewal event, credit balance, failed-model refund, DOCX/PDF/TXT exports, and sign out/sign in.
6. Inspect server logs to ensure no resume text, JD content, or keys are logged.
7. Only after all pass, create live Stripe Prices and swap test keys for live keys.

## Agent-specific guidance

- Read `AGENTS.md`, this file, `docs/project-status.md`, and `docs/developer-checklist.md` first.
- Preserve existing user changes. Do not reset, force-push, or commit secrets.
- Do not claim deployment success until a real hosted smoke test succeeds.
- Treat a missing Firebase/Stripe/Cloudflare credential as an external configuration blocker, not a coding defect.
- Keep new provider work behind the existing `LLMProvider` protocol.
- If changing public auth, billing, or upload behavior, add API negative-path tests and web-flow tests.

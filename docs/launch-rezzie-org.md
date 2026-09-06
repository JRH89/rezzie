# Launching Rezzie on `rezzie.org`

## Architecture

- **Cloudflare Workers static assets** serves the static React app at `https://rezzie.org`.
- **Your server** runs the API and ClamAV with `docker-compose.production.yml`.
- **Cloudflare Tunnel** runs beside the API and publishes `https://api.rezzie.org` to `http://api:8000` inside the Compose network. The server does not need an inbound port opened for the API.
- **Persistent SQLite** stores billing accounts, credit grants, Career Records, saved resumes, and drafts while Rezzie runs as one API instance. Firebase is used solely for authentication. Follow [SQLite operations](sqlite-operations.md) for backups and restore rehearsals; move to Supabase/Postgres when concurrency or managed recovery warrants it.

## 1. Make the public repository

Before pushing, create a **public empty** GitHub repository (recommended name: `rezzie`) without a README, `.gitignore`, or license. The local audit found no tracked real API keys, Stripe secrets, Firebase private keys, or `.env` files. Do not add real secrets to GitHub; `.env` remains ignored.

Then add the provided repository URL as `origin` and push `main` only after reviewing the final `git status` and secret scan.

## 2. Deploy the frontend with Cloudflare Workers

In Cloudflare: **Workers & Pages → Create application → Workers → Import a Git repository**. Select the repository and configure:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Root directory | repository root |

There is intentionally no output-directory field: [`wrangler.jsonc`](../wrangler.jsonc) declares `apps/web/dist` as the Worker static-assets directory and enables SPA route fallback.

Add these production environment variables:

```env
VITE_API_BASE_URL=https://api.rezzie.org
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_CREDIT_PACK_PRICE_ID=price_...
VITE_CREDIT_PACK_CREDITS=5
VITE_SUBSCRIPTION_PRICE_ID=price_...
```

After the first successful build, add `rezzie.org` (and optionally `www.rezzie.org`) under the Worker’s **Settings → Domains & Routes**. Set a redirect from `www.rezzie.org` to `rezzie.org`.

## 3. Deploy the API on your server

1. Install Docker Engine and Docker Compose on the server.
2. Clone the repository there and create `apps/api/.env` from `apps/api/.env.production.example` using server-only secrets.
3. Keep the provided persistent SQLite volume and complete the [backup/restore steps](sqlite-operations.md) before enabling live billing. Supabase/Postgres is a future migration, not a current requirement.
4. In Cloudflare Zero Trust, create a **managed tunnel**, install/copy its token, and add it as `CLOUDFLARE_TUNNEL_TOKEN` in the server `.env`.
5. Configure the tunnel public hostname: `api.rezzie.org` → `http://api:8000`.
6. Start the services with `docker compose -f docker-compose.production.yml up -d --build`.
7. Confirm `https://api.rezzie.org/health` and `/ready` return success before enabling checkout.

## 4. Complete providers

- Firebase: add `rezzie.org` to Authorized domains; enable Google and Email/Password. See `firebase-auth-setup.md`.
- Stripe: create test Prices first, add the webhook at `https://api.rezzie.org/api/v1/billing/webhook`, then follow `stripe-setup.md`.
- Cloudflare: keep the API behind Tunnel, enable HTTPS, and add rate limits for API imports, tailoring, and checkout.

## Launch gate

Run a real production smoke test: email signup, Google login, BYOK tailoring, subscription checkout, webhook delivery, credit consumption, and DOCX/PDF download. Only then activate Stripe live mode.

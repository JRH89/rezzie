# Production API server setup

This runbook deploys Rezzie's FastAPI API, ClamAV scanner, and Cloudflare Tunnel to the Arch/Omarchy server. The React site stays on Cloudflare Workers at `https://rezzie.org`. The server exposes no direct public port: Cloudflare Tunnel is the only route to `https://api.rezzie.org`.

Do these steps **on the server**, not the development PC. Do not paste any secret into Git, a terminal recording, or chat.

## 1. Prerequisites

You need these accounts and values before starting:

- The persistent SQLite volume declared in `docker-compose.production.yml`, plus a tested backup/restore process. See [`sqlite-operations.md`](sqlite-operations.md).
- Firebase project ID (not an Admin SDK/service-account key).
- Anthropic server API key for managed-credit users.
- Stripe test-mode secret key, webhook signing secret, and the two Price IDs.
- A Cloudflare account that owns `rezzie.org` and can create a Zero Trust Tunnel.

Install Docker, enable it at boot, then log out and back in so your user receives the Docker group membership:

```bash
sudo pacman -Syu docker docker-compose git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Confirm the new login can use Docker without `sudo`:

```bash
docker version
docker compose version
```

## 2. Clone and create the server-only environment file

Use a server-owned folder. The example below uses `/opt/rezzie`; change it only if you consistently use another deployment directory.

```bash
sudo mkdir -p /opt/rezzie
sudo chown "$USER":"$USER" /opt/rezzie
git clone https://github.com/JRH89/rezzie.git /opt/rezzie
cd /opt/rezzie
cp apps/api/.env.production.example apps/api/.env
chmod 600 apps/api/.env
```

Edit `apps/api/.env` with `nano` or your preferred editor. It is ignored by Git and must remain on this server only.

```env
ENVIRONMENT=production
APP_URL=https://rezzie.org
ALLOWED_ORIGINS=https://rezzie.org
ALLOWED_HOSTS=api.rezzie.org

# Firebase ID-token verification. Use your Firebase Project ID in both fields.
OIDC_ISSUER=https://securetoken.google.com/YOUR_FIREBASE_PROJECT_ID
OIDC_AUDIENCE=YOUR_FIREBASE_PROJECT_ID
OIDC_JWKS_URL=https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com

# Current one-instance deployment. Keep this database in Docker's named volume.
DATABASE_URL=sqlite:////data/rezzie.db

# Managed Rezzie usage only. BYOK users do not consume this key.
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME

# Stripe test mode first.
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
STRIPE_SUBSCRIPTION_PRICE_ID=price_MONTHLY_999
STRIPE_SUBSCRIPTION_MONTHLY_CREDITS=50
STRIPE_CREDIT_PACKS={"price_CREDITS_500":20}

# Keep these exact values for the internal ClamAV container.
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
RATE_LIMIT_SALT=replace-with-a-long-random-secret

# Added after creating the Cloudflare managed tunnel in step 4.
CLOUDFLARE_TUNNEL_TOKEN=REPLACE_ME
```

Never put `VITE_*` values, Firebase Admin credentials, or a Cloudflare API token in this file. The frontend's public `VITE_*` values belong in the Cloudflare Worker build configuration.

## 3. Confirm persistent SQLite operations

The current single-instance deployment uses the named SQLite Docker volume. Keep `DATABASE_URL=sqlite:////data/rezzie.db` and complete the backup/restore rehearsal in [`sqlite-operations.md`](sqlite-operations.md) before enabling live billing. Do not copy the database or backups into the repository. Use Supabase/Postgres later when Rezzie needs multiple API instances, sustained concurrent writes, or managed point-in-time recovery.

The API container runs `alembic upgrade head` before Uvicorn starts, so the initial database tables and later migrations are applied automatically. A failed migration prevents the API from starting, which is intentional.

## 4. Create the Cloudflare Tunnel

In **Cloudflare Zero Trust**:

1. Open **Networks → Tunnels → Create a tunnel** and choose a Cloudflared-managed tunnel.
2. Name it `rezzie-api` and copy the Docker token Cloudflare gives you.
3. Paste the token into `CLOUDFLARE_TUNNEL_TOKEN` in `/opt/rezzie/apps/api/.env`.
4. Add a public hostname:

   ```text
   Subdomain: api
   Domain: rezzie.org
   Service type: HTTP
   URL: http://api:8000
   ```

`api` is the Docker service name from `docker-compose.production.yml`. Do not make a manual A, AAAA, or CNAME record for `api.rezzie.org`; the Tunnel hostname configuration manages its route.

## 5. Start the production stack

From `/opt/rezzie`:

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 api clamav cloudflared
```

Expected state:

- `api`, `clamav`, and `cloudflared` are running.
- The API listens only on `127.0.0.1:8000`; do **not** add a firewall rule for port 8000.
- ClamAV remains internal to Docker and production uploads fail closed if it is unavailable.
- Cloudflared creates the outbound connection to Cloudflare.

Verify locally on the server, then from another network:

```bash
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:8000/ready
curl --fail https://api.rezzie.org/health
curl --fail https://api.rezzie.org/ready
```

Both endpoints must return `{"status":"ok"}` or `{"status":"ready"}` before you set the frontend production API URL or configure Stripe's webhook.

## 6. Connect Firebase and the frontend

In Firebase Authentication, add `rezzie.org` to **Authorized domains**. In the Cloudflare Worker build variables, set:

```env
VITE_API_BASE_URL=https://api.rezzie.org
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_CREDIT_PACK_PRICE_ID=price_CREDITS_500
VITE_CREDIT_PACK_CREDITS=20
VITE_SUBSCRIPTION_PRICE_ID=price_MONTHLY_999
```

Redeploy the Worker after changing build variables. These `VITE_*` values are browser-visible identifiers; Stripe secret keys, webhook secrets, the Anthropic key, database URL, and Tunnel token are never browser values.

## 7. Configure Stripe after the API is healthy

In Stripe **test mode**, create:

- A one-time `Rezzie credits` Price: **$5.00**, mapped to **20** credits. Users can choose 1–10 packs in one checkout (20–200 credits).
- A recurring `Rezzie monthly` Price: **$9.99/month**, mapped to **50** credits per successful billing period.

Put the Price IDs in the server and Worker variables shown above. Create a webhook with this public endpoint:

```text
https://api.rezzie.org/api/v1/billing/webhook
```

Select these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`, then restart the stack:

```bash
docker compose -f docker-compose.production.yml up -d
```

Use Stripe's `4242 4242 4242 4242` test card for initial checkout smoke tests. Credits are authoritative only after the signed webhook updates the server-side ledger—not when the browser returns from Checkout.

## 8. Deploy updates and diagnose issues

For a normal update:

```bash
cd /opt/rezzie
git pull --ff-only origin main
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
```

For a failing API or Tunnel, inspect metadata only; do not copy resume text, job descriptions, API keys, headers, or webhook payloads into issue reports:

```bash
docker compose -f docker-compose.production.yml logs --tail=200 api
docker compose -f docker-compose.production.yml logs --tail=200 cloudflared
docker compose -f docker-compose.production.yml logs --tail=200 clamav
```

Before the first live Stripe charge, complete the hosted smoke test in `docs/next-machine-handoff.md` with Stripe test keys. Only then create live Prices, switch the server to live Stripe credentials, update the Worker’s public live Price IDs, and run the same smoke test once more.

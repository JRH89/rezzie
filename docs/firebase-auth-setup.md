# Firebase Authentication setup

1. Create or select a Firebase project, then register a **Web app**.
2. In **Authentication → Sign-in method**, enable **Google** and **Email/Password**.
3. In **Authentication → Settings → Authorized domains**, add `rezzie.org` and `localhost` for local development.
4. Copy the Web app configuration values into `apps/web/.env` as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. These identifiers are intended for client configuration; do not put Admin SDK credentials in the web app.
5. Configure the API to validate Firebase ID tokens using `apps/api/.env.production.example` as the safe template. The public site is `https://rezzie.org` and the API is expected at `https://api.rezzie.org`.

```env
ENVIRONMENT=production
OIDC_ISSUER=https://securetoken.google.com/YOUR_FIREBASE_PROJECT_ID
OIDC_AUDIENCE=YOUR_FIREBASE_PROJECT_ID
OIDC_JWKS_URL=https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
```

6. Restart both applications. Test new email/password signup, Google signup, password reset, sign out, a protected Career Record request, and a Stripe checkout as the signed-in user.

Firebase ID tokens use the Firebase project ID as their audience and `https://securetoken.google.com/<projectId>` as their issuer. The API verifies the token before it authorizes records or managed credits.

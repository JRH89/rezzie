# Chrome extension setup

The extension is a Manifest V3 side panel. It reads the active job-description page only after the user clicks **Read this job page**, then sends the extracted text to the same Rezzie API used by the web app. Saved resumes, credits, and subscriptions stay account-scoped because the API remains the authority.

## Build locally

Create the ignored extension configuration from its template:

```bash
cp apps/extension/.env.example apps/extension/.env
```

Use the same public Firebase identifiers as the web app and the public API URL:

```env
VITE_API_BASE_URL=https://api.rezzie.org
VITE_WEB_BASE_URL=https://rezzie.org
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Then build and load `apps/extension/dist` from Chrome's `chrome://extensions` page using **Developer mode** and **Load unpacked**. The side panel supports Google sign-in plus email/password sign-in and account creation. Copy the generated extension ID; it changes if the extension is not built with a stable signing key, so do not configure production auth from a temporary development ID.

The extension asks Chrome for page access only on supported job boards and applicant-tracking systems: Indeed, LinkedIn, Built In and Built In LA, Greenhouse, Lever, Ashby, Workday, Jack and Jill Jobs, Dice, ZipRecruiter, Monster, CareerBuilder, SimplyHired, Wellfound, FlexJobs, Idealist, Jobcase, Snagajob, USAJOBS, GovernmentJobs, SmartRecruiters, iCIMS, Jobvite, BambooHR, Paylocity, Paycom, UKG, SuccessFactors, Taleo, Dayforce, Recruitee, Teamtailor, Personio, and Rippling. It reads a listing only after the user selects **Read this job page**. Accept Chrome's updated permission prompt after reloading an unpacked build; it does not receive broad access to unrelated sites.

## Enable production Google sign-in

Email/password sign-in uses the Firebase extension SDK. Google sign-in is deliberately relayed through `https://rezzie.org/extension-auth`, which only returns a Firebase token to explicitly allow-listed extension origins.

After creating the production extension package and obtaining its stable ID:

1. In Firebase Authentication, add `chrome-extension://EXTENSION_ID` to **Authorized domains**.
2. In the Cloudflare Worker production build variables for `rezzie.org`, set `VITE_CHROME_EXTENSION_IDS=EXTENSION_ID`. For more than one approved build, use a comma-separated list.
3. Redeploy the web Worker so the `/extension-auth` bridge receives the allow-list at build time.
4. Reload the unpacked/production extension, sign in with Google, select a saved resume, and tailor a harmless test job. Confirm the API request uses the account's existing credit balance.

Never place Stripe, Anthropic, Firebase Admin, or API-secret values in the extension. Firebase's web configuration values are public identifiers; the extension's authentication token is retained only in `chrome.storage.session` and is cleared on sign-out or expiry.

## Package for Chrome Web Store

Chrome Web Store accepts a ZIP archive, not a `.vsix` file. Build before packaging; the ZIP must contain the contents of `dist` at its root, including `manifest.json`.

```powershell
npm.cmd --workspace @rezzie/extension run build
New-Item -ItemType Directory -Force artifacts
Compress-Archive -Path apps/extension/dist/* -DestinationPath artifacts/rezzie-chrome-extension-0.1.1.zip -Force
```

`artifacts/` is ignored by Git so the release upload is not committed. Upload that ZIP in Chrome Web Store Developer Dashboard.

## Store release checklist

- The production PNG icon set and Rezzie wordmark are included in the extension package. Add Chrome Web Store listing screenshots.
- Use a stable extension ID and complete the Firebase/Worker allow-list steps above.
- Verify extraction on at least two job boards plus a generic career page; the user must be able to review/edit all extracted text before tailoring.
- Verify no-resume, no-credit, expired-token, API-error, and export paths.
- Publish a privacy disclosure covering job-page text, saved resume text, generated drafts, retention, and deletion.

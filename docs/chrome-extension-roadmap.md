# Chrome extension roadmap: tailor from a job page

## Outcome

From a supported job board or any job-description page, a signed-in Rezzie user can open the extension, review extracted job text, select an existing private resume, generate a truth-preserving tailored draft, review it, and download a `.docx` or `.pdf` version for the application. The extension must never auto-submit an application or silently replace a resume on a third-party site.

This is deliberately the last product surface to build. Rezzie first needs a durable, privacy-reviewed resume library and tailoring-history API that both the existing web workspace and the extension use. The extension is a new client of that API, not a second tailoring or billing implementation.

## Product decisions

### Identity, credits, and BYOK

- The web app and extension authenticate as the same Firebase user. Both send that Firebase ID token to the existing Rezzie API, so the API's existing Postgres billing ledger remains the only authority for purchased credits and subscription credits.
- Credit packs and subscriptions are account entitlements, not device entitlements. A credit bought on the web is immediately usable in the extension and vice versa.
- Do **not** persist a user-supplied Anthropic key. Rezzie's product and security rules define BYOK as request-scoped: keys are never stored, returned, or exposed to another client. Persisting an API key would require an encrypted key-vault design, key rotation/deletion controls, incident response, and a material change to that policy.
- A signed-in user with available credits or an active subscription can tailor from either client using the server-managed model key. A BYOK-only user enters their key for the current web or extension session when they choose to use BYOK.

### Private resume library and retention

Resume files and generated drafts are sensitive personal data. Storage must be useful without being silent or indefinite.

- Make saving a resume an explicit, clearly explained choice at upload: **Save privately to my Rezzie library**. Do not automatically retain every uploaded file just because it passed through the editor.
- Store an immutable source version (original filename, MIME type, extracted text, optional encrypted object-storage reference, checksum, and timestamps) plus a normalized text representation. Never expose object keys or one user's resume to another user.
- Store generated drafts only after the user explicitly clicks **Save draft**. A saved draft records its source resume version, a user-editable job label, the job source URL/hostname when applicable, the output text/formatting, and generation metadata that excludes raw API keys and document contents from logs.
- Give every authenticated user a small useful library: one saved source resume and three saved drafts. Give a paying user (an active subscription or a user with a nonzero purchased-credit balance) up to five source resumes and 25 saved drafts. These limits are product configuration, enforced server-side, and can change without a client release.
- Retain saved items until the user deletes them or closes the account. Offer per-item deletion, “delete all library data,” and an account-deletion path. Generated but unsaved drafts remain transient and are discarded after the request.
- Keep the existing Career Record separate: it is a review-gated collection of candidate-confirmed facts for grounding. A saved resume is a private document/version and must not silently turn imported lines into confirmed facts.

## Prerequisite architecture (before extension work)

1. **Move production billing/data to managed Postgres.** The current local SQLite Docker volume is not a sufficient foundation for multi-client documents, access controls, or concurrent credit use. Complete migration, backup, restore, and restricted database-access checks first.
2. **Introduce private object storage.** Use an S3-compatible private bucket (for example Cloudflare R2) only for original uploads and rendered artifacts that need fidelity. Keep objects private; issue short-lived server-generated downloads after ownership checks. Text metadata and authorization remain in Postgres.
3. **Create a resume-library domain service.** Add `Resume`, `ResumeVersion`, and `SavedTailoringRun` models/repositories behind interfaces, with user ownership checks, size/type limits, quota enforcement, and deletion orchestration. Do not add this logic directly to route handlers.
4. **Version the shared API contract.** Define explicit OpenAPI schemas for library, job snapshot, tailoring run, and artifact endpoints, then generate or validate TypeScript client types for both `apps/web` and the future extension. The clients must not duplicate request shapes.
5. **Upgrade the web workspace first.** The current React app becomes the reference implementation for saving/selecting/deleting resumes and drafts. It validates all privacy, quota, export, and billing behavior before Chrome-specific work begins.

## Extension architecture

Create `apps/extension` as a TypeScript Manifest V3 package, sharing only generated API contracts with the existing API. It has four isolated responsibilities:

| Surface | Responsibility | May access |
| --- | --- | --- |
| Content script | Extract visible JD title/company/body with site adapter plus generic fallback; show a minimal launch affordance. | Current page DOM only; no API token, resume, or Chrome privileged API. |
| Service worker | OIDC token lifecycle, API calls to Rezzie, permission checks, download coordination, telemetry-free state. | Rezzie API and Chrome extension APIs. |
| Side panel | Auth, resume selection, extracted-text review, tailoring progress, diff/review, explicit download action. | Service-worker messages only. |
| Rezzie API | Persist chosen resume/run, enforce credits/grounding, render/download signed artifacts. | Server-side user data, billing, Claude. |

Use the standard browser OIDC authorization-code flow with extension-specific redirect handling. Do not reuse the web app’s token storage mechanically; extension storage and redirect configuration require their own security review.

## Permissions and security baseline

- `manifest_version: 3`; bundle all executable code—no CDN scripts, `eval`, or remotely hosted extension logic.
- Start with `activeTab`, `scripting`, `sidePanel`, `storage`, and `downloads`. Request `downloads` only because explicit artifact download needs it.
- Use optional host permissions for named job boards and request the current site only when the user clicks **Tailor this job**. Do not ship with broad `https://*/*` access unless Store review and product needs prove it necessary.
- Keep content scripts in the isolated world. Validate every message sender and payload. The page must never receive OIDC tokens, private resume text, API responses for another page, or arbitrary privileged fetch capability.
- Set a strict extension-pages CSP, sanitize extracted DOM text, use `textContent`/React rendering only, and send HTTPS requests only to explicitly allowed Rezzie origins.
- Clear extracted job text and draft state when the panel closes unless the user explicitly saves it. Never collect browsing history or page content for analytics.

## API additions required before implementation

1. **Resume library API:** create/list/get/update-label/delete user resumes; create/list/select source versions; enforce server-side content, count, and ownership limits.
2. **Saved tailoring-run API:** create/list/get/delete a user-approved draft, including its source resume version and job label. Never persist a run merely because tailoring completed.
3. **Job snapshot API:** create an editable snapshot from extracted text with `source_url`, hostname, title, company, and extraction confidence; never treat page metadata as resume fact. Snapshots default to transient unless the user saves the associated run.
4. **Async tailoring run API:** create a run from `resume_version_id` plus reviewed job snapshot, return status/result, and preserve the existing credit consumption, refund, and grounding rules. Use an idempotency key to prevent duplicate credit use from double clicks or extension retries.
5. **Artifact API:** user-approved run only; render DOCX and PDF, store privately for a short signed-download window, and audit download issuance without logging document contents.
6. **Extension identity configuration:** configure Firebase's extension redirect flow and an API extension-client/extension-ID allow-list. Do not weaken web CORS to make the extension work; extension requests are authenticated bearer requests to the existing API.

## Extraction design

Build small adapters with the same interface: `canHandle(url)`, `extract(document)`, and `confidence`. First adapters should target the boards the product team actually validates (for example LinkedIn, Greenhouse, Lever, Workday, and Ashby), but ship only after fixture-based tests against permitted sample pages.

The generic fallback ranks semantic containers (`main`, `article`, `[data-automation-id]`) and common JD headings, removes navigation/footer/EEO boilerplate duplicates, and presents the resulting text for user edit. It never fetches a job URL itself, bypasses login walls, or scrapes hidden page/application data. If confidence is low, show paste/edit rather than generating.

## User flow

1. User visits a job page and explicitly opens **Tailor this job**.
2. Content script extracts visible title/company/JD and sends a bounded plain-text snapshot to the service worker.
3. Side panel shows source URL, extraction confidence, and editable JD. User confirms it.
4. User selects a saved resume or imports one; side panel states whether a credit or BYOK will be used.
5. API creates the run, applies existing grounding controls, and returns a draft plus review items.
6. User reviews the diff and explicitly chooses **Download DOCX** or **Download PDF**. The service worker calls `chrome.downloads.download` with a short-lived Rezzie artifact URL and a safe filename such as `First_Last_Company_Role_Rezzie.docx`.
7. On success, show the local filename and a link to the run in Rezzie; never upload it to the job board.

## Delivery milestones

### 0. Data and production foundation

Complete managed Postgres migration, private object-storage setup, backup/restore rehearsal, and an explicit retention/deletion policy. Add data-classification rules for originals, extracted text, saved drafts, artifacts, and logs. Exit only when production data is no longer dependent on the local SQLite Docker volume.

### 1. Shared resume library and web experience

Implement the models, migrations, repositories, quotas, ownership enforcement, and delete flows. Upgrade the web workspace to save/select/reuse a resume and optionally save a tailored draft. Add API contract, authorization, quota, and deletion tests plus browser tests for the web flow. Exit only after users can manage their library entirely from rezzie.org.

### 2. Shared runs, exports, and billing hardening

Create idempotent saved-run and artifact APIs. Ensure a tailoring run consumes exactly one shared ledger credit regardless of whether it starts on web or extension, and refunds only when generation actually fails. Test duplicate requests, cross-user access, expired downloads, subscription/credit combinations, and deletion of associated private objects.

### 3. Contract and threat-model gate

Define API schemas, auth redirect model, retention/export policy, Store disclosure copy, supported-site list, and abuse/privacy threat model. Exit only after security review.

### 4. Extension shell

Scaffold MV3 build, side panel, service worker, development auth, typed message protocol, and isolated-world content script. Test install, sign-in/out, refresh/restart behavior, and zero broad host permissions.

### 5. Generic extraction and review

Implement generic extraction, confidence scoring, editable confirmation, and bounded transport. Test hostile DOM, SPA navigation, logged-out pages, no-JD pages, and oversized content.

### 6. Saved resume and tailoring APIs

Add persistent resume/job/run APIs and connect the side panel to credit/BYOK tailoring. Test entitlement failures, duplicate clicks, provider errors/refunds, and grounding rejections.

### 7. Export and download

Implement server-side DOCX/PDF renderer with golden-file tests, signed artifact URLs, download filename rules, and expiry/deletion. Test failed/cancelled downloads and resume text fidelity.

### 8. Board adapters and Store release

Add tested adapters one board at a time, request optional host permission contextually, produce privacy/disclosure screenshots, run accessibility/manual cross-site regression tests, submit for Chrome Web Store review, and monitor errors without retaining page/resume contents.

## Definition of done

- A user can authenticate, review an extracted JD, tailor a selected resume with either credits or BYOK, review changes, and download a faithful DOCX/PDF.
- No third-party page gets credentials or resume content; no application is auto-submitted.
- Every message/API/extraction/export failure is tested; approved job-page fixtures cover every supported adapter.
- Manifest permissions, CSP, Store privacy disclosures, retention/deletion, and accessibility are reviewed before release.

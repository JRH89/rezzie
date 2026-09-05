# Chrome extension roadmap: tailor from a job page

## Outcome

From a supported job board or any job-description page, a signed-in Rezzie user can open the extension, review extracted job text, select an existing resume, generate a truth-preserving tailored draft, review it, and download a `.docx` or `.pdf` version for the application. The extension must never auto-submit an application or silently replace a resume on a third-party site.

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

1. Persisted resume API: create/list/get/delete user resumes and select a source version by ID.
2. Job snapshot API: create an editable snapshot from extracted text with `source_url`, hostname, title, company, and extraction confidence; never treat page metadata as resume fact.
3. Async tailoring run API: create run from `resume_id` + reviewed job snapshot, return status/result, and preserve the existing credit/refund/grounding rules.
4. Export API: user-approved run only; render server-side `.docx` and PDF, store privately for a short signed-download window, and audit download issuance without logging document contents.
5. Extension OIDC audience/client configuration plus an origin/extension-ID allow-list. Do not weaken web CORS to make the extension work.

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

### 0. Contract and threat-model gate

Define API schemas, auth redirect model, retention/export policy, Store disclosure copy, supported-site list, and abuse/privacy threat model. Exit only after security review.

### 1. Extension shell

Scaffold MV3 build, side panel, service worker, development auth, typed message protocol, and isolated-world content script. Test install, sign-in/out, refresh/restart behavior, and zero broad host permissions.

### 2. Generic extraction and review

Implement generic extraction, confidence scoring, editable confirmation, and bounded transport. Test hostile DOM, SPA navigation, logged-out pages, no-JD pages, and oversized content.

### 3. Saved resume and tailoring APIs

Add persistent resume/job/run APIs and connect the side panel to credit/BYOK tailoring. Test entitlement failures, duplicate clicks, provider errors/refunds, and grounding rejections.

### 4. Export and download

Implement server-side DOCX/PDF renderer with golden-file tests, signed artifact URLs, download filename rules, and expiry/deletion. Test failed/cancelled downloads and resume text fidelity.

### 5. Board adapters and Store release

Add tested adapters one board at a time, request optional host permission contextually, produce privacy/disclosure screenshots, run accessibility/manual cross-site regression tests, submit for Chrome Web Store review, and monitor errors without retaining page/resume contents.

## Definition of done

- A user can authenticate, review an extracted JD, tailor a selected resume with either credits or BYOK, review changes, and download a faithful DOCX/PDF.
- No third-party page gets credentials or resume content; no application is auto-submitted.
- Every message/API/extraction/export failure is tested; approved job-page fixtures cover every supported adapter.
- Manifest permissions, CSP, Store privacy disclosures, retention/deletion, and accessibility are reviewed before release.

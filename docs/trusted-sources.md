# Trusted Sources

Trusted Sources let an active Rezzie Monthly subscriber add public work they ownâ€”currently a GitHub profile/repository or portfolio pageâ€”as additional evidence for a resume tailoring run.

## Product rules

- The candidate must attest that they own the source or are authorized to use it.
- Sources must be public HTTPS HTML. Login-only pages, files, browser automation, and social-network scraping are not supported.
- Rezzie applies SSRF checks before every fetch, follows at most three redirects, rejects local/private network targets, and limits imported pages to 750 KB.
- Source-backed tailoring is managed-service only and costs **two credits total**. An active subscription is required to add or use a source.
- The model receives source text only for the selected run. Sources are never logged.
- The returned draft identifies candidate source-backed lines. The user can open the source, keep the line, or undo it before export.
- The source is not proof by itself: prompts prohibit inference from vague repository names, stars, job titles, or implied ownership.

## Retention and deletion

Rezzie stores normalized text extracted from an added source so a subscriber can reuse it in future tailoring runs. The user can delete a source at any time; deletion removes its URL and normalized text. Original HTML, cookies, credentials, and source files are never retained.

## Rate limits

The API applies a persistent SQLite-backed limit to all API traffic (120 requests/minute per privacy-safe hashed network subject). Tailoring is capped at 12 runs per 15 minutes per user; source import is capped at 5 per hour per user. Stripe webhooks are exempt from generic throttling and protected by signature verification.

Set `RATE_LIMIT_SALT` to a long random server-only value in production. Never reuse it as an API, Stripe, or Firebase credential.

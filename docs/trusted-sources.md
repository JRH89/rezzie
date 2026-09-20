# Trusted Sources

Trusted Sources let any authenticated Rezzie user add public work they own, currently a GitHub profile, repository, or portfolio page, as additional evidence for a resume tailoring or cover-letter run.

## Product rules

- The candidate must attest that they own the source or are authorized to use it.
- Sources must be public HTTPS HTML. Login-only pages, files, browser automation, and social-network scraping are not supported.
- Rezzie applies SSRF checks before every fetch, follows at most three redirects, rejects local/private network targets, and limits imported pages to 750 KB.
- Connecting a source is free. A subscriber can use selected sources without a source fee. A non-subscriber pays **one additional credit** only when selected sources are used in a generation request.
- A managed resume tailoring run costs one credit; adding a cover letter to that run costs one additional credit. A standalone cover letter costs one credit. BYOK resume tailoring remains unmetered, but non-subscribers still pay the one-credit source-enrichment fee when they elect to use sources.
- The model receives source text only for the selected run. Sources are never logged.
- The generated resume and cover letter remain editable and are presented alongside the original source for a direct review before export.
- The source is not proof by itself: prompts prohibit inference from vague repository names, stars, job titles, or implied ownership.

## Retention and deletion

Rezzie stores normalized text extracted from an added source so its owner can reuse it in future tailoring and cover-letter runs. The user can delete a source at any time; deletion removes its URL and normalized text. Original HTML, cookies, credentials, and source files are never retained.

## Rate limits

The API applies a persistent SQLite-backed limit to all API traffic (120 requests/minute per privacy-safe hashed network subject). Tailoring and cover-letter creation are each capped at 12 runs per 15 minutes per user; source import is capped at 5 per hour per user. Stripe webhooks are exempt from generic throttling and protected by signature verification.

Set `RATE_LIMIT_SALT` to a long random server-only value in production. Never reuse it as an API, Stripe, or Firebase credential.

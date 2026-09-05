# Career Record MVP

## Goal

Turn an uploaded resume into a private, reviewable source of facts. Rezzie may tailor from a Career Record only after the candidate confirms the facts it will use.

## First release

1. Create a record from pasted or uploaded resume text.
2. Extract conservative proposed facts from visible lines; never infer or enrich them.
3. Let the user confirm, edit, reject, or add a fact.
4. Tailor from confirmed facts only; return a clear error when none are confirmed.

## Boundaries

- The original upload is retained as source text, separate from the fact set.
- Extracted facts start as `needs_review`; no model inference is treated as fact.
- Every fact carries source provenance and an optional evidence note.
- Editing creates a user-authored fact; record changes remain auditable by timestamps.
- The MVP does not claim that a fact is externally verified. A later release can add evidence URLs, verification tiers, revisions, cut logs, and interview probe maps.

## Guided experience

The workspace uses a four-stage flow: experience, job description, Claude access, and review/download. It includes visible progress, saved Career Record selection, editable fact review, contextual guidance, source summaries, grounded-keyword and review panels, copy, and text download. The layout has dedicated desktop and mobile behavior.

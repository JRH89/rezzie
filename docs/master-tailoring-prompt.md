# Rezzie master resume-tailoring prompt

The production master prompt is [RESUME_TAILORING_MASTER_PROMPT](../apps/api/src/rezzie/prompts.py). It is deliberately a single source of truth consumed by the Claude provider rather than a duplicated documentation-only prompt.

It synthesizes the three supplied prompt frameworks into one full-resume workflow:

| Source framework | Retained behavior |
| --- | --- |
| The First Impression | Evidence-backed summary and skills, JD-tiered keyword prioritization, no unsupported positioning. |
| The Track Record | Honest experience rewriting, exact JD language only where earned, real chronology/metrics preserved. |
| The Showcase | Project curation for coverage, status honesty, no double-counting, gaps clearly surfaced. |

## Product-specific decisions

- It outputs one complete plain-text resume rather than multiple variants, because Rezzie’s UI displays a single reviewable draft.
- It treats the original resume as the only factual source and treats both resume/JD text as untrusted input, preventing prompt-injection text in imported content from changing the instruction hierarchy.
- Missing requirements become structured `GAP`, `VERIFY`, or `METRIC NEEDED` review items instead of claims or placeholders in a user-ready resume.
- Existing deterministic grounding checks remain active after model output as a second safety layer.

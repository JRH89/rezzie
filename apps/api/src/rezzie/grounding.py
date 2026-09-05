"""Minimal deterministic safety floor for model-produced resume drafts.

Keyword and terminology alignment is an intended part of tailoring, so this module
only blocks objectively checkable unsupported quantitative claims. The model prompt
and the user's review handle qualitative wording and context.
"""
import re

from fastapi import HTTPException

NUMBER = re.compile(r"(?<![\w.])\d+(?:[,.]\d+)*(?:%|\+)?")


def claim_numbers(text: str) -> set[str]:
    """Exclude ordered-list markers, which are formatting rather than resume claims."""
    without_list_markers = re.sub(r"(?m)^\s*\d+[.)]\s+", "", text)
    return set(NUMBER.findall(without_list_markers))


def remove_unsupported_quantitative_lines(source_resume: str, tailored_resume: str) -> str:
    """Remove only lines containing a number absent from the candidate source."""
    source_numbers = claim_numbers(source_resume)
    kept_lines = [line for line in tailored_resume.splitlines() if not (claim_numbers(line) - source_numbers)]
    return "\n".join(kept_lines).strip()


def assert_grounded(source_resume: str, tailored_resume: str) -> None:
    source_numbers = claim_numbers(source_resume)
    invented_numbers = claim_numbers(tailored_resume) - source_numbers
    if invented_numbers:
        raise HTTPException(status_code=422, detail="The generated draft introduced an unsupported quantitative claim.")

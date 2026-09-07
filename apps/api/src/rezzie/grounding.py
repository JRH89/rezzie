"""Minimal deterministic safety floor for model-produced resume drafts.

Keyword and terminology alignment is an intended part of tailoring, so this module
only blocks objectively checkable unsupported quantitative claims. The model prompt
and the user's review handle qualitative wording and context.
"""
import re
from datetime import UTC, date, datetime

from fastapi import HTTPException

NUMBER = re.compile(r"(?<![\w.])\d+(?:[,.]\d+)*(?:%|\+)?")
TENURE = re.compile(r"(?<![\w.])(\d+)(?:\+)?\s*(?:years?|yrs?)\b", re.IGNORECASE)
YEAR_RANGE = re.compile(r"\b(19\d{2}|20\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now)\b", re.IGNORECASE)


def current_date() -> date:
    return datetime.now(UTC).date()


def claim_numbers(text: str) -> set[str]:
    """Exclude ordered-list markers, which are formatting rather than resume claims."""
    without_list_markers = re.sub(r"(?m)^\s*\d+[.)]\s+", "", text)
    return set(NUMBER.findall(without_list_markers))


def supported_tenure_years(source_resume: str, reference_date: date) -> set[str]:
    """Return whole calendar-year spans directly supported by resume date ranges.

    A year-only range such as ``2020–Present`` supports a calendar-span claim of
    six years in 2026. We intentionally do not infer duration from isolated
    years, undated roles, or external sources.
    """
    supported: set[str] = set()
    for match in YEAR_RANGE.finditer(source_resume):
        start_year = int(match.group(1))
        end_value = match.group(2).casefold()
        end_year = reference_date.year if end_value in {"present", "current", "now"} else int(end_value)
        if start_year <= end_year:
            supported.add(str(end_year - start_year))
    return supported


def unsupported_quantitative_claims(source_resume: str, tailored_resume: str, reference_date: date) -> set[str]:
    """Find new numbers, except tenure values derived from explicit source ranges."""
    unsupported = claim_numbers(tailored_resume) - claim_numbers(source_resume)
    supported_tenures = supported_tenure_years(source_resume, reference_date)
    for tenure in TENURE.finditer(tailored_resume):
        if tenure.group(1) in supported_tenures:
            unsupported.discard(tenure.group(1))
    return unsupported


def remove_unsupported_quantitative_lines(source_resume: str, tailored_resume: str, reference_date: date | None = None) -> str:
    """Remove only lines containing a number absent from the candidate source."""
    as_of = reference_date or current_date()
    kept_lines = [line for line in tailored_resume.splitlines() if not unsupported_quantitative_claims(source_resume, line, as_of)]
    return "\n".join(kept_lines).strip()


def assert_grounded(source_resume: str, tailored_resume: str, reference_date: date | None = None) -> None:
    invented_numbers = unsupported_quantitative_claims(source_resume, tailored_resume, reference_date or current_date())
    if invented_numbers:
        raise HTTPException(status_code=422, detail="The generated draft introduced an unsupported quantitative claim.")

"""Deterministic safety floor for model-produced resume drafts.

This deliberately favors rejection over quietly accepting a likely invented claim.
It complements, but does not replace, user review and future semantic evaluation.
"""
import re

from fastapi import HTTPException

NUMBER = re.compile(r"(?<![\w.])\d+(?:[,.]\d+)*(?:%|\+)?")
PROPER_PHRASE = re.compile(r"\b(?:[A-Z][A-Za-z0-9&.-]+(?:\s+|$)){2,4}")
SAFE_HEADINGS = {"Professional Summary", "Core Skills", "Work Experience", "Education", "Technical Skills", "Key Skills", "Selected Experience"}


def assert_grounded(source_resume: str, tailored_resume: str) -> None:
    source_numbers = set(NUMBER.findall(source_resume))
    invented_numbers = set(NUMBER.findall(tailored_resume)) - source_numbers
    if invented_numbers:
        raise HTTPException(status_code=422, detail="The generated draft introduced an unsupported quantitative claim.")
    normalized_source = " ".join(re.sub(r"[^a-z0-9]+", " ", source_resume.casefold()).split())
    for phrase in PROPER_PHRASE.findall(tailored_resume):
        clean_phrase = " ".join(phrase.split())
        if clean_phrase in SAFE_HEADINGS: continue
        if clean_phrase.casefold() not in normalized_source:
            raise HTTPException(status_code=422, detail="The generated draft introduced an unsupported named claim. Review the source resume and retry.")

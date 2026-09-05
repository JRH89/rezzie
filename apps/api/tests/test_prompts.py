from rezzie.prompts import RESUME_TAILORING_MASTER_PROMPT


def test_master_prompt_keeps_resume_as_the_only_factual_source() -> None:
    assert "ORIGINAL_RESUME is the sole factual source" in RESUME_TAILORING_MASTER_PROMPT
    assert "Never invent" in RESUME_TAILORING_MASTER_PROMPT


def test_master_prompt_requires_structured_gap_review() -> None:
    assert "GAP:" in RESUME_TAILORING_MASTER_PROMPT
    assert '"tailored_resume"' in RESUME_TAILORING_MASTER_PROMPT

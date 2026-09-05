from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, HttpUrl, field_validator


class CredentialMode(StrEnum):
    BYOK = "byok"
    SUBSCRIPTION = "subscription"


class TextImportRequest(BaseModel):
    text: str = Field(min_length=50, max_length=100_000)


class UrlImportRequest(BaseModel):
    url: HttpUrl


class ImportResponse(BaseModel):
    text: str
    source_type: str
    source_url: str | None = None


class TailorRequest(BaseModel):
    resume_text: str = Field(min_length=50, max_length=100_000)
    job_description: str = Field(min_length=50, max_length=100_000)
    credential_mode: CredentialMode
    api_key: str | None = Field(default=None, min_length=10, max_length=500)

    @field_validator("api_key")
    @classmethod
    def strip_key(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class TailoringResult(BaseModel):
    tailored_resume: str = Field(min_length=50)
    matched_keywords: list[str] = Field(max_length=30)
    review_items: list[str] = Field(max_length=20)
    truth_statement: str


class ResumeExportRequest(BaseModel):
    """Transient content used only to create a downloadable document."""

    resume_text: str = Field(min_length=50, max_length=100_000)


class CreditBalance(BaseModel):
    subscription_status: str
    subscription_remaining: int
    purchased_credits: int


class CareerRecordCreate(BaseModel):
    label: str = Field(default="My Career Record", min_length=1, max_length=160)
    source_text: str = Field(min_length=50, max_length=100_000)


class CareerFactUpdate(BaseModel):
    text: str = Field(min_length=2, max_length=10_000)
    status: str = Field(pattern="^(needs_review|confirmed|rejected)$")
    evidence_note: str | None = Field(default=None, max_length=2_000)


class CareerFactCreate(BaseModel):
    fact_type: str = Field(default="claim", pattern="^(claim|skill)$")
    text: str = Field(min_length=2, max_length=10_000)
    evidence_note: str | None = Field(default=None, max_length=2_000)


class CareerFactResponse(BaseModel):
    id: str
    fact_type: str
    text: str
    source_excerpt: str
    status: str
    evidence_note: str | None


class CareerRecordResponse(BaseModel):
    id: str
    label: str
    created_at: datetime
    updated_at: datetime
    facts: list[CareerFactResponse] = Field(default_factory=list)


class TailorCareerRecordRequest(BaseModel):
    record_id: str
    job_description: str = Field(min_length=50, max_length=100_000)
    credential_mode: CredentialMode
    api_key: str | None = Field(default=None, min_length=10, max_length=500)

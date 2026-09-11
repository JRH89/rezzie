from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field, HttpUrl, field_validator


class CredentialMode(StrEnum):
    BYOK = "byok"
    SUBSCRIPTION = "subscription"


class TextImportRequest(BaseModel):
    text: str = Field(min_length=50, max_length=100_000)


class ResumeStyleProfile(BaseModel):
    """Bounded source-document styling that can be safely re-applied after tailoring."""

    font_family: str = Field(default="Aptos", pattern="^(Aptos|Arial|Calibri|Georgia|Times New Roman)$")
    body_size: float = Field(default=10.5, ge=8, le=14)
    line_height: float = Field(default=13, ge=10, le=20)
    name_size: float = Field(default=18, ge=12, le=28)
    heading_size: float = Field(default=11, ge=9, le=16)
    heading_uppercase: bool = True
    emphasize_role_lines: bool = False
    italic_metadata: bool = False


class UrlImportRequest(BaseModel):
    url: HttpUrl


class ImportResponse(BaseModel):
    text: str
    source_type: str
    source_url: str | None = None
    page_count: int | None = Field(default=None, ge=1, le=100)
    style_profile: ResumeStyleProfile | None = None
    entry_lines: list[str] = Field(default_factory=list, max_length=500)


class SavedResumeCreate(BaseModel):
    label: str = Field(default="My resume", min_length=1, max_length=160)
    source_text: str = Field(min_length=50, max_length=100_000)

    @field_validator("label")
    @classmethod
    def strip_label(cls, value: str) -> str:
        label = value.strip()
        if not label:
            raise ValueError("A resume name is required.")
        return label


class ResumeVersionCreate(BaseModel):
    source_text: str = Field(min_length=50, max_length=100_000)


class SavedResumeResponse(BaseModel):
    id: str
    version_id: str
    label: str
    source_text: str
    created_at: datetime
    updated_at: datetime


class SavedTailoringDraftCreate(BaseModel):
    label: str = Field(default="Tailored resume", min_length=1, max_length=160)
    tailored_resume: str = Field(min_length=50, max_length=100_000)
    resume_html: str | None = Field(default=None, max_length=200_000)
    resume_id: str | None = Field(default=None, max_length=36)

    @field_validator("label")
    @classmethod
    def strip_draft_label(cls, value: str) -> str:
        label = value.strip()
        if not label:
            raise ValueError("A draft name is required.")
        return label


class SavedTailoringDraftResponse(BaseModel):
    id: str
    resume_id: str | None
    label: str
    tailored_resume: str
    resume_html: str | None
    created_at: datetime


class TailorRequest(BaseModel):
    resume_text: str = Field(min_length=50, max_length=100_000)
    job_description: str = Field(min_length=50, max_length=100_000)
    credential_mode: CredentialMode
    api_key: str | None = Field(default=None, min_length=10, max_length=500)
    external_source_ids: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("api_key")
    @classmethod
    def strip_key(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class TailoringResult(BaseModel):
    tailored_resume: str = Field(min_length=50)
    # These power supplemental UI, not the tailored document itself. Claude can
    # occasionally omit them even when it produces a complete grounded resume.
    matched_keywords: list[str] = Field(default_factory=list, max_length=30)
    review_items: list[str] = Field(default_factory=list, max_length=20)
    truth_statement: str = "Review the tailored draft against your source resume before using it."
    changes: list["TailoringChange"] = Field(default_factory=list, max_length=40)


class TailoringChange(BaseModel):
    text: str = Field(min_length=2, max_length=10_000)
    kind: str = Field(pattern="^(source_backed|tailored)$")
    source_url: str | None = Field(default=None, max_length=2_000)


class TrustedSourceCreate(BaseModel):
    url: HttpUrl
    label: str = Field(min_length=1, max_length=160)
    ownership_attested: bool


class TrustedSourceResponse(BaseModel):
    id: str
    label: str
    url: str
    source_type: str
    fetched_at: datetime


class ResumeExportRequest(BaseModel):
    """Transient content used only to create a downloadable document."""

    resume_text: str = Field(min_length=50, max_length=100_000)
    resume_html: str | None = Field(default=None, max_length=200_000)
    target_page_count: int | None = Field(default=None, ge=1, le=5)
    template_id: str = Field(default="professional", pattern="^(source|professional|modern|classic|compact)$")
    style_profile: ResumeStyleProfile | None = None


class CreditBalance(BaseModel):
    subscription_status: str
    subscription_remaining: int
    purchased_credits: int
    unlimited: bool = False


class SupportTicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=160)
    category: str = Field(pattern="^(checkout|billing|account|technical|other)$")
    message: str = Field(min_length=2, max_length=5_000)


class SupportTicketReplyCreate(BaseModel):
    message: str = Field(min_length=2, max_length=5_000)


class SupportTicketStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|in_progress|resolved|closed)$")


class SupportMessageResponse(BaseModel):
    id: str
    author_role: str
    body: str
    created_at: datetime


class SupportTicketResponse(BaseModel):
    id: str
    subject: str
    category: str
    status: str
    created_at: datetime
    updated_at: datetime
    messages: list[SupportMessageResponse] = Field(default_factory=list)


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

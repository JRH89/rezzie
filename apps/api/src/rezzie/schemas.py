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

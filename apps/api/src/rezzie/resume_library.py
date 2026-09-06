"""Private, user-owned resume source versions for reuse across Rezzie clients."""
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import DateTime, ForeignKey, String, Text, func, select
from sqlalchemy.orm import Mapped, mapped_column, sessionmaker

from .billing import Base, BillingRepository


class SavedResume(Base):
    __tablename__ = "saved_resumes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    label: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    resume_id: Mapped[str] = mapped_column(ForeignKey("saved_resumes.id", ondelete="CASCADE"), index=True)
    source_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class SavedTailoringDraft(Base):
    __tablename__ = "saved_tailoring_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    resume_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    label: Mapped[str] = mapped_column(String(160))
    tailored_resume: Mapped[str] = mapped_column(Text)
    resume_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class ResumeLibraryService:
    """Applies ownership and entitlement limits around otherwise simple storage."""

    def __init__(self, sessions: sessionmaker, billing: BillingRepository) -> None:
        self._sessions = sessions
        self._billing = billing

    def _limit(self, user_id: str) -> int:
        status, _, purchased_credits = self._billing.balance(user_id)
        return 5 if status in {"active", "trialing"} or purchased_credits > 0 else 1

    def _draft_limit(self, user_id: str) -> int:
        status, _, purchased_credits = self._billing.balance(user_id)
        return 25 if status in {"active", "trialing"} or purchased_credits > 0 else 3

    def create(self, user_id: str, *, label: str, source_text: str) -> tuple[SavedResume, ResumeVersion]:
        limit = self._limit(user_id)
        with self._sessions.begin() as session:
            count = session.scalar(select(func.count()).select_from(SavedResume).where(SavedResume.user_id == user_id)) or 0
            if count >= limit:
                raise HTTPException(status_code=409, detail=f"Your current plan can save up to {limit} resume{'s' if limit != 1 else ''}. Delete one or add credits to save more.")
            resume = SavedResume(id=str(uuid4()), user_id=user_id, label=label.strip())
            version = ResumeVersion(id=str(uuid4()), resume_id=resume.id, source_text=source_text)
            session.add_all([resume, version])
        return resume, version

    def list(self, user_id: str) -> list[tuple[SavedResume, ResumeVersion]]:
        with self._sessions() as session:
            resumes = list(session.scalars(select(SavedResume).where(SavedResume.user_id == user_id).order_by(SavedResume.updated_at.desc())))
            return [(resume, self._latest_version(session, resume.id)) for resume in resumes]

    def get(self, user_id: str, resume_id: str) -> tuple[SavedResume, ResumeVersion]:
        with self._sessions() as session:
            resume = self._owned_resume(session, user_id, resume_id)
            return resume, self._latest_version(session, resume.id)

    def add_version(self, user_id: str, resume_id: str, source_text: str) -> tuple[SavedResume, ResumeVersion]:
        with self._sessions.begin() as session:
            resume = self._owned_resume(session, user_id, resume_id)
            version = ResumeVersion(id=str(uuid4()), resume_id=resume.id, source_text=source_text)
            resume.updated_at = datetime.now(UTC)
            session.add(version)
        return resume, version

    def delete(self, user_id: str, resume_id: str) -> None:
        with self._sessions.begin() as session:
            session.delete(self._owned_resume(session, user_id, resume_id))

    def save_draft(self, user_id: str, *, label: str, tailored_resume: str, resume_html: str | None, resume_id: str | None) -> SavedTailoringDraft:
        limit = self._draft_limit(user_id)
        with self._sessions.begin() as session:
            count = session.scalar(select(func.count()).select_from(SavedTailoringDraft).where(SavedTailoringDraft.user_id == user_id)) or 0
            if count >= limit:
                raise HTTPException(status_code=409, detail=f"Your current plan can save up to {limit} tailored drafts. Delete one or add credits to save more.")
            if resume_id:
                self._owned_resume(session, user_id, resume_id)
            draft = SavedTailoringDraft(
                id=str(uuid4()), user_id=user_id, resume_id=resume_id, label=label.strip(),
                tailored_resume=tailored_resume, resume_html=resume_html,
            )
            session.add(draft)
        return draft

    def list_drafts(self, user_id: str) -> list[SavedTailoringDraft]:
        with self._sessions() as session:
            return list(session.scalars(select(SavedTailoringDraft).where(SavedTailoringDraft.user_id == user_id).order_by(SavedTailoringDraft.created_at.desc())))

    def draft(self, user_id: str, draft_id: str) -> SavedTailoringDraft:
        with self._sessions() as session:
            return self._owned_draft(session, user_id, draft_id)

    def delete_draft(self, user_id: str, draft_id: str) -> None:
        with self._sessions.begin() as session:
            session.delete(self._owned_draft(session, user_id, draft_id))

    @staticmethod
    def _owned_resume(session, user_id: str, resume_id: str) -> SavedResume:
        resume = session.get(SavedResume, resume_id)
        if not resume or resume.user_id != user_id:
            raise HTTPException(status_code=404, detail="Saved resume not found.")
        return resume

    @staticmethod
    def _latest_version(session, resume_id: str) -> ResumeVersion:
        version = session.scalar(select(ResumeVersion).where(ResumeVersion.resume_id == resume_id).order_by(ResumeVersion.created_at.desc()))
        if not version:
            raise HTTPException(status_code=500, detail="Saved resume has no source version.")
        return version

    @staticmethod
    def _owned_draft(session, user_id: str, draft_id: str) -> SavedTailoringDraft:
        draft = session.get(SavedTailoringDraft, draft_id)
        if not draft or draft.user_id != user_id:
            raise HTTPException(status_code=404, detail="Saved tailored draft not found.")
        return draft

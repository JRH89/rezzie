"""Private, user-confirmed career facts used for evidence-led tailoring."""
from collections.abc import Iterable
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import DateTime, ForeignKey, String, Text, select
from sqlalchemy.orm import Mapped, mapped_column, sessionmaker

from .billing import Base


class CareerRecord(Base):
    __tablename__ = "career_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    label: Mapped[str] = mapped_column(String(160))
    source_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class CareerFact(Base):
    __tablename__ = "career_facts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    record_id: Mapped[str] = mapped_column(ForeignKey("career_records.id", ondelete="CASCADE"), index=True)
    fact_type: Mapped[str] = mapped_column(String(32))
    text: Mapped[str] = mapped_column(Text)
    source_excerpt: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="needs_review")
    evidence_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


def proposed_facts(resume_text: str) -> list[tuple[str, str]]:
    """Extract source lines conservatively; this performs no semantic inference."""
    facts: list[tuple[str, str]] = []
    in_skills = False
    for raw_line in resume_text.splitlines():
        line = raw_line.strip(" \t•-*–")
        if not line:
            continue
        normalized = line.casefold().rstrip(":")
        if normalized in {"skills", "technical skills", "core skills", "competencies"}:
            in_skills = True
            continue
        if len(line) > 180:
            in_skills = False
        if in_skills and any(separator in line for separator in (",", "|", "·")):
            for skill in (item.strip() for item in line.replace("|", ",").replace("·", ",").split(",")):
                if 1 < len(skill) <= 80:
                    facts.append(("skill", skill))
        elif len(line) >= 12:
            facts.append(("claim", line))
    return facts[:100]


class CareerRecordRepository:
    def __init__(self, sessions: sessionmaker) -> None:
        self._sessions = sessions

    def create(self, user_id: str, label: str, source_text: str) -> CareerRecord:
        record = CareerRecord(id=str(uuid4()), user_id=user_id, label=label, source_text=source_text)
        with self._sessions.begin() as session:
            session.add(record)
            for fact_type, fact_text in proposed_facts(source_text):
                session.add(CareerFact(id=str(uuid4()), record_id=record.id, fact_type=fact_type, text=fact_text, source_excerpt=fact_text, status="needs_review", evidence_note=None))
        return record

    def list(self, user_id: str) -> list[CareerRecord]:
        with self._sessions() as session:
            return list(session.scalars(select(CareerRecord).where(CareerRecord.user_id == user_id).order_by(CareerRecord.updated_at.desc())))

    def record(self, user_id: str, record_id: str) -> CareerRecord:
        with self._sessions() as session:
            record = session.get(CareerRecord, record_id)
            if not record or record.user_id != user_id:
                raise HTTPException(status_code=404, detail="Career Record not found.")
            return record

    def facts(self, user_id: str, record_id: str) -> list[CareerFact]:
        self.record(user_id, record_id)
        with self._sessions() as session:
            return list(session.scalars(select(CareerFact).where(CareerFact.record_id == record_id).order_by(CareerFact.created_at)))

    def update_fact(self, user_id: str, record_id: str, fact_id: str, *, text: str, status: str, evidence_note: str | None) -> CareerFact:
        self.record(user_id, record_id)
        with self._sessions.begin() as session:
            fact = session.get(CareerFact, fact_id)
            if not fact or fact.record_id != record_id:
                raise HTTPException(status_code=404, detail="Career fact not found.")
            fact.text, fact.status, fact.evidence_note = text, status, evidence_note
            return fact

    def add_fact(self, user_id: str, record_id: str, *, fact_type: str, text: str, evidence_note: str | None) -> CareerFact:
        self.record(user_id, record_id)
        fact = CareerFact(
            id=str(uuid4()), record_id=record_id, fact_type=fact_type, text=text,
            source_excerpt="Added directly by the candidate.", status="needs_review",
            evidence_note=evidence_note,
        )
        with self._sessions.begin() as session:
            session.add(fact)
        return fact

    def confirmed_source(self, user_id: str, record_id: str) -> str:
        record = self.record(user_id, record_id)
        confirmed = [fact for fact in self.facts(user_id, record_id) if fact.status == "confirmed"]
        if not confirmed:
            raise HTTPException(status_code=422, detail="Confirm at least one Career Record fact before tailoring from it.")
        sections: Iterable[str] = [f"CAREER RECORD: {record.label}", "CONFIRMED FACTS:", *(f"- {fact.text}" for fact in confirmed)]
        return "\n".join(sections)

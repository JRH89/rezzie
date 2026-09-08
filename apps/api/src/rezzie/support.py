"""Private customer-support tickets. Bodies stay in the database and are never logged."""
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import DateTime, ForeignKey, String, Text, select
from sqlalchemy.orm import Mapped, mapped_column, sessionmaker

from .billing import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    subject: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class SupportTicketMessage(Base):
    __tablename__ = "support_ticket_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("support_tickets.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[str] = mapped_column(String(128))
    author_role: Mapped[str] = mapped_column(String(16))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class SupportRepository:
    def __init__(self, sessions: sessionmaker) -> None: self._sessions = sessions

    def create(self, user_id: str, *, subject: str, category: str, message: str) -> SupportTicket:
        ticket = SupportTicket(id=str(uuid4()), user_id=user_id, subject=subject.strip(), category=category, status="open")
        with self._sessions.begin() as session:
            session.add(ticket)
            session.add(SupportTicketMessage(id=str(uuid4()), ticket_id=ticket.id, author_id=user_id, author_role="customer", body=message.strip()))
        return ticket

    def list_for_user(self, user_id: str) -> list[SupportTicket]:
        with self._sessions() as session:
            return list(session.scalars(select(SupportTicket).where(SupportTicket.user_id == user_id).order_by(SupportTicket.updated_at.desc())))

    def list_all(self) -> list[SupportTicket]:
        with self._sessions() as session: return list(session.scalars(select(SupportTicket).order_by(SupportTicket.updated_at.desc())))

    def get_for_user(self, user_id: str, ticket_id: str) -> SupportTicket:
        with self._sessions() as session:
            ticket = session.get(SupportTicket, ticket_id)
            if not ticket or ticket.user_id != user_id: raise HTTPException(status_code=404, detail="Support ticket not found.")
            return ticket

    def get_any(self, ticket_id: str) -> SupportTicket:
        with self._sessions() as session:
            ticket = session.get(SupportTicket, ticket_id)
            if not ticket: raise HTTPException(status_code=404, detail="Support ticket not found.")
            return ticket

    def messages(self, ticket_id: str) -> list[SupportTicketMessage]:
        with self._sessions() as session: return list(session.scalars(select(SupportTicketMessage).where(SupportTicketMessage.ticket_id == ticket_id).order_by(SupportTicketMessage.created_at)))

    def reply(self, ticket_id: str, *, author_id: str, author_role: str, body: str) -> SupportTicket:
        with self._sessions.begin() as session:
            ticket = session.get(SupportTicket, ticket_id)
            if not ticket: raise HTTPException(status_code=404, detail="Support ticket not found.")
            session.add(SupportTicketMessage(id=str(uuid4()), ticket_id=ticket.id, author_id=author_id, author_role=author_role, body=body.strip()))
            ticket.updated_at = datetime.now(UTC)
            if author_role == "customer" and ticket.status in {"resolved", "closed"}: ticket.status = "open"
            return ticket

    def update_status(self, ticket_id: str, status: str) -> SupportTicket:
        with self._sessions.begin() as session:
            ticket = session.get(SupportTicket, ticket_id)
            if not ticket: raise HTTPException(status_code=404, detail="Support ticket not found.")
            ticket.status, ticket.updated_at = status, datetime.now(UTC)
            return ticket

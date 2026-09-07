"""Small persistent rate limiter for Rezzie's single-instance SQLite deployment."""
import hashlib
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import DateTime, Integer, String, select
from sqlalchemy.orm import Mapped, mapped_column, sessionmaker

from .billing import Base


class RateLimitWindow(Base):
    __tablename__ = "rate_limit_windows"
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    scope: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[int] = mapped_column(Integer, primary_key=True)
    requests: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class RateLimiter:
    def __init__(self, sessions: sessionmaker, salt: str) -> None:
        self._sessions, self._salt = sessions, salt

    def enforce(self, scope: str, subject: str, *, limit: int, seconds: int) -> None:
        now = int(datetime.now(UTC).timestamp())
        window_start = now - (now % seconds)
        key = hashlib.sha256(f"{self._salt}:{subject}".encode()).hexdigest()
        with self._sessions.begin() as session:
            record = session.scalar(select(RateLimitWindow).where(RateLimitWindow.key == key, RateLimitWindow.scope == scope, RateLimitWindow.window_start == window_start))
            if record is None:
                session.add(RateLimitWindow(key=key, scope=scope, window_start=window_start, requests=1))
                return
            if record.requests >= limit:
                retry_after = max(1, window_start + seconds - now)
                raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.", headers={"Retry-After": str(retry_after)})
            record.requests += 1

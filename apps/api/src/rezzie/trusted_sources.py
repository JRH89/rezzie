"""Candidate-attested public sources used as additional grounding evidence."""
from __future__ import annotations

from datetime import UTC, datetime
from html.parser import HTMLParser
from urllib.parse import urlparse
from uuid import uuid4

import httpx
from fastapi import HTTPException
from sqlalchemy import DateTime, String, Text, select
from sqlalchemy.orm import Mapped, mapped_column, sessionmaker

from .billing import Base, BillingRepository
from .security import assert_safe_public_url


class ExternalSource(Base):
    __tablename__ = "external_sources"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    label: Mapped[str] = mapped_column(String(160))
    url: Mapped[str] = mapped_column(String(2_000))
    source_type: Mapped[str] = mapped_column(String(32))
    extracted_text: Mapped[str] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self._ignored_depth += 1
        if tag in {"p", "br", "li", "h1", "h2", "h3", "h4", "section", "article"}:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self._ignored_depth:
            self._ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._ignored_depth:
            self._parts.append(data)

    def text(self) -> str:
        return "\n".join(" ".join(line.split()) for line in "".join(self._parts).splitlines() if line.strip())


def source_type(url: str) -> str:
    host = (urlparse(url).hostname or "").casefold()
    return "github" if host in {"github.com", "www.github.com"} else "portfolio"


class TrustedSourceRepository:
    def __init__(self, sessions: sessionmaker) -> None:
        self._sessions = sessions

    def create(self, user_id: str, *, label: str, url: str, source_type_value: str, extracted_text: str) -> ExternalSource:
        source = ExternalSource(id=str(uuid4()), user_id=user_id, label=label, url=url, source_type=source_type_value, extracted_text=extracted_text)
        with self._sessions.begin() as session:
            session.add(source)
        return source

    def list(self, user_id: str) -> list[ExternalSource]:
        with self._sessions() as session:
            return list(session.scalars(select(ExternalSource).where(ExternalSource.user_id == user_id).order_by(ExternalSource.fetched_at.desc())))

    def selected(self, user_id: str, source_ids: list[str]) -> list[ExternalSource]:
        if not source_ids:
            return []
        with self._sessions() as session:
            sources = list(session.scalars(select(ExternalSource).where(ExternalSource.user_id == user_id, ExternalSource.id.in_(source_ids))))
        if len(sources) != len(set(source_ids)):
            raise HTTPException(status_code=404, detail="One or more Trusted Sources could not be found.")
        return sources

    def delete(self, user_id: str, source_id: str) -> None:
        with self._sessions.begin() as session:
            source = session.get(ExternalSource, source_id)
            if not source or source.user_id != user_id:
                raise HTTPException(status_code=404, detail="Trusted Source not found.")
            session.delete(source)


class TrustedSourceFetcher:
    """Fetches public HTML with the same SSRF boundary as job URL import."""
    _MAX_REDIRECTS = 3
    _MAX_BYTES = 750_000

    async def fetch(self, url: str) -> tuple[str, str]:
        current_url = url
        async with httpx.AsyncClient(follow_redirects=False, timeout=8.0) as client:
            for redirects_followed in range(self._MAX_REDIRECTS + 1):
                assert_safe_public_url(current_url)
                try:
                    response = await client.get(current_url, headers={"User-Agent": "RezzieTrustedSource/1.0"})
                    response.raise_for_status()
                except httpx.HTTPError as error:
                    raise HTTPException(status_code=422, detail="Rezzie could not retrieve that public source.") from error
                if response.is_redirect:
                    if redirects_followed == self._MAX_REDIRECTS or not response.headers.get("location"):
                        raise HTTPException(status_code=422, detail="The source redirected too many times.")
                    current_url = str(response.url.join(response.headers["location"]))
                    continue
                if "text/html" not in response.headers.get("content-type", ""):
                    raise HTTPException(status_code=422, detail="Trusted Sources must be public HTML pages.")
                if len(response.content) > self._MAX_BYTES:
                    raise HTTPException(status_code=422, detail="That source is too large to import.")
                parser = _TextExtractor()
                parser.feed(response.text)
                extracted = parser.text()[:100_000]
                if len(extracted) < 50:
                    raise HTTPException(status_code=422, detail="No usable public-source text was found.")
                return current_url, extracted
        raise HTTPException(status_code=422, detail="The source redirected too many times.")


class TrustedSourceService:
    def __init__(self, repository: TrustedSourceRepository, billing: BillingRepository, fetcher: TrustedSourceFetcher | None = None) -> None:
        self._repository, self._billing, self._fetcher = repository, billing, fetcher or TrustedSourceFetcher()

    async def add(self, user_id: str, *, url: str, label: str) -> ExternalSource:
        if not self._billing.has_active_subscription(user_id):
            raise HTTPException(status_code=403, detail="Trusted Sources are available with an active Rezzie subscription.")
        final_url, extracted = await self._fetcher.fetch(url)
        return self._repository.create(user_id, label=label, url=final_url, source_type_value=source_type(final_url), extracted_text=extracted)

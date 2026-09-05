"""Bounded document extraction with production fail-closed malware scanning."""
import io
import socket

from docx import Document
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

from .config import Settings

SUPPORTED_DOCUMENT_TYPES = {
    "text/plain": "text",
    "text/markdown": "text",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


class DocumentService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def extract(self, file: UploadFile) -> str:
        document_type = SUPPORTED_DOCUMENT_TYPES.get(file.content_type or "")
        if not document_type:
            raise HTTPException(status_code=422, detail="Use a .txt, .md, .pdf, or .docx document.")
        data = await file.read(self._settings.max_import_bytes + 1)
        if len(data) > self._settings.max_import_bytes:
            raise HTTPException(status_code=413, detail="File exceeds the configured upload limit.")
        self._scan(data)
        try:
            if document_type == "text": text = data.decode("utf-8", errors="replace")
            elif document_type == "pdf": text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(data)).pages)
            else: text = "\n".join(paragraph.text for paragraph in Document(io.BytesIO(data)).paragraphs)
        except Exception as error:
            raise HTTPException(status_code=422, detail="That document could not be read.") from error
        text = text.strip()
        if len(text) < 50: raise HTTPException(status_code=422, detail="The document is too short or has no readable text.")
        return text[:100_000]

    def _scan(self, data: bytes) -> None:
        if not self._settings.clamav_host:
            if self._settings.environment == "development": return
            raise HTTPException(status_code=503, detail="Document scanning is not configured.")
        try:
            with socket.create_connection((self._settings.clamav_host, self._settings.clamav_port), timeout=5) as client:
                client.sendall(b"zINSTREAM\0")
                client.sendall(len(data).to_bytes(4, "big") + data + (0).to_bytes(4, "big"))
                response = client.recv(4096).decode("utf-8", errors="replace")
        except OSError as error:
            raise HTTPException(status_code=503, detail="Document scanning is unavailable.") from error
        if "OK" not in response or "FOUND" in response:
            raise HTTPException(status_code=422, detail="The document did not pass the malware scan.")

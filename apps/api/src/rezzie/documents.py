"""Bounded document extraction with production fail-closed malware scanning."""
import io
import socket

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

from .config import Settings

SUPPORTED_DOCUMENT_TYPES = {
    "text/plain": "text",
    "text/markdown": "text",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

SECTION_HEADINGS = {
    "SUMMARY", "PROFESSIONAL SUMMARY", "PROFILE", "SKILLS", "CORE SKILLS",
    "TECHNICAL SKILLS", "EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT",
    "PROJECTS", "EDUCATION", "CERTIFICATIONS", "AWARDS", "VOLUNTEERING",
}


def is_section_heading(line: str) -> bool:
    normalized = " ".join(line.replace(":", "").split()).upper()
    return normalized in SECTION_HEADINGS


def paragraph_text(document: Document) -> str:
    """Keep paragraph breaks and table rows so layout meaning survives extraction."""
    parts = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [" ".join(cell.text.split()) for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return "\n\n".join(parts)


def pdf_text(reader: PdfReader) -> str:
    """Prefer pypdf layout mode so ordinary PDF text does not become fragments."""
    pages: list[str] = []
    for page in reader.pages:
        try:
            extracted = page.extract_text(extraction_mode="layout")
        except TypeError:
            extracted = page.extract_text()
        if extracted:
            pages.append(extracted.strip())
    return "\n\n".join(pages)


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
            elif document_type == "pdf": text = pdf_text(PdfReader(io.BytesIO(data)))
            else: text = paragraph_text(Document(io.BytesIO(data)))
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


class ResumeExportService:
    """Render Rezzie's structured text contract as an editable ATS-friendly DOCX."""

    def render_docx(self, resume_text: str) -> bytes:
        document = Document()
        section = document.sections[0]
        section.top_margin = section.bottom_margin = Inches(0.65)
        section.left_margin = section.right_margin = Inches(0.7)

        normal = document.styles["Normal"]
        normal.font.name = "Aptos"
        normal.font.size = Pt(10.5)
        normal.paragraph_format.space_after = Pt(4)

        lines = [line.strip() for line in resume_text.splitlines()]
        content_indices = [index for index, line in enumerate(lines) if line]
        name_index = content_indices[0] if content_indices else -1
        contact_index = content_indices[1] if len(content_indices) > 1 else -1

        for index, line in enumerate(lines):
            if not line:
                continue
            if index == name_index:
                paragraph = document.add_paragraph()
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run = paragraph.add_run(line)
                run.bold = True
                run.font.size = Pt(18)
            elif index == contact_index:
                paragraph = document.add_paragraph(line)
                paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                paragraph.runs[0].font.size = Pt(9)
            elif is_section_heading(line):
                paragraph = document.add_paragraph()
                paragraph.paragraph_format.space_before = Pt(10)
                paragraph.paragraph_format.space_after = Pt(3)
                run = paragraph.add_run(line.upper())
                run.bold = True
                run.font.size = Pt(11)
            elif line.startswith(("- ", "* ", "• ")):
                document.add_paragraph(line[2:].strip(), style="List Bullet")
            else:
                document.add_paragraph(line)

        output = io.BytesIO()
        document.save(output)
        return output.getvalue()

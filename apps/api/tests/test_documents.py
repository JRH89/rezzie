import io

from docx import Document

from rezzie.documents import ResumeExportService, is_section_heading, paragraph_text


def test_document_extraction_keeps_paragraph_and_table_boundaries() -> None:
    source = Document()
    source.add_paragraph("Taylor Example")
    source.add_paragraph("EXPERIENCE")
    table = source.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Acme Corp"
    table.cell(0, 1).text = "Engineer"

    assert paragraph_text(source) == "Taylor Example\n\nEXPERIENCE\n\nAcme Corp | Engineer"


def test_exported_docx_has_resume_structure() -> None:
    content = ResumeExportService().render_docx(
        "Taylor Example\ntaylor@example.com | Portland, OR\n\nEXPERIENCE\nAcme Corp | Engineer\n- Delivered reliable systems."
    )
    rendered = Document(io.BytesIO(content))

    assert rendered.paragraphs[0].text == "Taylor Example"
    assert rendered.paragraphs[0].runs[0].bold
    assert "EXPERIENCE" in [paragraph.text for paragraph in rendered.paragraphs]
    assert any(paragraph.text == "Delivered reliable systems." for paragraph in rendered.paragraphs)
    assert is_section_heading("Experience:")

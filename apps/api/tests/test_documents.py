import io

from docx import Document
from docx.shared import Pt

from rezzie.documents import (
    ResumeExportService,
    RichResumeExportService,
    docx_style_profile,
    is_section_heading,
    paragraph_text,
)


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
    assert is_section_heading("Professional Experience")


def test_rich_editor_formatting_survives_docx_and_pdf_exports() -> None:
    source_html = "<h1>Taylor Example</h1><p><strong>taylor@example.com</strong> · <em>Portland, OR</em></p><h3>EXPERIENCE</h3><ul><li><u>Delivered</u> reliable systems.</li></ul>"
    service = RichResumeExportService()

    rendered = Document(io.BytesIO(service.render_docx("Taylor Example", source_html, template_id="classic")))
    contact_runs = rendered.paragraphs[1].runs

    assert rendered.paragraphs[0].runs[0].font.name == "Times New Roman"
    assert contact_runs[0].bold
    assert any(run.italic for run in contact_runs)
    assert rendered.paragraphs[-1].runs[0].underline
    assert service.render_pdf("Taylor Example", source_html, template_id="modern").startswith(b"%PDF")


def test_docx_style_profile_extracts_portable_hierarchy() -> None:
    source = Document()
    source.styles["Normal"].font.name = "Georgia"
    source.styles["Normal"].font.size = Pt(11)
    name = source.add_paragraph(); name.add_run("Taylor Example").font.size = Pt(20)
    source.add_paragraph("taylor@example.com")
    heading = source.add_paragraph(); heading_run = heading.add_run("EXPERIENCE"); heading_run.bold = True; heading_run.font.size = Pt(12)
    role = source.add_paragraph(); role.add_run("Acme Corp | Engineer").bold = True
    dates = source.add_paragraph(); dates_run = dates.add_run("2020 - 2024"); dates_run.italic = True

    profile = docx_style_profile(source)

    assert profile["font_family"] == "Georgia"
    assert profile["name_size"] == 20
    assert profile["heading_size"] == 12
    assert profile["emphasize_role_lines"] is True
    assert profile["italic_metadata"] is True

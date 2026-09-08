# Document fidelity

## Current behavior

- A PDF uploaded in the current browser session remains available as a local, in-browser original preview. Rezzie does not upload a second copy merely to render that preview.
- PDF imports report their actual source page count. A one-page source supplies a one-page target to DOCX and PDF exports.
- The controlled export renderer compacts margins, spacing, and type modestly to meet a one-page target when possible. It never removes content or reduces below its configured readable floor solely to force a page count.
- Uploaded and saved resumes are represented by source cards in the workflow. Extracted content is available only as an optional, read-only review—not as an editable text field by default.

## Important boundary

DOCX uploads receive a bounded, session-only style profile: supported font family, body/name/heading type scale, line-height convention, uppercase heading convention, bold role-line convention, and italic date convention. The user can select **Match uploaded DOCX** for the editor and DOCX/PDF export, or choose a Rezzie template instead. The rich editor's bold, italic, underline, headings, lists, alignment, and safe links are retained by DOCX and PDF exports.

PDF is a fixed-layout output format. Once wording is changed, retaining the exact original positions, line breaks, fonts, links, and pagination is not reliable or honest unless Rezzie has a structured source template and can reflow every changed element. PDF imports therefore do not yield an inline style profile. The current saved-resume library deliberately stores normalized private text, not original source files.

Rezzie therefore distinguishes two promises:

1. **Source fidelity:** the original uploaded PDF can be visually reviewed exactly during that browser session.
2. **Tailored output quality:** the new document uses a controlled, ATS-friendly layout and seeks to preserve the original page count without truncating content. For DOCX uploads, it can also carry forward portable typography and structural conventions into both DOCX and PDF output.

## Next fidelity milestone

Exact template-aware rewriting requires explicit user consent and private original-file storage. The implementation should add a private object-store adapter, encrypted object retention policies, complete source DOCX run mapping, a layout/template model, and a document-rendering test corpus before claiming pixel-level preservation. It should not be built by silently retaining customer files in SQLite or browser logs.

import { describe, expect, it } from "vitest";

import { isResumeHeading, resumeEditorHtml } from "./resumeFormatting";

describe("resume formatting", () => {
  it("renders professional experience as a section heading", () => {
    expect(isResumeHeading("Professional Experience")).toBe(true);
    expect(resumeEditorHtml("Taylor Example\ntaylor@example.com\n\nPROFESSIONAL EXPERIENCE\nSoftware Engineer - Acme (2022 - Present)")).toContain("<h3>PROFESSIONAL EXPERIENCE</h3>");
  });

  it("keeps adjacent bullets in one list and makes dated role lines prominent", () => {
    const html = resumeEditorHtml("Taylor Example\ntaylor@example.com\n\nEXPERIENCE\nSoftware Engineer - Acme (2022 - Present)\n\u2022 Built reliable systems.\n- Improved deployment flow.");

    expect(html).toContain("<strong>Software Engineer - Acme (2022 - Present)</strong>");
    expect(html).toContain("<ul><li>Built reliable systems.</li><li>Improved deployment flow.</li></ul>");
  });

  it("presents plain achievement lines as bullets inside experience sections", () => {
    const html = resumeEditorHtml("Taylor Example\ntaylor@example.com\n\nPROFESSIONAL EXPERIENCE\nSoftware Engineer - Acme (2022 - Present)\nBuilt reliable systems.\nImproved deployment flow.");

    expect(html).toContain("<ul><li>Built reliable systems.</li><li>Improved deployment flow.</li></ul>");
  });
});

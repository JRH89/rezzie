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

  it("starts projects as a new section after experience bullets", () => {
    const html = resumeEditorHtml("Taylor Example\ntaylor@example.com\n\nEXPERIENCE\nSoftware Engineer - Acme (2022 - Present)\nBuilt reliable systems.\nPROJECTS\nRezzie - Resume tailoring tool\nBuilt a truthful resume workflow.");

    expect(html).toContain("<ul><li>Built reliable systems.</li></ul><h3>PROJECTS</h3><p><strong>Rezzie - Resume tailoring tool</strong></p><ul><li>Built a truthful resume workflow.</li></ul>");
  });

  it("separates consecutive project titles into their own entries", () => {
    const html = resumeEditorHtml("Taylor Example\ntaylor@example.com\n\nPROJECTS\nTruss - Agentic Coding Harness (TypeScript, JavaScript) | https://truss-agent.com\nBuilt a local-first coding harness.\nPinLeads - Lead Generation Platform (Node.js, Next.js) | https://pinleads.org\nBuilt a lead collection workflow.");

    expect(html).toContain("<strong>Truss - Agentic Coding Harness (TypeScript, JavaScript) | https://truss-agent.com</strong></p><ul><li>Built a local-first coding harness.</li></ul><p><strong>PinLeads - Lead Generation Platform (Node.js, Next.js) | https://pinleads.org</strong></p><ul><li>Built a lead collection workflow.</li></ul>");
  });
});

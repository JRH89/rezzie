import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("job description uploads", () => {
  beforeEach(() => {
    window.location.hash = "#top";
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    )));
  });

  it("offers the same PDF and DOCX formats accepted by the API", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.click(screen.getByRole("button", { name: "Upload file" }));
    const accepted = screen.getByLabelText(/job description file/i).getAttribute("accept") ?? "";
    expect(accepted).toContain(".pdf");
    expect(accepted).toContain(".docx");
  });

  it("shows a concise source card after a resume file import and keeps raw text optional", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const body = String(input).includes("/api/v1/resumes/file")
        ? { text: "A resume extracted from the uploaded document with enough text to continue through the flow.", page_count: 1 }
        : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    const file = new File(["sample"], "Taylor-Resume.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Resume file"), { target: { files: [file] } });
    expect(await screen.findByText("Taylor-Resume.pdf")).toBeTruthy();
    expect(screen.getByText(/original source: 1 page/i)).toBeTruthy();
  });
});

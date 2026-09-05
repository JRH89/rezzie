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
});

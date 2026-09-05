import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("job description uploads", () => {
  it("offers the same PDF and DOCX formats accepted by the API", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /tailor my resume/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Upload a file" }));
    const accepted = screen.getByLabelText(/job description file/i).getAttribute("accept") ?? "";
    expect(accepted).toContain(".pdf");
    expect(accepted).toContain(".docx");
  });
});

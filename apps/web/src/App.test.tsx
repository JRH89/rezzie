import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
describe("App", () => { it("keeps tailoring disabled until the truth sources and key are present", () => { render(<App />); const button = screen.getByRole("button", { name: "Tailor my resume" }); expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } }); fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } }); fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: "c".repeat(10) } }); expect((button as HTMLButtonElement).disabled).toBe(false); }); });

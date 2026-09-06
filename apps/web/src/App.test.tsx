import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { blogPosts } from "./blog";

function mockBootstrapRequests() {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.includes("/billing/me")
      ? { subscription_status: "none", subscription_remaining: 0, purchased_credits: 0 }
      : path.includes("/api/v1/tailor")
        ? { tailored_resume: "A grounded tailored resume that is deliberately long enough to review and download.", matched_keywords: ["TypeScript"], review_items: ["Check final tone"], truth_statement: "Every claim is grounded." }
        : [];
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
  }));
}

describe("guided tailoring workspace", () => {
  beforeEach(() => {
    window.location.hash = "#top";
    vi.stubGlobal("scrollTo", vi.fn());
    mockBootstrapRequests();
  });

  it("moves through truth sources before enabling tailoring", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const continueToJob = screen.getByRole("button", { name: /continue to the job/i });
    expect((continueToJob as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    expect((continueToJob as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(continueToJob);
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    const tailor = screen.getByRole("button", { name: /tailor my resume/i });
    expect((tailor as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "c".repeat(10) } });
    expect((tailor as HTMLButtonElement).disabled).toBe(false);
  });

  it("provides working landing navigation and a way back home", () => {
    render(<App />);
    expect(screen.getAllByRole("link", { name: "Features" })[0].getAttribute("href")).toBe("/features");
    expect(screen.getByRole("link", { name: "Resources" }).getAttribute("href")).toBe("/blog");
    expect(screen.getAllByRole("link", { name: "FAQ" })[0].getAttribute("href")).toBe("/faq");
    expect(within(screen.getByRole("navigation", { name: "Footer navigation" })).getByRole("link", { name: "Blog" }).getAttribute("href")).toBe("/blog");
    expect(screen.getByRole("heading", { name: /bring your key/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Rezzie home" }));
    expect(screen.getByRole("heading", { name: /a stronger match/i })).toBeTruthy();
  });

  it("opens the signed-in billing account instead of returning to the landing page", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    expect(await screen.findByRole("heading", { name: /keep your applications moving/i })).toBeTruthy();
    expect(window.location.hash).toBe("#account");
  });

  it("opens the appropriate auth action and exits the workspace after sign-out", async () => {
    const signIn = vi.fn();
    const signUp = vi.fn();
    const signOut = vi.fn();
    const { rerender } = render(<App isAuthenticated={false} onSignIn={signIn} onSignUp={signUp} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: /create free account/i }));
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));
    fireEvent.click(screen.getByRole("button", { name: /start the guided flow/i }));
    fireEvent.click(screen.getByRole("button", { name: /open rezzie/i }));
    fireEvent.click(screen.getByRole("button", { name: /use my key/i }));
    fireEvent.click(screen.getByRole("button", { name: /get credits/i }));
    fireEvent.click(screen.getByRole("button", { name: /choose monthly/i }));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledTimes(7);

    rerender(<App isAuthenticated onSignOut={signOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Open workspace" }));
    rerender(<App isAuthenticated={false} onSignOut={signOut} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /a stronger match/i })).toBeTruthy());
  });

  it("shows the review and download workspace after tailoring", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "c".repeat(10) } });
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));
    expect(await screen.findByRole("button", { name: /docx/i })).toBeTruthy();
    expect(screen.getByLabelText("Tailored resume")).toBeTruthy();
  });

  it("renders public content routes directly", () => {
    window.history.pushState({}, "", "/blog/keyword-tailoring");
    render(<App />);
    expect(screen.getByRole("heading", { name: /keyword stuffing/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeTruthy();
  });

  it("exposes a searchable category-based blog library", () => {
    window.history.pushState({}, "", "/blog");
    render(<App />);
    expect(blogPosts).toHaveLength(23);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search guides" }), { target: { value: "transferable" } });
    expect(screen.getByRole("heading", { name: /transferable skills/i })).toBeTruthy();
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { CreditBalance, TrustedSource } from "./api";
import { blogPosts } from "./blog";

function mockBootstrapRequests(
  balance: CreditBalance = { subscription_status: "none", subscription_remaining: 0, purchased_credits: 0, unlimited: false },
  trustedSources: TrustedSource[] = [],
) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const path = String(input);
    const body = path.includes("/billing/me")
      ? balance
      : path.includes("/trusted-sources")
        ? trustedSources
        : path.includes("/api/v1/tailor")
        ? { tailored_resume: "A grounded tailored resume that is deliberately long enough to review and download.", matched_keywords: ["TypeScript"], review_items: ["Check final tone"], truth_statement: "Every claim is grounded.", changes: [{ text: "A grounded tailored resume that is deliberately long enough to review and download.", kind: "tailored" }] }
        : [];
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
  }));
}

describe("guided tailoring workspace", () => {
  beforeEach(() => {
    window.location.hash = "#top";
    window.localStorage.clear();
    window.sessionStorage.clear();
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

  it.each([
    { scenario: "permits a non-subscriber using a key and a source with one credit", status: "none", credits: 1, coverLetter: false, hasKey: true, disabled: false },
    { scenario: "permits a non-subscriber using a key, a source, and a cover letter with two credits", status: "none", credits: 2, coverLetter: true, hasKey: true, disabled: false },
    { scenario: "permits a subscriber using a key and a source without credits", status: "active", credits: 0, coverLetter: false, hasKey: true, disabled: false },
    { scenario: "requires a key even when the source fee is covered", status: "none", credits: 1, coverLetter: false, hasKey: false, disabled: true },
    { scenario: "requires a source credit from a non-subscriber using a key", status: "none", credits: 0, coverLetter: false, hasKey: true, disabled: true },
    { scenario: "requires both the source and cover-letter credits from a non-subscriber using a key", status: "none", credits: 1, coverLetter: true, hasKey: true, disabled: true },
    { scenario: "requires a cover-letter credit from a subscriber using a key", status: "active", credits: 0, coverLetter: true, hasKey: true, disabled: true },
    { scenario: "permits a subscriber using a key, a source, and a cover letter with one credit", status: "active", credits: 1, coverLetter: true, hasKey: true, disabled: false },
    { scenario: "includes source use for a trialing subscriber using a key without credits", status: "trialing", credits: 0, coverLetter: false, hasKey: true, disabled: false },
    { scenario: "permits source and cover-letter use for an unlimited account using a key", status: "none", credits: 0, coverLetter: true, hasKey: true, disabled: false, unlimited: true },
    { scenario: "counts monthly credits toward the source fee for a user using a key", status: "none", credits: 0, coverLetter: false, hasKey: true, disabled: false, remaining: 1 },
  ].map(testCase => ({ unlimited: false, remaining: 0, ...testCase })))("$scenario", async ({ status, credits, remaining, unlimited, coverLetter, hasKey, disabled }) => {
    const source: TrustedSource = { id: "source-1", label: "My public portfolio", url: "https://example.com/portfolio", source_type: "portfolio", fetched_at: "2026-10-06T00:00:00Z" };
    mockBootstrapRequests({ subscription_status: status, subscription_remaining: remaining, purchased_credits: credits, unlimited }, [source]);
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));

    // A real bootstrap response selects the saved source, reproducing the user's blocked BYOK path.
    expect(await screen.findByText(source.label)).toBeTruthy();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("rezzie.workspace-preferences.v1") ?? "{}").selectedTrustedSources).toEqual([source.id]));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    if (coverLetter) fireEvent.click(screen.getByRole("checkbox", { name: /also write a cover letter/i }));
    if (hasKey) fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "synthetic-test-key" } });

    const tailor = screen.getByRole("button", { name: coverLetter ? /tailor resume \+ cover letter/i : /tailor my resume/i });
    expect((tailor as HTMLButtonElement).disabled).toBe(disabled);
    expect(window.localStorage.getItem("rezzie.workspace-preferences.v1")).not.toContain("synthetic-test-key");
    expect(window.sessionStorage.getItem("rezzie.workspace-session.v1")).not.toContain("synthetic-test-key");
  });

  it("submits a selected source with the user's key and refreshes charged credits", async () => {
    const source: TrustedSource = { id: "source-1", label: "My public portfolio", url: "https://example.com/portfolio", source_type: "portfolio", fetched_at: "2026-10-06T00:00:00Z" };
    mockBootstrapRequests({ subscription_status: "none", subscription_remaining: 0, purchased_credits: 1, unlimited: false }, [source]);
    window.sessionStorage.setItem("rezzie.workspace-session.v1", JSON.stringify({ step: 3, resume: "a".repeat(50), job: "b".repeat(50) }));
    window.location.hash = "#workspace";
    render(<App />);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("rezzie.workspace-preferences.v1") ?? "{}").selectedTrustedSources).toEqual([source.id]));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "synthetic-test-key" } });
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));

    expect(await screen.findByLabelText("Tailored resume")).toBeTruthy();
    const requests = vi.mocked(fetch).mock.calls;
    const tailoringRequest = requests.find(([input]) => String(input).endsWith("/api/v1/tailor"));
    expect(JSON.parse(String(tailoringRequest?.[1]?.body ?? "{}"))).toMatchObject({ credential_mode: "byok", api_key: "synthetic-test-key", external_source_ids: [source.id] });
    await waitFor(() => expect(requests.filter(([input]) => String(input).includes("/billing/me"))).toHaveLength(2));
  });

  it("retains a successful paid BYOK draft when refreshing credits fails and blocks another paid action", async () => {
    const source: TrustedSource = { id: "source-1", label: "My public portfolio", url: "https://example.com/portfolio", source_type: "portfolio", fetched_at: "2026-10-06T00:00:00Z" };
    // The old balance could cover a sourced letter, but is stale after this paid run.
    mockBootstrapRequests({ subscription_status: "none", subscription_remaining: 0, purchased_credits: 2, unlimited: false }, [source]);
    const bootstrapFetch = fetch;
    let balanceRequests = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input).includes("/billing/me") && ++balanceRequests > 1) {
        return Promise.resolve(new Response(JSON.stringify({ detail: "Balance is temporarily unavailable." }), { status: 503, headers: { "Content-Type": "application/json" } }));
      }
      return bootstrapFetch(input, options);
    }));
    window.sessionStorage.setItem("rezzie.workspace-session.v1", JSON.stringify({ step: 3, resume: "a".repeat(50), job: "b".repeat(50) }));
    window.location.hash = "#workspace";
    render(<App />);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("rezzie.workspace-preferences.v1") ?? "{}").selectedTrustedSources).toEqual([source.id]));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "synthetic-test-key" } });
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));

    expect((await screen.findByLabelText("Tailored resume")).textContent).toContain("A grounded tailored resume");
    fireEvent.click(screen.getByRole("tab", { name: "Cover letter" }));
    expect(await screen.findByRole("button", { name: "Retry balance check" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /write cover letter/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.sessionStorage.getItem("rezzie.workspace-session.v1")).toContain("A grounded tailored resume");
  });

  it("remembers workflow choices locally without storing an API key", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.click(screen.getByRole("button", { name: "Import link" }));
    fireEvent.click(screen.getByRole("button", { name: "Paste text" }));
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    fireEvent.click(screen.getByRole("radio", { name: /use a rezzie credit/i }));

    await waitFor(() => {
      const preferences = JSON.parse(window.localStorage.getItem("rezzie.workspace-preferences.v1") ?? "{}");
      expect(preferences.credentialMode).toBe("subscription");
      expect(preferences.importMode).toBe("paste");
      expect(JSON.stringify(preferences)).not.toContain("apiKey");
    });
  });

  it("restores the in-progress source after a page refresh in the same tab", async () => {
    const sourceText = "An in-progress resume stays available after a refresh in this browser tab.";
    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: sourceText } });
    await waitFor(() => expect(window.sessionStorage.getItem("rezzie.workspace-session.v1")).toContain(sourceText));

    first.unmount();
    window.location.hash = "#workspace";
    render(<App />);

    expect((await screen.findByLabelText(/current resume/i) as HTMLTextAreaElement).value).toBe(sourceText);
  });

  it("restores the tailored editor with its saved paragraph structure", async () => {
    window.sessionStorage.setItem("rezzie.workspace-session.v1", JSON.stringify({
      step: 4,
      resume: "Original resume text that is long enough to retain in the workspace.",
      result: { tailored_resume: "Taylor Example\n\nSUMMARY\nTailored experience with grounded detail.", matched_keywords: [], review_items: [], truth_statement: "Every claim is grounded.", changes: [] },
      editorText: "Taylor Example\n\nSUMMARY\nTailored experience with grounded detail.",
      editorHtml: "<h1>Taylor Example</h1><h3>SUMMARY</h3><p>Tailored experience with grounded detail.</p>",
    }));
    window.location.hash = "#workspace";

    render(<App />);

    const editor = await screen.findByLabelText("Tailored resume");
    expect(editor.querySelector("h1")?.textContent).toBe("Taylor Example");
    expect(editor.querySelector("h3")?.textContent).toBe("SUMMARY");
    expect(editor.querySelector("p")?.textContent).toBe("Tailored experience with grounded detail.");
  });

  it("makes saved tailored drafts easy to reuse as a tailoring source", async () => {
    const savedDraft = {
      id: "draft-1", resume_id: null, label: "Product engineer - Acme", tailored_resume: "A saved tailored resume with enough grounded detail to be selected for a new role.", resume_html: null, created_at: "2026-09-13T00:00:00Z",
    };
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.includes("/tailoring-drafts") ? [savedDraft] : path.includes("/billing/me") ? { subscription_status: "none", subscription_remaining: 0, purchased_credits: 0 } : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    const sourcePicker = await screen.findByLabelText("Choose from your Rezzie library");
    expect(within(sourcePicker).getByRole("option", { name: "Product engineer - Acme" })).toBeTruthy();
    fireEvent.change(sourcePicker, { target: { value: "draft:draft-1" } });
    expect(await screen.findByText("Product engineer - Acme (saved tailored draft)")).toBeTruthy();
    expect((screen.getByRole("button", { name: /continue to the job/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("provides working landing navigation and a way back home", () => {
    render(<App />);
    expect(screen.getAllByRole("link", { name: "Features" })[0].getAttribute("href")).toBe("/features");
    expect(screen.getByRole("link", { name: "Resources" }).getAttribute("href")).toBe("/blog");
    expect(screen.getAllByRole("link", { name: "FAQ" })[0].getAttribute("href")).toBe("/faq");
    expect(within(screen.getByRole("navigation", { name: "Footer navigation" })).getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    expect(within(screen.getByRole("navigation", { name: "Footer navigation" })).getByRole("link", { name: "Blog" }).getAttribute("href")).toBe("/blog");
    expect(within(screen.getByRole("navigation", { name: "Footer navigation" })).getByRole("link", { name: "Support" }).getAttribute("href")).toBe("/#support");
    expect(within(screen.getByRole("navigation", { name: "Footer navigation" })).getByRole("link", { name: "Chrome extension" }).getAttribute("href")).toBe("/chrome-extension");
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

  it("opens the credit-pack selector before creating a checkout session", async () => {
    vi.stubEnv("VITE_CREDIT_PACK_PRICE_ID", "price_credit_pack");
    window.location.hash = "#account?purchase=credits";
    render(<App />);
    expect(await screen.findByLabelText("Packs to buy")).toBeTruthy();
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([input]) => String(input).includes("/billing/checkout"))).toBe(false);
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

  it("compares the original and tailored resumes from their actual text", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "c".repeat(10) } });
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));
    expect(await screen.findByLabelText("Tailored resume")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Original" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Side by side" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /changes/i })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Original" }));
    expect(screen.queryByLabelText("Tailored resume")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /tailored draft/i }));
    expect(screen.getByLabelText("Tailored resume").textContent).toContain(
      "A grounded tailored resume",
    );
  });

  it.each([
    { credits: 0, disabled: true },
    { credits: 1, disabled: false },
  ])("offers a standalone BYOK cover letter with $credits credits available", async ({ credits, disabled }) => {
    mockBootstrapRequests({ subscription_status: "none", subscription_remaining: 0, purchased_credits: credits, unlimited: false });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "c".repeat(10) } });
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));

    fireEvent.click(await screen.findByRole("tab", { name: "Cover letter" }));
    const coverLetterButton = screen.getByRole("button", { name: /write cover letter/i });
    expect((coverLetterButton as HTMLButtonElement).disabled).toBe(disabled);
    expect(screen.getByText(/one credit is charged/i)).toBeTruthy();
  });

  it("shows visible progress while a tailoring request is in flight", async () => {
    let resolveTailoring: ((response: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes("/api/v1/tailor")) return new Promise<Response>(resolve => { resolveTailoring = resolve; });
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }));
    }));
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "c".repeat(10) } });
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));
    expect((await screen.findByRole("status")).textContent).toContain("Tailoring your resume");
    expect(screen.getAllByText("Reading your sources")).toHaveLength(2);
    resolveTailoring?.(new Response(JSON.stringify({ tailored_resume: "A grounded tailored resume that is deliberately long enough to review and download.", matched_keywords: [], review_items: [], truth_statement: "Every claim is grounded." }), { status: 200, headers: { "Content-Type": "application/json" } }));
    expect(await screen.findByRole("button", { name: /docx/i })).toBeTruthy();
  });

  it("only saves a tailored draft after an explicit user action", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tailor my resume" }));
    fireEvent.change(screen.getByLabelText(/current resume/i), { target: { value: "a".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /continue to the job/i }));
    fireEvent.change(screen.getByLabelText(/job description text/i), { target: { value: "b".repeat(50) } });
    fireEvent.click(screen.getByRole("button", { name: /review setup/i }));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: "c".repeat(10) } });
    fireEvent.click(screen.getByRole("button", { name: /tailor my resume/i }));
    const callsBeforeSave = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBeforeSave));
    expect(screen.getByRole("button", { name: "Saved" })).toBeTruthy();
  });

  it("renders public content routes directly", () => {
    window.history.pushState({}, "", "/blog/keyword-tailoring");
    render(<App />);
    expect(screen.getByRole("heading", { name: /keyword stuffing/i })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Footer navigation" })).toBeTruthy();
  });

  it("renders the privacy policy as a public route", () => {
    window.history.pushState({}, "", "/privacy");
    render(<App />);
    expect(screen.getByRole("heading", { name: /your application materials are personal/i })).toBeTruthy();
    expect(document.title).toBe("Privacy policy | Rezzie");
  });

  it("renders the Chrome extension page as a public route", () => {
    window.history.pushState({}, "", "/chrome-extension");
    render(<App />);
    expect(screen.getByRole("heading", { name: /tailor from the job page/i })).toBeTruthy();
    expect(document.title).toBe("Chrome Extension for AI Resume Tailoring | Rezzie");
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("https://rezzie.org/social/chrome-extension.png");
    expect(document.head.querySelector('meta[name="twitter:description"]')?.getAttribute("content")).toMatch(/tailor your resume beside a job listing/i);
  });

  it("links from the features page to the Chrome extension page", () => {
    window.history.pushState({}, "", "/features");
    render(<App />);
    expect(screen.getByRole("link", { name: /explore the chrome extension/i }).getAttribute("href")).toBe("/chrome-extension");
  });

  it("exposes a searchable category-based blog library", () => {
    window.history.pushState({}, "", "/blog");
    render(<App />);
    expect(blogPosts).toHaveLength(26);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search guides" }), { target: { value: "transferable" } });
    expect(screen.getByRole("heading", { name: /transferable skills/i })).toBeTruthy();
  });
});

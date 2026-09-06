import { describe, expect, it } from "vitest";
import { extractJob } from "./content";

function page(markup: string) {
  return new DOMParser().parseFromString(markup, "text/html");
}

describe("visible job extraction", () => {
  it("prefers a meaningful job-description container and exposes a high confidence snapshot", () => {
    const snapshot = extractJob(page(`<title>Platform Engineer | Example</title><main><h1>Platform Engineer</h1><div class="company-name">Example Co</div><article>${"Build reliable systems and collaborate with product teams. ".repeat(24)}</article></main><footer>Privacy</footer>`));
    expect(snapshot.title).toBe("Platform Engineer");
    expect(snapshot.company).toBe("Example Co");
    expect(snapshot.text).toContain("Build reliable systems");
    expect(snapshot.confidence).toBe("high");
  });

  it("marks short pages as low confidence so the user reviews rather than blindly tailoring", () => {
    const snapshot = extractJob(page("<main><h1>Role</h1><p>Short posting.</p></main>"));
    expect(snapshot.confidence).toBe("low");
    expect(snapshot.text).toContain("Short posting");
  });
});

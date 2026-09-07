import { describe, expect, it } from "vitest";
import { extractJobFromPage } from "./page-extractor";

function page(markup: string) {
  return new DOMParser().parseFromString(markup, "text/html");
}

describe("visible job extraction", () => {
  it("prefers a meaningful job-description container and exposes a high confidence snapshot", () => {
    const snapshot = extractJobFromPage(page(`<title>Platform Engineer | Example</title><main><h1>Platform Engineer</h1><div class="company-name">Example Co</div><article>${"Build reliable systems and collaborate with product teams. ".repeat(24)}</article></main><footer>Privacy</footer>`), "https://example.test/job");
    expect(snapshot.title).toBe("Platform Engineer");
    expect(snapshot.company).toBe("Example Co");
    expect(snapshot.text).toContain("Build reliable systems");
    expect(snapshot.confidence).toBe("high");
  });

  it("marks short pages as low confidence so the user reviews rather than blindly tailoring", () => {
    const snapshot = extractJobFromPage(page("<main><h1>Role</h1><p>Short posting.</p></main>"), "https://example.test/job");
    expect(snapshot.confidence).toBe("low");
    expect(snapshot.text).toContain("Short posting");
  });

  it("prefers a known job board description and removes page boilerplate", () => {
    const snapshot = extractJobFromPage(page(`<main><nav>Browse jobs and create an account</nav><h1>Ignored page heading</h1><section id="content"><div class="job__description"><h1>Staff Engineer</h1>${"Own the platform roadmap and mentor engineers. ".repeat(24)}<footer>Equal opportunity employer and privacy policy</footer></div></section></main>`), "https://example.test/job");
    expect(snapshot.title).toBe("Ignored page heading");
    expect(snapshot.text).toContain("Own the platform roadmap");
    expect(snapshot.text).not.toContain("Browse jobs");
    expect(snapshot.text).not.toContain("privacy policy");
  });

  it("reads the selected Indeed sidebar job instead of the search-results page", () => {
    const snapshot = extractJobFromPage(page(`<main><h1>Software Engineer jobs in Redlands</h1><aside>Search results and filters</aside><section id="jobDescriptionText"><h2>Software Engineer</h2>${"Build and maintain dependable software with a collaborative engineering team. ".repeat(20)}</section></main>`), "https://example.test/job");
    expect(snapshot.text).toContain("Build and maintain dependable software");
    expect(snapshot.text).not.toContain("Search results and filters");
  });

  it("reads the LinkedIn description pane instead of feed content", () => {
    const snapshot = extractJobFromPage(page(`<main><h1>Software Engineer</h1><section class="feed">People you may know and recommended posts</section><section class="jobs-description__content">${"Design, build, test, and improve secure services used by customers every day. ".repeat(20)}</section></main>`), "https://example.test/job");
    expect(snapshot.text).toContain("Design, build, test, and improve secure services");
    expect(snapshot.text).not.toContain("People you may know");
  });
});

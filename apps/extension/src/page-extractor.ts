import type { JobSnapshot } from "./messages";

export function extractJobFromPage(documentToRead: Document = document, sourceUrl: string = location.href): JobSnapshot {
  const maxJobChars = 100_000;
  const nonJobContent = "script, style, noscript, nav, footer, [role='navigation'], [aria-label*='cookie' i]";
  const jobContainers = [
    "#jobDescriptionText", ".jobsearch-JobComponent-description",
    ".jobs-description__content", ".jobs-description-content__text", ".jobs-box__html-content", "#job-details",
    "#content .job__description", ".posting-description", "[data-testid='job-description']",
    "[data-automation-id='jobPostingDescription']", "[data-automation-id*='job-description' i]",
    "[class*='job-description' i]", "[id*='job-description' i]", "main", "article",
  ];
  const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
  const textFrom = (root: Element | null) => {
    if (!root) return "";
    const readable = root.cloneNode(true) as Element;
    readable.querySelectorAll(nonJobContent).forEach(node => node.remove());
    return clean(readable.textContent).slice(0, maxJobChars);
  };
  const candidates = jobContainers.flatMap((selector, priority) => Array.from(documentToRead.querySelectorAll(selector)).map(node => ({ node, priority })));
  const container = candidates
    .map(candidate => ({ ...candidate, length: textFrom(candidate.node).length }))
    .sort((left, right) => left.priority - right.priority || right.length - left.length)[0]?.node ?? documentToRead.body;
  const title = clean(documentToRead.querySelector("h1")?.textContent) || clean(documentToRead.title);
  const company = clean(documentToRead.querySelector("[data-company], [class*='company' i]")?.textContent);
  const text = textFrom(container);
  return { title: title.slice(0, 200), company: company.slice(0, 200), text, sourceUrl, confidence: text.length >= 1_000 ? "high" : text.length >= 300 ? "medium" : "low" };
}

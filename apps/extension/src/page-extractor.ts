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
  const isVisible = (node: Element) => {
    if (node.closest("[hidden], [aria-hidden='true']")) return false;
    if (!documentToRead.defaultView) return true;
    const style = documentToRead.defaultView.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return node.getClientRects().length > 0;
  };
  const candidates = jobContainers.flatMap((selector, priority) => Array.from(documentToRead.querySelectorAll(selector)).map(node => ({ node, priority })));
  const container = candidates
    .map(candidate => ({ ...candidate, length: textFrom(candidate.node).length, visible: isVisible(candidate.node) }))
    .sort((left, right) => left.priority - right.priority || Number(right.visible) - Number(left.visible) || right.length - left.length)[0]?.node ?? documentToRead.body;
  const isIndeed = new URL(sourceUrl).hostname.endsWith("indeed.com");
  const firstText = (selectors: string[]) => {
    for (const selector of selectors) {
      const value = clean(documentToRead.querySelector(selector)?.textContent);
      if (value) return value;
    }
    return "";
  };
  const title = isIndeed
    ? firstText(["[data-testid='jobsearch-JobInfoHeader-title']", "[data-testid*='JobInfoHeader-title']", "#jobsearch-ViewJobPaneWrapper h1", "#jobsearch-ViewJobPaneWrapper h2"]) || "Current Indeed selection"
    : firstText(["[data-testid='job-title']", "[data-testid*='job-title']", "h1"]) || clean(documentToRead.title);
  const company = isIndeed
    ? firstText(["[data-testid='jobsearch-JobInfoHeader-companyName']", "[data-testid*='JobInfoHeader-company']", "#jobsearch-ViewJobPaneWrapper [data-company]", "#jobsearch-ViewJobPaneWrapper [class*='company' i]"])
    : firstText(["[data-company]", "[class*='company' i]"]);
  const text = textFrom(container);
  return { title: title.slice(0, 200), company: company.slice(0, 200), text, sourceUrl, confidence: text.length >= 1_000 ? "high" : text.length >= 300 ? "medium" : "low" };
}

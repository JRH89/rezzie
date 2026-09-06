import type { ExtensionMessage, JobSnapshot } from "./messages";

const MAX_JOB_CHARS = 100_000;

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function textFrom(root: Element | null) {
  return clean(root?.textContent).slice(0, MAX_JOB_CHARS);
}

function matchingContainer(documentToRead: Document) {
  const selectors = ["main", "article", "[data-automation-id*='job']", "[class*='job-description' i]", "[id*='job-description' i]"];
  const candidates = selectors.flatMap(selector => Array.from(documentToRead.querySelectorAll(selector)));
  return candidates.map(node => ({ node, length: textFrom(node).length })).sort((left, right) => right.length - left.length)[0]?.node ?? documentToRead.body;
}

export function extractJob(documentToRead: Document = document): JobSnapshot {
  const title = clean(documentToRead.querySelector("h1")?.textContent) || clean(documentToRead.title);
  const company = clean(documentToRead.querySelector("[data-company], [class*='company' i]")?.textContent);
  const text = textFrom(matchingContainer(documentToRead));
  return {
    title: title.slice(0, 200), company: company.slice(0, 200), text,
    sourceUrl: location.href,
    confidence: text.length >= 1_000 ? "high" : text.length >= 300 ? "medium" : "low",
  };
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type !== "extract-job") return undefined;
  sendResponse({ type: "job-extracted", snapshot: extractJob() } satisfies ExtensionMessage);
  return undefined;
});

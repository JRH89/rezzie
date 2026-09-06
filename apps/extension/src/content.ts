import type { ExtensionMessage, JobSnapshot } from "./messages";

const MAX_JOB_CHARS = 100_000;
const NON_JOB_CONTENT = "script, style, noscript, nav, footer, [role='navigation'], [aria-label*='cookie' i]";
const JOB_CONTAINERS = [
  "#content .job__description", // Greenhouse
  ".posting-description", // Lever
  "[data-testid='job-description']", // Ashby
  "[data-automation-id='jobPostingDescription']", // Workday
  "[data-automation-id*='job-description' i]",
  "[class*='job-description' i]",
  "[id*='job-description' i]",
  "main",
  "article",
];

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function textFrom(root: Element | null) {
  if (!root) return "";
  const readable = root.cloneNode(true) as Element;
  readable.querySelectorAll(NON_JOB_CONTENT).forEach(node => node.remove());
  return clean(readable.textContent).slice(0, MAX_JOB_CHARS);
}

function matchingContainer(documentToRead: Document) {
  const candidates = JOB_CONTAINERS.flatMap((selector, priority) => Array.from(documentToRead.querySelectorAll(selector)).map(node => ({ node, priority })));
  return candidates
    .map(candidate => ({ ...candidate, length: textFrom(candidate.node).length }))
    .sort((left, right) => left.priority - right.priority || right.length - left.length)[0]?.node ?? documentToRead.body;
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

type ContentScriptGlobal = typeof globalThis & { __rezzieContentScriptInstalled?: boolean };
const pageGlobal = globalThis as ContentScriptGlobal;

if (typeof chrome !== "undefined" && !pageGlobal.__rezzieContentScriptInstalled) {
  pageGlobal.__rezzieContentScriptInstalled = true;
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type !== "extract-job") return undefined;
    sendResponse({ type: "job-extracted", snapshot: extractJob() } satisfies ExtensionMessage);
    return undefined;
  });
}

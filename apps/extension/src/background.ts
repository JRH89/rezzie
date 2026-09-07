import type { ExtensionMessage, JobSnapshot } from "./messages";
import { extractJobFromPage } from "./page-extractor";

const OFFSCREEN_PATH = "offscreen.html";

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)] });
  if (!contexts.length) await chrome.offscreen.createDocument({ url: OFFSCREEN_PATH, reasons: ["IFRAME_SCRIPTING"], justification: "Relay the user-initiated Google sign-in flow from Rezzie's trusted auth page." });
}

async function extractCurrentJob(): Promise<JobSnapshot> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Return to the job tab, then open Rezzie from the browser toolbar.");
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobFromPage });
    if (!result) throw new Error("No page content was returned.");
    return result;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "Chrome did not allow access.";
    throw new Error(`Rezzie could not read this tab. Reload the extension once, then retry. Chrome said: ${detail}`, { cause: reason });
  }
}

chrome.runtime.onInstalled.addListener(() => { void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); });
chrome.action.onClicked.addListener(tab => { void chrome.sidePanel.open({ windowId: tab.windowId }); });

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "extract-job") {
    void extractCurrentJob().then(snapshot => sendResponse({ type: "job-extracted", snapshot } satisfies ExtensionMessage)).catch(error => sendResponse({ type: "job-extracted", snapshot: { title: "", company: "", text: "", sourceUrl: "", confidence: "low" }, error: error instanceof Error ? error.message : "We could not read this page." }));
    return true;
  }
  if (message.type === "google-auth") {
    void ensureOffscreenDocument().then(() => chrome.runtime.sendMessage({ type: "google-auth-offscreen" } satisfies ExtensionMessage)).then(response => sendResponse(response)).catch(error => sendResponse({ type: "google-auth-result", error: error instanceof Error ? error.message : "Google sign-in could not start." } satisfies ExtensionMessage));
    return true;
  }
  return undefined;
});

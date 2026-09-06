import type { ExtensionMessage, JobSnapshot } from "./messages";

const OFFSCREEN_PATH = "offscreen.html";

async function ensureOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)] });
  if (!contexts.length) await chrome.offscreen.createDocument({ url: OFFSCREEN_PATH, reasons: ["IFRAME_SCRIPTING"], justification: "Relay the user-initiated Google sign-in flow from Rezzie's trusted auth page." });
}

async function extractCurrentJob(): Promise<JobSnapshot> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab.id || !tab.url?.startsWith("http")) throw new Error("Open a public job-description page first.");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  const response = await chrome.tabs.sendMessage(tab.id, { type: "extract-job" } satisfies ExtensionMessage) as ExtensionMessage;
  if (response.type !== "job-extracted") throw new Error("We could not read this page.");
  return response.snapshot;
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

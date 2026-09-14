import type { ExtensionMessage, JobSnapshot } from "./messages";
import { extractJobFromPage } from "./page-extractor";

const webBaseUrl = (import.meta.env.VITE_WEB_BASE_URL ?? "https://rezzie.org").replace(/\/$/, "");
const webOrigin = new URL(webBaseUrl).origin;
const extensionAuthUrl = `${webBaseUrl}/extension-auth?extension_id=${chrome.runtime.id}`;
const googleAuthRequestKey = "google-auth-request";
const googleAuthRequestTtlMs = 10 * 60 * 1_000;

type PendingGoogleAuth = { requestId: string; createdAt: number };

async function startGoogleAuthentication() {
  const requestId = crypto.randomUUID();
  await chrome.storage.session.set({ [googleAuthRequestKey]: { requestId, createdAt: Date.now() } satisfies PendingGoogleAuth });
  await chrome.tabs.create({ url: `${extensionAuthUrl}&request_id=${encodeURIComponent(requestId)}` });
}

async function completeGoogleAuthentication(message: ExtensionMessage, sender: chrome.runtime.MessageSender) {
  const senderUrl = sender.url ? new URL(sender.url) : undefined;
  if (message.type !== "google-auth-result" || !message.token || !message.request_id || senderUrl?.origin !== webOrigin || senderUrl.pathname !== "/extension-auth") {
    throw new Error("Unrecognized extension sign-in response.");
  }
  const stored = await chrome.storage.session.get(googleAuthRequestKey);
  const pending = stored[googleAuthRequestKey] as PendingGoogleAuth | undefined;
  if (!pending || pending.requestId !== message.request_id || Date.now() - pending.createdAt > googleAuthRequestTtlMs) {
    throw new Error("This Rezzie sign-in request expired. Start it again from the extension.");
  }
  await chrome.storage.session.remove(googleAuthRequestKey);
  await chrome.runtime.sendMessage(message);
  if (sender.tab?.id) await chrome.tabs.remove(sender.tab.id);
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
    void startGoogleAuthentication().then(() => sendResponse({ type: "google-auth-pending" } satisfies ExtensionMessage)).catch(error => sendResponse({ type: "google-auth-result", error: error instanceof Error ? error.message : "Google sign-in could not start." } satisfies ExtensionMessage));
    return true;
  }
  return undefined;
});

chrome.runtime.onMessageExternal.addListener((message: ExtensionMessage, sender, sendResponse) => {
  void completeGoogleAuthentication(message, sender)
    .then(() => sendResponse({ ok: true }))
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Google sign-in could not finish." }));
  return true;
});

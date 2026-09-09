import type { ExtensionMessage } from "./messages";

const bridgeUrl = `${import.meta.env.VITE_WEB_BASE_URL ?? "https://rezzie.org"}/extension-auth`;
const bridgeOrigin = new URL(bridgeUrl).origin;
const iframe = document.createElement("iframe");
iframe.src = bridgeUrl;
iframe.hidden = true;

let markBridgeReady: (() => void) | undefined;
const bridgeReady = new Promise<void>(resolve => {
  markBridgeReady = resolve;
});

window.addEventListener("message", event => {
  if (event.origin !== bridgeOrigin || event.source !== iframe.contentWindow || !event.data || typeof event.data !== "object") return;
  if ((event.data as { type?: string }).type === "rezzie-extension-auth-ready") markBridgeReady?.();
});

document.body.append(iframe);

function waitForBridge() {
  return Promise.race([
    bridgeReady,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Rezzie sign-in page did not become ready. Check your connection and try again.")), 15_000)),
  ]);
}

async function requestGoogleToken() {
  await waitForBridge();
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Google sign-in timed out.")), 120_000);
    function receive(event: MessageEvent<unknown>) {
      if (event.origin !== bridgeOrigin || event.source !== iframe.contentWindow || !event.data || typeof event.data !== "object") return;
      const data = event.data as { type?: string; token?: string; error?: string };
      if (data.type !== "rezzie-extension-auth-result") return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      if (data.token) resolve(data.token); else reject(new Error(data.error ?? "Google sign-in failed."));
    }
    window.addEventListener("message", receive);
    iframe.contentWindow?.postMessage({ type: "rezzie-extension-auth-request" }, bridgeOrigin);
  });
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type !== "google-auth-offscreen") return undefined;
  void requestGoogleToken().then(token => sendResponse({ type: "google-auth-result", token } satisfies ExtensionMessage)).catch(error => sendResponse({ type: "google-auth-result", error: error instanceof Error ? error.message : "Google sign-in failed." } satisfies ExtensionMessage));
  return true;
});

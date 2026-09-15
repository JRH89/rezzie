import { useState } from "react";
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";

const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const auth = Object.values(config).every(Boolean) ? getAuth(initializeApp(config)) : undefined;

type ChromeRuntime = {
  lastError?: { message?: string };
  sendMessage(extensionId: string, message: unknown, callback?: (response?: { ok?: boolean; error?: string }) => void): void;
};

type AuthRequest = { extensionId: string; requestId: string };

function requestedAuthRequest(): AuthRequest | undefined {
  const query = new URLSearchParams(window.location.search);
  const extensionId = query.get("extension_id");
  const requestId = query.get("request_id");
  if (!extensionId || !/^[a-p]{32}$/.test(extensionId) || !requestId || !/^[\w-]{20,100}$/.test(requestId)) return undefined;
  return { extensionId, requestId };
}

function runtimeForPage() {
  return (window as Window & { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

function authenticationErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "code" in error && typeof error.code === "string") {
    return `Google sign-in failed: ${error.code.replace("auth/", "").replaceAll("-", " ")}.`;
  }
  return "Google sign-in was unavailable. Please try again.";
}

export function ExtensionAuthBridge() {
  const authRequest = requestedAuthRequest();
  const [message, setMessage] = useState(authRequest ? "Continue with Google to return to Rezzie." : "Open this page from the Rezzie extension to sign in.");
  const [error, setError] = useState<string>();

  async function sendTokenToExtension(token: string) {
    const runtime = runtimeForPage();
    if (!authRequest || !runtime) throw new Error("Return to the Rezzie extension and start Google sign-in again.");
    await new Promise<void>((resolve, reject) => {
      runtime.sendMessage(authRequest.extensionId, { type: "google-auth-result", token, request_id: authRequest.requestId }, response => {
        const runtimeError = runtime.lastError?.message;
        if (runtimeError) reject(new Error(runtimeError));
        else if (!response?.ok) reject(new Error(response?.error ?? "Rezzie could not accept this sign-in."));
        else resolve();
      });
    });
  }

  async function signIn() {
    if (!auth) { setError("Rezzie authentication is not configured."); return; }
    setError(undefined);
    setMessage("Opening Google sign-in…");
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      await sendTokenToExtension(await credential.user.getIdToken());
      setMessage("Signed in. Returning you to Rezzie…");
    } catch (reason) {
      const nextError = authenticationErrorMessage(reason);
      setError(nextError);
      setMessage("Google sign-in did not complete.");
    }
  }

  return <main className="auth-screen"><div className="auth-card"><p className="eyebrow">REZZIE EXTENSION</p><h1>Connect your account.</h1><p>{message}</p>{authRequest && <button className="google-button extension-google-button" onClick={() => void signIn()} type="button"><span aria-hidden="true">G</span> Continue with Google <b aria-hidden="true">→</b></button>}{error && <p role="alert">{error}</p>}</div></main>;
}

import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";

const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const auth = Object.values(config).every(Boolean) ? getAuth(initializeApp(config)) : undefined;
const allowedIds = (import.meta.env.VITE_CHROME_EXTENSION_IDS ?? "").split(",").map((value: string) => value.trim()).filter(Boolean);

function extensionOrigin(origin: string) {
  const match = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin);
  return Boolean(match && (import.meta.env.DEV || allowedIds.includes(match[1])));
}

function authenticationErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "code" in error && typeof error.code === "string") {
    return `Google sign-in failed: ${error.code.replace("auth/", "").replaceAll("-", " ")}.`;
  }
  return "Google sign-in was unavailable. Please try again.";
}

export function ExtensionAuthBridge() {
  const [message, setMessage] = useState("Waiting for the Rezzie extension…");
  useEffect(() => {
    async function receive(event: MessageEvent<unknown>) {
      if (!extensionOrigin(event.origin) || !event.data || typeof event.data !== "object") return;
      if ((event.data as { type?: string }).type !== "rezzie-extension-auth-request") return;
      const destination = event.source as Window | null;
      if (!auth) { destination?.postMessage({ type: "rezzie-extension-auth-result", error: "Rezzie authentication is not configured." }, { targetOrigin: event.origin }); return; }
      setMessage("Choose your Google account to continue.");
      try {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider());
        destination?.postMessage({ type: "rezzie-extension-auth-result", token: await credential.user.getIdToken() }, { targetOrigin: event.origin });
        setMessage("Signed in. You can return to the extension.");
      } catch (error) {
        const message = authenticationErrorMessage(error);
        destination?.postMessage({ type: "rezzie-extension-auth-result", error: message }, { targetOrigin: event.origin });
        setMessage(message);
      }
    }
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "rezzie-extension-auth-ready" }, "*");
    return () => window.removeEventListener("message", receive);
  }, []);
  return <main className="auth-screen"><div className="auth-card"><p className="eyebrow">REZZIE EXTENSION</p><h1>Connect your account.</h1><p>{message}</p></div></main>;
}

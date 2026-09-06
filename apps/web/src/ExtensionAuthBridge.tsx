import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";

const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const auth = Object.values(config).every(Boolean) ? getAuth(initializeApp(config)) : undefined;
const allowedIds = (import.meta.env.VITE_CHROME_EXTENSION_IDS ?? "").split(",").map((value: string) => value.trim()).filter(Boolean);

function extensionOrigin(origin: string) {
  const match = /^chrome-extension:\/\/([a-p]{32})$/.exec(origin);
  return match && allowedIds.includes(match[1]);
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
      } catch {
        destination?.postMessage({ type: "rezzie-extension-auth-result", error: "Google sign-in was cancelled or unavailable." }, { targetOrigin: event.origin });
        setMessage("Google sign-in did not complete. Return to the extension and try again.");
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return <main className="auth-screen"><div className="auth-card"><p className="eyebrow">REZZIE EXTENSION</p><h1>Connect your account.</h1><p>{message}</p></div></main>;
}

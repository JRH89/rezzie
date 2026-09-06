import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, User, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";

import { App } from "./App";
import { BrandMark } from "./BrandMark";

const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const firebaseAuth = firebaseConfigured ? getAuth(initializeApp(firebaseConfig)) : undefined;

function messageFor(error: unknown) {
  if (typeof error === "object" && error && "code" in error && typeof error.code === "string") return error.code.replace("auth/", "").replaceAll("-", " ");
  return "We could not complete that request. Please try again.";
}

function AuthenticationDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  async function google() { if (!firebaseAuth) return; setBusy(true); setError(undefined); try { await signInWithPopup(firebaseAuth, new GoogleAuthProvider()); onClose(); } catch (reason) { setError(messageFor(reason)); } finally { setBusy(false); } }
  async function submit() { if (!firebaseAuth) return; setBusy(true); setError(undefined); setNotice(undefined); try { if (mode === "sign-up") await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password); else await signInWithEmailAndPassword(firebaseAuth, email.trim(), password); onClose(); } catch (reason) { setError(messageFor(reason)); } finally { setBusy(false); } }
  async function resetPassword() { if (!firebaseAuth || !email.trim()) { setError("Enter your email address first."); return; } setBusy(true); setError(undefined); try { await sendPasswordResetEmail(firebaseAuth, email.trim()); setNotice("Password-reset email sent. Check your inbox."); } catch (reason) { setError(messageFor(reason)); } finally { setBusy(false); } }
  return <main className="auth-screen"><div className="auth-card"><button className="auth-close" aria-label="Close sign in" onClick={onClose} type="button">×</button><BrandMark /><p className="eyebrow">REZZIE ACCOUNT</p><h1>{mode === "sign-up" ? "Make your next move." : "Welcome back."}</h1><p>{mode === "sign-up" ? "Create a private account to save Career Records and use Rezzie credits." : "Sign in to continue your application work."}</p><button className="google-button" disabled={busy} onClick={() => void google()} type="button"><span>G</span> Continue with Google</button><div className="auth-divider"><span>or</span></div><label htmlFor="auth-email">Email</label><input autoComplete="email" id="auth-email" onChange={event => setEmail(event.target.value)} type="email" value={email} /><label htmlFor="auth-password">Password</label><input autoComplete={mode === "sign-up" ? "new-password" : "current-password"} id="auth-password" minLength={8} onChange={event => setPassword(event.target.value)} type="password" value={password} /><button className="button button-primary auth-submit" disabled={busy || !email.trim() || password.length < 8} onClick={() => void submit()} type="button">{mode === "sign-up" ? "Create account" : "Sign in"}</button>{mode === "sign-in" && <button className="auth-link" disabled={busy} onClick={() => void resetPassword()} type="button">Forgot password?</button>}{error && <p className="auth-error" role="alert">{error}</p>}{notice && <p className="auth-notice">{notice}</p>}<p className="auth-switch">{mode === "sign-up" ? "Already have an account?" : "New to Rezzie?"} <button onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setError(undefined); }} type="button">{mode === "sign-up" ? "Sign in" : "Create one"}</button></p></div></main>;
}

function FirebaseApplication() {
  const [user, setUser] = useState<User | null>();
  const [token, setToken] = useState<string>();
  const [showAuthentication, setShowAuthentication] = useState(false);
  useEffect(() => onAuthStateChanged(firebaseAuth!, async currentUser => { setUser(currentUser); setToken(currentUser ? await currentUser.getIdToken() : undefined); }), []);
  if (user === undefined) return <main className="auth-screen"><BrandMark /><div className="auth-card"><span className="auth-loader" /><p>Checking your secure session…</p></div></main>;
  return <><App accessToken={token} isAuthenticated={Boolean(user)} onSignIn={() => setShowAuthentication(true)} onSignOut={() => void signOut(firebaseAuth!)} />{showAuthentication && <AuthenticationDialog onClose={() => setShowAuthentication(false)} />}</>;
}

export function ApplicationRoot() { return firebaseConfigured ? <FirebaseApplication /> : <App />; }

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth/web-extension";

import type { JobSnapshot } from "./messages";
import { clearSessionToken, readSessionToken, storeSessionToken } from "./session-token";
import "./sidepanel.css";

type AuthMode = "sign-in" | "sign-up";
type CredentialMode = "byok" | "subscription";
type Resume = { id: string; label: string; source_text: string };
type Result = { tailored_resume: string; matched_keywords: string[]; review_items: string[]; truth_statement: string };

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const auth = Object.values(firebaseConfig).every(Boolean) ? getAuth(initializeApp(firebaseConfig)) : undefined;

function Brand() {
  return <img alt="Rezzie" className="brand-logo" src="icons/rezzie-logo.png" />;
}

function authErrorMessage(reason: unknown) {
  if (typeof reason === "object" && reason && "code" in reason && typeof reason.code === "string") return reason.code.replace("auth/", "").replaceAll("-", " ");
  return "We could not complete that request. Please try again.";
}

function App() {
  const [token, setToken] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [job, setJob] = useState<JobSnapshot>();
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [credentialMode, setCredentialMode] = useState<CredentialMode>("subscription");
  const [apiKey, setApiKey] = useState("");

  const api = useMemo(() => async <T,>(path: string, options: RequestInit = {}) => {
    const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL ?? "https://api.rezzie.org").replace(/\/$/, "")}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail ?? "Request failed.");
    }
    return response.json() as Promise<T>;
  }, [token]);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, user => {
      void (async () => {
        if (user) {
          const nextToken = await user.getIdToken();
          await storeSessionToken(nextToken);
          setToken(nextToken);
          return;
        }
        setToken(await readSessionToken());
      })();
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    void api<Resume[]>("/api/v1/resumes")
      .then(items => {
        setResumes(items);
        setResumeId(items[0]?.id ?? "");
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Could not load resumes."));
  }, [api, token]);

  async function extract() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await chrome.runtime.sendMessage({ type: "extract-job" }) as { snapshot: JobSnapshot; error?: string };
      if (response.error) throw new Error(response.error);
      setJob(response.snapshot);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not extract this job.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmailAuthentication() {
    if (!auth) {
      setError("Extension Firebase settings are missing.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (authMode === "sign-up") await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await chrome.runtime.sendMessage({ type: "google-auth" }) as { token?: string; error?: string };
      if (!response.token) throw new Error(response.error ?? "Google sign-in failed.");
      await storeSessionToken(response.token);
      setToken(response.token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function tailor() {
    const resume = resumes.find(item => item.id === resumeId);
    if (!resume || !job) return;
    setBusy(true);
    setError(undefined);
    try {
      setResult(await api<Result>("/api/v1/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resume.source_text,
          job_description: job.text,
          credential_mode: credentialMode,
          ...(credentialMode === "byok" ? { api_key: apiKey } : {}),
        }),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tailoring failed.");
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "txt" | "pdf" | "docx") {
    if (!result) return;
    setBusy(true);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL ?? "https://api.rezzie.org").replace(/\/$/, "");
      const path = format === "pdf" ? "/api/v1/resumes/export/pdf" : "/api/v1/resumes/export";
      const response = format === "txt"
        ? new Response(new Blob([result.tailored_resume], { type: "text/plain" }))
        : await fetch(`${base}${path}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ resume_text: result.tailored_resume }),
        });
      if (!response.ok) throw new Error("Could not create the download.");
      const url = URL.createObjectURL(await response.blob());
      await chrome.downloads.download({ url, filename: `rezzie-tailored-resume.${format}`, saveAs: true });
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the download.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    const isSignUp = authMode === "sign-up";
    return <main className="panel auth-panel">
      <Brand />
      <div className="intro">
        <span className="eyebrow">YOUR REZZIE ACCOUNT</span>
        <h1>{isSignUp ? "Start with what is true." : "Bring your application work with you."}</h1>
        <p>{isSignUp ? "Create a private account to save resumes and use Rezzie credits." : "Sign in to use your saved resumes and shared credits."}</p>
      </div>
      <button className="button secondary" disabled={busy} onClick={() => void google()} type="button">Continue with Google</button>
      <label>Email<input autoComplete="email" onChange={event => setEmail(event.target.value)} type="email" value={email} /></label>
      <label>Password<input autoComplete={isSignUp ? "new-password" : "current-password"} minLength={8} onChange={event => setPassword(event.target.value)} type="password" value={password} /></label>
      <button className="button" disabled={busy || !email.trim() || password.length < 8} onClick={() => void submitEmailAuthentication()} type="button">{busy ? "Working..." : isSignUp ? "Create account" : "Sign in"}</button>
      <p className="auth-switch">{isSignUp ? "Already have an account?" : "New to Rezzie?"} <button className="text-button" disabled={busy} onClick={() => { setAuthMode(isSignUp ? "sign-in" : "sign-up"); setError(undefined); }} type="button">{isSignUp ? "Sign in" : "Create one"}</button></p>
      {error && <p role="alert">{error}</p>}
    </main>;
  }

  return <main className="panel">
    <header><Brand /><button className="text-button" onClick={() => { setToken(undefined); void clearSessionToken(); if (auth) void signOut(auth); }} type="button">Sign out</button></header>
    <section className="intro"><span className="eyebrow">TAILOR THIS ROLE</span><h1>Start from what is already true.</h1><p>Read the job page, choose a saved resume, then review the tailored draft.</p></section>
    <button className="button" disabled={busy} onClick={() => void extract()} type="button">{busy ? "Reading page..." : job ? "Refresh job text" : "Read this job page"}</button>
    {job && <section className="workflow">
      <label>Job description<textarea onChange={event => setJob({ ...job, text: event.target.value })} value={job.text} /></label>
      <label>Saved resume<select onChange={event => setResumeId(event.target.value)} value={resumeId}>{resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.label}</option>)}</select></label>
      {!resumes.length && <p className="hint">Save a resume in Rezzie first, then reopen this panel.</p>}
      <label>Tailoring access<select onChange={event => setCredentialMode(event.target.value as CredentialMode)} value={credentialMode}><option value="subscription">Use a Rezzie credit</option><option value="byok">Use my Anthropic key</option></select></label>
      {credentialMode === "byok" && <label>Anthropic API key<input autoComplete="off" onChange={event => setApiKey(event.target.value)} type="password" value={apiKey} /><span className="hint">Used for this request only. It is never saved.</span></label>}
      <button className="button" disabled={busy || !resumeId || job.text.length < 50 || (credentialMode === "byok" && !apiKey.trim())} onClick={() => void tailor()} type="button">{busy ? "Tailoring..." : credentialMode === "byok" ? "Tailor with my key" : "Tailor with a credit"}</button>
    </section>}
    {result && <section className="result-card"><div><span className="eyebrow">DRAFT READY</span><h2>Choose your format.</h2></div><textarea readOnly value={result.tailored_resume} /><p className="truth-note">{result.truth_statement}</p><div className="download-actions"><button className="button secondary" disabled={busy} onClick={() => void download("docx")} type="button">DOCX</button><button className="button secondary" disabled={busy} onClick={() => void download("pdf")} type="button">PDF</button><button className="button secondary" disabled={busy} onClick={() => void download("txt")} type="button">TXT</button></div></section>}
    {error && <p role="alert">{error}</p>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);

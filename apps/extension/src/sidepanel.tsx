import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth/web-extension";
import type { JobSnapshot } from "./messages";
import { clearSessionToken, readSessionToken, storeSessionToken } from "./session-token";
import "./sidepanel.css";

type Resume = { id: string; label: string; source_text: string };
type Result = { tailored_resume: string; matched_keywords: string[]; review_items: string[]; truth_statement: string };
const firebaseConfig = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
const auth = Object.values(firebaseConfig).every(Boolean) ? getAuth(initializeApp(firebaseConfig)) : undefined;

function App() {
  const [token, setToken] = useState<string>(); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [resumes, setResumes] = useState<Resume[]>([]); const [resumeId, setResumeId] = useState(""); const [job, setJob] = useState<JobSnapshot>(); const [result, setResult] = useState<Result>(); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false);
  const api = useMemo(() => async <T,>(path: string, options: RequestInit = {}) => { const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL ?? "https://api.rezzie.org").replace(/\/$/, "")}${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? "Request failed."); } return response.json() as Promise<T>; }, [token]);
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
  useEffect(() => { if (token) void api<Resume[]>("/api/v1/resumes").then(items => { setResumes(items); setResumeId(items[0]?.id ?? ""); }).catch(reason => setError(reason instanceof Error ? reason.message : "Could not load resumes.")); }, [api, token]);
  async function extract() { setBusy(true); setError(undefined); try { const response = await chrome.runtime.sendMessage({ type: "extract-job" }) as { snapshot: JobSnapshot; error?: string }; if (response.error) throw new Error(response.error); setJob(response.snapshot); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not extract this job."); } finally { setBusy(false); } }
  async function signIn() { if (!auth) return setError("Extension Firebase settings are missing."); setBusy(true); try { await signInWithEmailAndPassword(auth, email.trim(), password); } catch { setError("Sign-in failed. Check your email and password."); } finally { setBusy(false); } }
  async function google() { setBusy(true); setError(undefined); try { const response = await chrome.runtime.sendMessage({ type: "google-auth" }) as { token?: string; error?: string }; if (!response.token) throw new Error(response.error ?? "Google sign-in failed."); await storeSessionToken(response.token); setToken(response.token); } catch (reason) { setError(reason instanceof Error ? reason.message : "Google sign-in failed."); } finally { setBusy(false); } }
  async function tailor() { const resume = resumes.find(item => item.id === resumeId); if (!resume || !job) return; setBusy(true); setError(undefined); try { setResult(await api<Result>("/api/v1/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_text: resume.source_text, job_description: job.text, credential_mode: "subscription" }) })); } catch (reason) { setError(reason instanceof Error ? reason.message : "Tailoring failed."); } finally { setBusy(false); } }
  async function download(format: "txt" | "pdf" | "docx") { if (!result) return; setBusy(true); try { const base = (import.meta.env.VITE_API_BASE_URL ?? "https://api.rezzie.org").replace(/\/$/, ""); const path = format === "pdf" ? "/api/v1/resumes/export/pdf" : "/api/v1/resumes/export"; const response = format === "txt" ? new Response(new Blob([result.tailored_resume], { type: "text/plain" })) : await fetch(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ resume_text: result.tailored_resume }) }); if (!response.ok) throw new Error("Could not create the download."); const url = URL.createObjectURL(await response.blob()); await chrome.downloads.download({ url, filename: `rezzie-tailored-resume.${format}`, saveAs: true }); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create the download."); } finally { setBusy(false); } }
  if (!token) return <main><h1>rezzie</h1><p>Sign in to use your saved resumes and shared credits.</p><button disabled={busy} onClick={() => void google()}>Continue with Google</button><p className="hint">Google sign-in requires the published extension ID to be allow-listed in Firebase.</p><input aria-label="Email" value={email} onChange={event => setEmail(event.target.value)} type="email" /><input aria-label="Password" value={password} onChange={event => setPassword(event.target.value)} type="password" /><button disabled={busy || !email || !password} onClick={() => void signIn()}>Sign in</button>{error && <p role="alert">{error}</p>}</main>;
  return <main><header><h1>rezzie</h1><button onClick={() => { setToken(undefined); void clearSessionToken(); if (auth) void signOut(auth); }}>Sign out</button></header><p>Review the job page, choose a saved resume, then tailor a truthful draft.</p><button disabled={busy} onClick={() => void extract()}>{job ? "Refresh job text" : "Read this job page"}</button>{job && <><label>Job description<textarea value={job.text} onChange={event => setJob({ ...job, text: event.target.value })} /></label><label>Saved resume<select value={resumeId} onChange={event => setResumeId(event.target.value)}>{resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.label}</option>)}</select></label>{!resumes.length && <p className="hint">Save a resume in Rezzie first, then reopen this panel.</p>}<button disabled={busy || !resumeId || job.text.length < 50} onClick={() => void tailor()}>Tailor with a credit</button></>}{result && <section><h2>Draft ready</h2><textarea value={result.tailored_resume} readOnly /><p>{result.truth_statement}</p><button disabled={busy} onClick={() => void download("docx")}>Download DOCX</button><button disabled={busy} onClick={() => void download("pdf")}>Download PDF</button><button disabled={busy} onClick={() => void download("txt")}>Download TXT</button></section>}{error && <p role="alert">{error}</p>}</main>;
}
createRoot(document.getElementById("root")!).render(<App />);

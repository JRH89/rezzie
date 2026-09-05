import { ChangeEvent, useState } from "react";
import { api, TailoringResult } from "./api";

type ImportMode = "paste" | "url" | "file";
const minLength = 50;

export function App() {
  const [resume, setResume] = useState(""); const [job, setJob] = useState(""); const [key, setKey] = useState("");
  const [url, setUrl] = useState(""); const [mode, setMode] = useState<ImportMode>("paste");
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string>(); const [result, setResult] = useState<TailoringResult>();
  const importJob = async (event?: ChangeEvent<HTMLInputElement>) => {
    setError(undefined); setLoading(true);
    try { const imported = mode === "url" ? await api.importUrl(url) : mode === "file" && event?.target.files?.[0] ? await api.importFile(event.target.files[0]) : await api.importText(job); setJob(imported.text); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not import job description."); } finally { setLoading(false); }
  };
  const tailor = async () => { setError(undefined); setLoading(true); try { setResult(await api.tailor({ resume_text: resume, job_description: job, credential_mode: "byok", api_key: key })); } catch (reason) { setError(reason instanceof Error ? reason.message : "Tailoring failed."); } finally { setLoading(false); } };
  const ready = resume.length >= minLength && job.length >= minLength && key.length >= 10;
  return <main><header><p className="eyebrow">REZZIE / PRIVATE BY DESIGN</p><h1>Match the role. Keep the truth.</h1><p className="lede">Tailor your existing resume against a job description—without inventing a single claim.</p></header>
    <section className="card"><label htmlFor="resume">Your current resume <span>Plain text for this foundation</span></label><textarea id="resume" value={resume} onChange={e => setResume(e.target.value)} placeholder="Paste the resume you want to tailor…" /></section>
    <section className="card"><fieldset><legend>Job description</legend><div className="tabs">{(["paste","url","file"] as ImportMode[]).map(item => <button className={mode === item ? "active" : ""} onClick={() => setMode(item)} key={item} type="button">{item === "paste" ? "Paste text" : item === "url" ? "Import URL" : "Upload .txt"}</button>)}</div>{mode === "paste" && <textarea aria-label="Job description text" value={job} onChange={e => setJob(e.target.value)} placeholder="Paste the complete job description…" />}{mode === "url" && <><input aria-label="Job description URL" value={url} onChange={e => setUrl(e.target.value)} type="url" placeholder="https://company.com/jobs/role"/><button onClick={() => importJob()} disabled={!url || loading} type="button">Import URL</button></>}{mode === "file" && <input aria-label="Job description file" onChange={importJob} accept=".txt,.md,text/plain,text/markdown" type="file" />}</fieldset></section>
    <section className="card"><label htmlFor="apiKey">Your Anthropic API key <span>Used only for this request; never saved.</span></label><input id="apiKey" value={key} onChange={e => setKey(e.target.value)} type="password" autoComplete="off" placeholder="sk-ant-…"/><p className="hint">Subscription mode will be available after secure account and billing setup.</p></section>
    {error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={!ready || loading} onClick={tailor}>{loading ? "Working…" : "Tailor my resume"}</button>
    {result && <section className="result"><p className="eyebrow">REVIEW BEFORE USE</p><h2>Your tailored draft</h2><textarea aria-label="Tailored resume" readOnly value={result.tailored_resume}/><h3>Keywords grounded in your resume</h3><p>{result.matched_keywords.join(" · ") || "None identified"}</p><h3>Items requiring your review</h3><ul>{result.review_items.map(item => <li key={item}>{item}</li>)}</ul><p className="truth">{result.truth_statement}</p></section>}</main>;
}

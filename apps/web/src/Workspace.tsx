import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { BrandMark } from "./BrandMark";
import { CareerFact, CareerRecord, createApi, CreditBalance, TailoringResult } from "./api";

type ImportMode = "paste" | "url" | "file";
type CredentialMode = "byok" | "subscription";
type Step = 1 | 2 | 3 | 4;
const minLength = 50;
const fileTypes = ".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const stepLabels = ["Your experience", "The job", "Tailor", "Review"];

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function saveResume(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rezzie-tailored-resume.docx";
  anchor.click();
  URL.revokeObjectURL(url);
}

function isResumeHeading(line: string) {
  return ["SUMMARY", "PROFESSIONAL SUMMARY", "PROFILE", "SKILLS", "CORE SKILLS", "TECHNICAL SKILLS", "EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "AWARDS", "VOLUNTEERING"].includes(line.replace(":", "").trim().toUpperCase());
}

function ResumePreview({ text }: { text: string }) {
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  return <article className="resume-document" aria-label="Tailored resume">
    {lines.map((line, index) => {
      if (index === 0) return <h2 key={`${index}-${line}`}>{line}</h2>;
      if (index === 1) return <p className="resume-contact" key={`${index}-${line}`}>{line}</p>;
      if (isResumeHeading(line)) return <h3 key={`${index}-${line}`}>{line.replace(/:$/, "")}</h3>;
      if (["- ", "* ", "• "].some(prefix => line.startsWith(prefix))) return <p className="resume-bullet" key={`${index}-${line}`}>{line.slice(2)}</p>;
      return <p key={`${index}-${line}`}>{line}</p>;
    })}
  </article>;
}

export function Workspace({ accessToken, onHome }: { accessToken?: string; onHome: () => void }) {
  const api = useMemo(() => createApi(accessToken), [accessToken]);
  const [step, setStep] = useState<Step>(1);
  const [resume, setResume] = useState("");
  const [recordLabel, setRecordLabel] = useState("My Career Record");
  const [records, setRecords] = useState<CareerRecord[]>([]);
  const [careerRecord, setCareerRecord] = useState<CareerRecord>();
  const [newFact, setNewFact] = useState("");
  const [job, setJob] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("paste");
  const [credentialMode, setCredentialMode] = useState<CredentialMode>("byok");
  const [apiKey, setApiKey] = useState("");
  const [balance, setBalance] = useState<CreditBalance>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<TailoringResult>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api.balance().then(setBalance).catch(() => undefined);
    void api.listCareerRecords().then(setRecords).catch(() => undefined);
  }, [api]);

  const confirmedCount = careerRecord?.facts.filter(fact => fact.status === "confirmed").length ?? 0;
  const reviewCount = careerRecord?.facts.filter(fact => fact.status === "needs_review").length ?? 0;
  const sourceReady = careerRecord ? confirmedCount > 0 : resume.trim().length >= minLength;
  const jobReady = job.trim().length >= minLength;
  const credentialsReady = credentialMode === "subscription" || apiKey.trim().length >= 10;

  async function importResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(undefined);
    try { setResume((await api.importResumeFile(file)).text); setCareerRecord(undefined); }
    catch (reason) { setError(errorMessage(reason, "We could not read that resume.")); }
    finally { setLoading(false); }
  }

  async function importJob(event?: ChangeEvent<HTMLInputElement>) {
    setLoading(true); setError(undefined);
    try {
      const file = event?.target.files?.[0];
      const imported = importMode === "url" ? await api.importUrl(jobUrl) : file ? await api.importFile(file) : await api.importText(job);
      setJob(imported.text);
    } catch (reason) { setError(errorMessage(reason, "We could not import that job description.")); }
    finally { setLoading(false); }
  }

  async function createCareerRecord() {
    setLoading(true); setError(undefined);
    try {
      const created = await api.createCareerRecord({ label: recordLabel, source_text: resume });
      setCareerRecord(created); setRecords(current => [created, ...current]);
    } catch (reason) { setError(errorMessage(reason, "We could not create your Career Record.")); }
    finally { setLoading(false); }
  }

  async function updateFact(fact: CareerFact, changes: Partial<Pick<CareerFact, "text" | "status" | "evidence_note">>) {
    if (!careerRecord) return;
    setLoading(true); setError(undefined);
    try {
      const updated = await api.updateCareerFact(careerRecord.id, fact.id, {
        text: changes.text ?? fact.text, status: changes.status ?? fact.status, evidence_note: changes.evidence_note ?? fact.evidence_note,
      });
      const next = { ...careerRecord, facts: careerRecord.facts.map(item => item.id === fact.id ? updated : item) };
      setCareerRecord(next); setRecords(current => current.map(item => item.id === next.id ? next : item));
    } catch (reason) { setError(errorMessage(reason, "We could not update that fact.")); }
    finally { setLoading(false); }
  }

  async function addFact() {
    if (!careerRecord || newFact.trim().length < 2) return;
    setLoading(true); setError(undefined);
    try {
      const fact = await api.addCareerFact(careerRecord.id, { fact_type: "claim", text: newFact.trim() });
      setCareerRecord({ ...careerRecord, facts: [...careerRecord.facts, fact] }); setNewFact("");
    } catch (reason) { setError(errorMessage(reason, "We could not add that fact.")); }
    finally { setLoading(false); }
  }

  async function tailor() {
    setLoading(true); setError(undefined); setCopied(false);
    const body = { job_description: job, credential_mode: credentialMode, api_key: credentialMode === "byok" ? apiKey : undefined };
    try {
      const tailored = careerRecord ? await api.tailorCareerRecord({ ...body, record_id: careerRecord.id }) : await api.tailor({ ...body, resume_text: resume });
      setResult(tailored); setStep(4);
      if (credentialMode === "subscription") setBalance(await api.balance());
    } catch (reason) { setError(errorMessage(reason, "Tailoring failed. Your credit was not kept if the model failed.")); }
    finally { setLoading(false); }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result.tailored_resume);
    setCopied(true);
  }

  async function downloadResult() {
    if (!result) return;
    setLoading(true); setError(undefined);
    try { saveResume(await api.exportResume(result.tailored_resume)); }
    catch (reason) { setError(errorMessage(reason, "We could not create the DOCX file.")); }
    finally { setLoading(false); }
  }

  const creditPackPrice = import.meta.env.VITE_CREDIT_PACK_PRICE_ID;
  const subscriptionPrice = import.meta.env.VITE_SUBSCRIPTION_PRICE_ID;
  async function checkout(kind: "credits" | "subscription", priceId: string) {
    try { window.location.assign((await api.checkout(kind, priceId)).url); }
    catch (reason) { setError(errorMessage(reason, "We could not start checkout.")); }
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-header"><button className="brand-button" onClick={onHome} type="button" aria-label="Back to Rezzie home"><BrandMark /></button><div className="workspace-header-actions"><span className="privacy-badge"><i /> Private workspace</span>{balance && <span className="credit-badge">{balance.subscription_remaining + balance.purchased_credits} credits</span>}<button className="icon-button" onClick={onHome} type="button">Exit</button></div></header>
      <nav className="stepper" aria-label="Tailoring progress">{stepLabels.map((label, index) => { const number = (index + 1) as Step; const available = number <= step || (number === 2 && sourceReady) || (number === 3 && sourceReady && jobReady) || (number === 4 && Boolean(result)); return <button key={label} className={number === step ? "current" : number < step ? "complete" : ""} disabled={!available} onClick={() => setStep(number)} type="button"><span>{number < step ? "✓" : number}</span><small>{label}</small></button>; })}</nav>

      <main className="workspace-main">
        <section className="workspace-content">
          {step === 1 && <>
            <div className="step-heading"><p className="eyebrow">STEP 1 OF 4</p><h1>Start with what’s true.</h1><p>Add the resume you trust. Rezzie will use it as the boundary for every suggestion.</p></div>
            {records.length > 0 && <div className="source-switcher"><label htmlFor="saved-record">Use a saved Career Record</label><select id="saved-record" value={careerRecord?.id ?? ""} onChange={event => setCareerRecord(records.find(record => record.id === event.target.value))}><option value="">Use a new resume instead</option>{records.map(record => <option key={record.id} value={record.id}>{record.label}</option>)}</select></div>}
            {!careerRecord && <div className="upload-panel"><label className="drop-zone"><input aria-label="Resume file" onChange={importResume} accept={fileTypes} type="file" /><span className="upload-icon">↑</span><strong>Upload your resume</strong><small>PDF, DOCX, Markdown, or text · maximum 5 MB</small></label><div className="divider"><span>or paste it below</span></div><label htmlFor="resume">Current resume <span className="field-count">{resume.length.toLocaleString()} characters</span></label><textarea id="resume" value={resume} onChange={event => { setResume(event.target.value); setCareerRecord(undefined); }} placeholder="Paste the complete resume you want to tailor…" /></div>}
            {!careerRecord && resume.length >= minLength && <details className="career-option"><summary>Save this as a reusable Career Record <span>Recommended</span></summary><p>Rezzie extracts individual claims for you to confirm. Future tailoring can use confirmed facts only.</p><div className="inline-form"><input aria-label="Career Record name" value={recordLabel} onChange={event => setRecordLabel(event.target.value)} /><button className="button button-outline" disabled={loading} onClick={() => void createCareerRecord()} type="button">Create record</button></div></details>}
            {careerRecord && <CareerRecordReview record={careerRecord} reviewCount={reviewCount} confirmedCount={confirmedCount} loading={loading} newFact={newFact} setNewFact={setNewFact} onUpdate={updateFact} onAdd={addFact} />}
            <div className="step-actions"><span>{careerRecord ? `${confirmedCount} confirmed fact${confirmedCount === 1 ? "" : "s"} ready` : sourceReady ? "Resume ready" : "Add at least 50 characters to continue"}</span><button className="button button-primary" disabled={!sourceReady || loading} onClick={() => setStep(2)} type="button">Continue to the job <span>→</span></button></div>
          </>}

          {step === 2 && <>
            <div className="step-heading"><p className="eyebrow">STEP 2 OF 4</p><h1>What are you aiming for?</h1><p>Use the full posting when possible. Responsibilities and requirements give Rezzie the strongest signal.</p></div>
            <div className="segmented-control" aria-label="Job description import method">{(["paste", "url", "file"] as ImportMode[]).map(mode => <button className={importMode === mode ? "active" : ""} onClick={() => setImportMode(mode)} key={mode} type="button">{mode === "paste" ? "Paste text" : mode === "url" ? "Import link" : "Upload file"}</button>)}</div>
            <div className="input-panel">{importMode === "paste" && <><label htmlFor="job-description">Job description <span className="field-count">{job.length.toLocaleString()} characters</span></label><textarea id="job-description" aria-label="Job description text" value={job} onChange={event => setJob(event.target.value)} placeholder="Paste the complete job description…" /></>}{importMode === "url" && <><label htmlFor="job-url">Public job link</label><div className="inline-form"><input id="job-url" type="url" value={jobUrl} onChange={event => setJobUrl(event.target.value)} placeholder="https://company.com/jobs/role" /><button className="button button-outline" disabled={!jobUrl || loading} onClick={() => void importJob()} type="button">Import</button></div>{job && <p className="success-message">✓ Job description imported · {job.length.toLocaleString()} characters</p>}</>}{importMode === "file" && <label className="drop-zone compact"><input aria-label="Job description file" onChange={event => void importJob(event)} accept={fileTypes} type="file" /><span className="upload-icon">↑</span><strong>Upload the job description</strong><small>PDF, DOCX, Markdown, or text</small></label>}</div>
            <div className="step-actions"><button className="back-link" onClick={() => setStep(1)} type="button">← Back</button><button className="button button-primary" disabled={!jobReady || loading} onClick={() => setStep(3)} type="button">Review setup <span>→</span></button></div>
          </>}

          {step === 3 && <>
            <div className="step-heading"><p className="eyebrow">STEP 3 OF 4</p><h1>Ready for a focused rewrite.</h1><p>Choose how to run Claude, check the sources, and start your tailored draft.</p></div>
            <div className="source-summary"><article><span>01</span><div><strong>{careerRecord ? careerRecord.label : "Current resume"}</strong><small>{careerRecord ? `${confirmedCount} confirmed facts` : `${resume.length.toLocaleString()} characters`} · source ready</small></div><button onClick={() => setStep(1)} type="button">Edit</button></article><article><span>02</span><div><strong>Job description</strong><small>{job.length.toLocaleString()} characters · source ready</small></div><button onClick={() => setStep(2)} type="button">Edit</button></article></div>
            <fieldset className="credential-panel"><legend>Choose your Claude access</legend><label className={credentialMode === "byok" ? "choice-card selected" : "choice-card"}><input type="radio" checked={credentialMode === "byok"} onChange={() => setCredentialMode("byok")} /><span><strong>Use my Anthropic key</strong><small>No Rezzie credit needed. Your key is used once and never saved.</small></span></label><label className={credentialMode === "subscription" ? "choice-card selected" : "choice-card"}><input type="radio" checked={credentialMode === "subscription"} onChange={() => setCredentialMode("subscription")} /><span><strong>Use a Rezzie credit</strong><small>{balance ? `${balance.subscription_remaining + balance.purchased_credits} available` : "Sign in and add credits to use the managed service."}</small></span></label>{credentialMode === "byok" && <div className="key-field"><label htmlFor="api-key">Anthropic API key</label><input id="api-key" value={apiKey} onChange={event => setApiKey(event.target.value)} type="password" autoComplete="off" placeholder="sk-ant-…" /><small>Sent directly to the API for this request. It is never stored or returned.</small></div>}</fieldset>
            {(creditPackPrice || subscriptionPrice) && credentialMode === "subscription" && <div className="billing-actions">{creditPackPrice && <button onClick={() => void checkout("credits", creditPackPrice)} type="button">Buy {import.meta.env.VITE_CREDIT_PACK_CREDITS ?? "5"} credits</button>}{subscriptionPrice && <button onClick={() => void checkout("subscription", subscriptionPrice)} type="button">Subscribe monthly</button>}</div>}
            <div className="truth-check"><span>✓</span><p><strong>Truth boundary is on.</strong> Rezzie may reorganize and sharpen supported experience, but cannot add unsupported claims.</p></div>
            <div className="step-actions"><button className="back-link" onClick={() => setStep(2)} type="button">← Back</button><button className="button button-primary button-large" disabled={!credentialsReady || loading} onClick={() => void tailor()} type="button">{loading ? "Tailoring your resume…" : "Tailor my resume"}<span>✦</span></button></div>
          </>}

          {step === 4 && result && <>
            <div className="step-heading result-heading"><div><p className="eyebrow">YOUR TAILORED DRAFT</p><h1>Sharper, grounded, ready to review.</h1></div><span className="complete-badge">✓ Complete</span></div>
            <div className="result-toolbar"><p>Read every line before submitting.</p><div><button className="button button-outline" onClick={() => void copyResult()} type="button">{copied ? "Copied" : "Copy text"}</button><button className="button button-primary" disabled={loading} onClick={() => void downloadResult()} type="button">Download DOCX ↓</button></div></div>
            <ResumePreview text={result.tailored_resume} />
            <div className="result-insights"><section><p className="eyebrow">GROUNDED KEYWORDS</p><div className="keyword-list">{result.matched_keywords.length ? result.matched_keywords.map(keyword => <span key={keyword}>{keyword}</span>) : <p>No keywords returned.</p>}</div></section><section><p className="eyebrow">YOUR REVIEW QUEUE</p>{result.review_items.length ? <ul>{result.review_items.map(item => <li key={item}><span>!</span>{item}</li>)}</ul> : <p className="success-message">✓ No extra review items returned.</p>}</section></div>
            <div className="truth-check"><span>✓</span><p>{result.truth_statement}</p></div>
            <div className="step-actions"><button className="back-link" onClick={() => setStep(3)} type="button">← Adjust setup</button><button className="button button-dark" onClick={() => { setJob(""); setResult(undefined); setStep(2); }} type="button">Tailor for another job <span>→</span></button></div>
          </>}
          {error && <div className="error-banner" role="alert"><span>!</span><p>{error}</p><button onClick={() => setError(undefined)} aria-label="Dismiss error" type="button">×</button></div>}
        </section>
        <aside className="workspace-aside"><p className="aside-label">GOOD TO KNOW</p>{step === 1 && <><h2>Your resume is the ceiling, not the script.</h2><p>Include the experience you may want to use. Rezzie can prioritize and rephrase it, but it will not fill gaps with guesses.</p><ul><li>Use your most complete resume</li><li>Keep dates and metrics intact</li><li>Confirm saved facts carefully</li></ul></>}{step === 2 && <><h2>The full posting works best.</h2><p>Include responsibilities, requirements, and company context. Remove cookie banners or navigation text if you paste from a page.</p><ul><li>Aim for at least 150 words</li><li>Keep preferred qualifications</li><li>One role at a time</li></ul></>}{step === 3 && <><h2>You stay in control.</h2><p>The draft is a starting point, not an automatic submission. Rezzie surfaces review items so uncertainty never hides behind polished prose.</p><div className="aside-stat"><strong>{careerRecord ? confirmedCount : "1"}</strong><span>{careerRecord ? "confirmed facts available" : "resume source attached"}</span></div></>}{step === 4 && <><h2>Do one human pass.</h2><p>Check tone, formatting, dates, and every review item. Then move the text into your preferred resume template or download it.</p><ul><li>Verify every claim</li><li>Keep formatting ATS-simple</li><li>Save the job-specific version</li></ul></>}</aside>
      </main>
    </div>
  );
}

function CareerRecordReview({ record, reviewCount, confirmedCount, loading, newFact, setNewFact, onUpdate, onAdd }: { record: CareerRecord; reviewCount: number; confirmedCount: number; loading: boolean; newFact: string; setNewFact: (value: string) => void; onUpdate: (fact: CareerFact, changes: Partial<Pick<CareerFact, "text" | "status">>) => Promise<void>; onAdd: () => Promise<void> }) {
  return <div className="record-review"><div className="record-review-heading"><div><p className="eyebrow">CAREER RECORD</p><h2>Confirm what Rezzie may use.</h2></div><div><span className="count confirmed">{confirmedCount} confirmed</span><span className="count pending">{reviewCount} to review</span></div></div><p className="record-guidance">Imported lines are suggestions only. Edit any wording, then confirm only what you can personally verify.</p><div className="fact-list">{record.facts.filter(fact => fact.status !== "rejected").map(fact => <div className={`fact-row ${fact.status}`} key={fact.id}><span className="fact-type">{fact.fact_type}</span><textarea aria-label={`Career fact: ${fact.text}`} defaultValue={fact.text} onBlur={event => { if (event.target.value !== fact.text) void onUpdate(fact, { text: event.target.value }); }} /><div className="fact-actions">{fact.status === "confirmed" ? <button className="confirmed-action" onClick={() => void onUpdate(fact, { status: "needs_review" })} type="button">✓ Confirmed</button> : <button onClick={() => void onUpdate(fact, { status: "confirmed" })} disabled={loading} type="button">Confirm</button>}<button onClick={() => void onUpdate(fact, { status: "rejected" })} disabled={loading} type="button">Remove</button></div></div>)}</div><div className="inline-form add-fact"><input aria-label="Add a career fact" value={newFact} onChange={event => setNewFact(event.target.value)} placeholder="Add a fact the import missed…" /><button className="button button-outline" disabled={newFact.trim().length < 2 || loading} onClick={() => void onAdd()} type="button">Add fact</button></div></div>;
}

import { ChangeEvent, ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "./BrandMark";
import { CareerFact, CareerRecord, createApi, CreditBalance, SavedResume, SavedTailoringDraft, TailoringResult } from "./api";

type ImportMode = "paste" | "url" | "file";
type CredentialMode = "byok" | "subscription";
type Step = 1 | 2 | 3 | 4;
const minLength = 50;
const fileTypes = ".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const stepLabels = ["Your experience", "The job", "Tailor", "Review"];
const tailoringStages = [
  { title: "Reading your sources", detail: "Keeping your resume as the factual boundary." },
  { title: "Finding supported themes", detail: "Matching relevant role language to your existing experience." },
  { title: "Preparing your draft", detail: "Writing a focused version for you to review and edit." },
];

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function saveResume(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isResumeHeading(line: string) {
  return ["SUMMARY", "PROFESSIONAL SUMMARY", "PROFILE", "SKILLS", "CORE SKILLS", "TECHNICAL SKILLS", "EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT", "PROJECTS", "EDUCATION", "CERTIFICATIONS", "AWARDS", "VOLUNTEERING"].includes(line.replace(":", "").trim().toUpperCase());
}

function editorHtml(text: string) {
  return text.split("\n").map((rawLine, index) => {
    const line = rawLine.trim();
    const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (!line) return "<div><br></div>";
    if (index === 0) return `<h1>${escaped}</h1>`;
    if (index === 1) return `<p>${escaped}</p>`;
    if (isResumeHeading(line)) return `<h3>${escaped.replace(/:$/, "")}</h3>`;
    if (["- ", "* ", "• "].some(prefix => line.startsWith(prefix))) return `<div>${escaped.slice(2)}</div>`;
    return `<p>${escaped}</p>`;
  }).join("");
}

function RichResumeEditor({ text, onChange }: { text: string; onChange: (html: string, plainText: string) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = editorHtml(text);
  }, [text]);
  function update() {
    if (editor.current) onChange(editor.current.innerHTML, editor.current.innerText);
  }
  function command(name: string, value?: string) {
    editor.current?.focus(); document.execCommand(name, false, value); update();
  }
  function pastePlainText(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); update();
  }
  return <div className="rich-editor-shell"><div className="rich-editor-toolbar" role="toolbar" aria-label="Resume formatting"><button aria-label="Bold" onClick={() => command("bold")} type="button"><b>B</b></button><button aria-label="Italic" onClick={() => command("italic")} type="button"><i>I</i></button><button aria-label="Underline" onClick={() => command("underline")} type="button"><u>U</u></button><button aria-label="Heading" onClick={() => command("formatBlock", "h3")} type="button">Heading</button><button aria-label="Bulleted list" onClick={() => command("insertUnorderedList")} type="button">• List</button><button aria-label="Align left" onClick={() => command("justifyLeft")} type="button">Left</button><button aria-label="Align center" onClick={() => command("justifyCenter")} type="button">Center</button><button aria-label="Undo" onClick={() => command("undo")} type="button">Undo</button><button aria-label="Redo" onClick={() => command("redo")} type="button">Redo</button></div><div className="resume-document rich-editor" aria-label="Tailored resume" contentEditable onInput={update} onPaste={pastePlainText} ref={editor} role="textbox" suppressContentEditableWarning /></div>;
}

function TailoringProgress() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStage(current => Math.min(current + 1, tailoringStages.length - 1)), 2_200);
    return () => window.clearInterval(timer);
  }, []);
  return <section aria-atomic="true" aria-live="polite" className="tailoring-progress" role="status">
    <div className="tailoring-orbit" aria-hidden="true"><span /><span /><i>✦</i></div>
    <p className="eyebrow">REZZIE IS WORKING</p>
    <h2>Tailoring your resume.</h2>
    <p className="tailoring-stage">{tailoringStages[stage].title}</p>
    <p>{tailoringStages[stage].detail}</p>
    <ol aria-label="Tailoring stages">{tailoringStages.map((item, index) => <li className={index < stage ? "complete" : index === stage ? "current" : ""} key={item.title}><span>{index < stage ? "✓" : index + 1}</span>{item.title}</li>)}</ol>
    <small>This usually takes a moment. You will review every change before using it.</small>
  </section>;
}

export function Workspace({ accessToken, onBilling, onHome, onSignOut }: { accessToken?: string; onBilling: (intent?: "credits" | "subscription") => void; onHome: () => void; onSignOut?: () => void }) {
  const api = useMemo(() => createApi(accessToken), [accessToken]);
  const [step, setStep] = useState<Step>(1);
  const [resume, setResume] = useState("");
  const [resumeLabel, setResumeLabel] = useState("My resume");
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedTailoringDraft[]>([]);
  const [selectedSavedResume, setSelectedSavedResume] = useState<string>();
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
  const [isTailoring, setIsTailoring] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<TailoringResult>();
  const [editorState, setEditorState] = useState({ html: "", text: "" });
  const [copied, setCopied] = useState(false);
  const [draftLabel, setDraftLabel] = useState("Tailored resume");
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    void api.balance().then(setBalance).catch(() => undefined);
    void api.listCareerRecords().then(setRecords).catch(() => undefined);
    void api.listSavedResumes().then(setSavedResumes).catch(() => undefined);
    void api.listTailoringDrafts().then(setSavedDrafts).catch(() => undefined);
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
    try { setResume((await api.importResumeFile(file)).text); setCareerRecord(undefined); setSelectedSavedResume(undefined); }
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

  async function saveCurrentResume() {
    setLoading(true); setError(undefined);
    try {
      const saved = await api.saveResume({ label: resumeLabel, source_text: resume });
      setSavedResumes(current => [saved, ...current]);
      setSelectedSavedResume(saved.id);
    } catch (reason) { setError(errorMessage(reason, "We could not save that resume.")); }
    finally { setLoading(false); }
  }

  function selectSavedResume(resumeId: string) {
    setSelectedSavedResume(resumeId || undefined);
    const saved = savedResumes.find(item => item.id === resumeId);
    if (saved) { setResume(saved.source_text); setCareerRecord(undefined); }
  }

  async function deleteSavedResume(resumeId: string) {
    if (!window.confirm("Delete this saved resume? This cannot be undone.")) return;
    setLoading(true); setError(undefined);
    try { await api.deleteSavedResume(resumeId); setSavedResumes(current => current.filter(item => item.id !== resumeId)); if (selectedSavedResume === resumeId) { setSelectedSavedResume(undefined); setResume(""); } }
    catch (reason) { setError(errorMessage(reason, "We could not delete that saved resume.")); }
    finally { setLoading(false); }
  }

  async function deleteSavedDraft(draftId: string) {
    if (!window.confirm("Delete this saved draft? This cannot be undone.")) return;
    setLoading(true); setError(undefined);
    try { await api.deleteTailoringDraft(draftId); setSavedDrafts(current => current.filter(item => item.id !== draftId)); }
    catch (reason) { setError(errorMessage(reason, "We could not delete that saved draft.")); }
    finally { setLoading(false); }
  }

  function reopenDraft(draft: SavedTailoringDraft) {
    setResult({ tailored_resume: draft.tailored_resume, matched_keywords: [], review_items: [], truth_statement: "This is a private draft you previously saved. Review it before using it." });
    setEditorState({ html: draft.resume_html ?? editorHtml(draft.tailored_resume), text: draft.tailored_resume }); setDraftLabel(draft.label); setDraftSaved(true); setStep(4);
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
    setLoading(true); setIsTailoring(true); setError(undefined); setCopied(false);
    const body = { job_description: job, credential_mode: credentialMode, api_key: credentialMode === "byok" ? apiKey : undefined };
    try {
      const tailored = careerRecord ? await api.tailorCareerRecord({ ...body, record_id: careerRecord.id }) : await api.tailor({ ...body, resume_text: resume });
      setResult(tailored); setEditorState({ html: editorHtml(tailored.tailored_resume), text: tailored.tailored_resume }); setDraftSaved(false); setStep(4);
      if (credentialMode === "subscription") setBalance(await api.balance());
    } catch (reason) { setError(errorMessage(reason, "Tailoring failed. Your credit was not kept if the model failed.")); }
    finally { setLoading(false); setIsTailoring(false); }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(editorState.text || result.tailored_resume);
    setCopied(true);
  }

  async function saveDraft() {
    if (!result || draftSaved) return;
    setLoading(true); setError(undefined);
    try {
      await api.saveTailoringDraft({
        label: draftLabel,
        tailored_resume: editorState.text || result.tailored_resume,
        resume_html: editorState.html,
        resume_id: selectedSavedResume,
      });
      setDraftSaved(true);
    } catch (reason) { setError(errorMessage(reason, "We could not save that draft.")); }
    finally { setLoading(false); }
  }

  async function downloadResult(format: "docx" | "pdf") {
    if (!result) return;
    setLoading(true); setError(undefined);
    try { saveResume(await api.exportResume(editorState.text || result.tailored_resume, editorState.html, format), `rezzie-tailored-resume.${format}`); }
    catch (reason) { setError(errorMessage(reason, `We could not create the ${format.toUpperCase()} file.`)); }
    finally { setLoading(false); }
  }

  function downloadText() {
    if (!result) return;
    saveResume(new Blob([editorState.text || result.tailored_resume], { type: "text/plain;charset=utf-8" }), "rezzie-tailored-resume.txt");
  }

  const creditPackPrice = import.meta.env.VITE_CREDIT_PACK_PRICE_ID;
  const subscriptionPrice = import.meta.env.VITE_SUBSCRIPTION_PRICE_ID;
  return (
    <div className="workspace-shell">
      <header className="workspace-header"><button className="brand-button" onClick={onHome} type="button" aria-label="Back to Rezzie home"><BrandMark /></button><div className="workspace-header-actions"><span className="privacy-badge"><i /> Private workspace</span>{balance && <button className="credit-badge" onClick={() => onBilling()} type="button">{balance.subscription_remaining + balance.purchased_credits} credits · Manage</button>}<button className="icon-button" onClick={() => onBilling()} type="button">Billing</button>{onSignOut && <button className="icon-button" onClick={onSignOut} type="button">Sign out</button>}<button className="icon-button" onClick={onHome} type="button">Exit</button></div></header>
      <nav className="stepper" aria-label="Tailoring progress">{stepLabels.map((label, index) => { const number = (index + 1) as Step; const available = number <= step || (number === 2 && sourceReady) || (number === 3 && sourceReady && jobReady) || (number === 4 && Boolean(result)); return <button key={label} className={number === step ? "current" : number < step ? "complete" : ""} disabled={!available} onClick={() => setStep(number)} type="button"><span>{number < step ? "✓" : number}</span><small>{label}</small></button>; })}</nav>

      <main className="workspace-main">
        <section aria-busy={isTailoring} className="workspace-content">
          {step === 1 && <>
            <div className="step-heading"><p className="eyebrow">STEP 1 OF 4</p><h1>Start with what’s true.</h1><p>Add the resume you trust. Rezzie will use it as the boundary for every suggestion.</p></div>
            {savedResumes.length > 0 && <div className="source-switcher"><label htmlFor="saved-resume">Use a saved private resume</label><select id="saved-resume" value={selectedSavedResume ?? ""} onChange={event => selectSavedResume(event.target.value)}><option value="">Use a new resume instead</option>{savedResumes.map(saved => <option key={saved.id} value={saved.id}>{saved.label}</option>)}</select></div>}
            {(savedResumes.length > 0 || savedDrafts.length > 0) && <details className="library-manager"><summary>Manage your private library</summary><p>Only you can see these saved resumes and drafts. Deleting an item removes it from Rezzie.</p>{savedResumes.length > 0 && <section><strong>Saved resumes</strong>{savedResumes.map(saved => <div key={saved.id}><span>{saved.label}</span><button disabled={loading} onClick={() => void deleteSavedResume(saved.id)} type="button">Delete</button></div>)}</section>}{savedDrafts.length > 0 && <section><strong>Saved drafts</strong>{savedDrafts.map(draft => <div key={draft.id}><span>{draft.label}</span><button disabled={loading} onClick={() => reopenDraft(draft)} type="button">Open</button><button disabled={loading} onClick={() => void deleteSavedDraft(draft.id)} type="button">Delete</button></div>)}</section>}</details>}
            {records.length > 0 && <div className="source-switcher"><label htmlFor="saved-record">Or use a saved Career Record</label><select id="saved-record" value={careerRecord?.id ?? ""} onChange={event => { const record = records.find(item => item.id === event.target.value); setCareerRecord(record); if (record) setSelectedSavedResume(undefined); }}><option value="">Use a resume instead</option>{records.map(record => <option key={record.id} value={record.id}>{record.label}</option>)}</select></div>}
            {!careerRecord && <div className="upload-panel"><label className="drop-zone"><input aria-label="Resume file" onChange={importResume} accept={fileTypes} type="file" /><span className="upload-icon">↑</span><strong>Upload your resume</strong><small>PDF, DOCX, Markdown, or text · maximum 5 MB</small></label><div className="divider"><span>or paste it below</span></div><label htmlFor="resume">Current resume <span className="field-count">{resume.length.toLocaleString()} characters</span></label><textarea id="resume" value={resume} onChange={event => { setResume(event.target.value); setCareerRecord(undefined); }} placeholder="Paste the complete resume you want to tailor…" /></div>}
            {!careerRecord && resume.length >= minLength && !selectedSavedResume && <details className="career-option"><summary>Save this private resume for later <span>Optional</span></summary><p>It stays in your Rezzie library so you can select it on another device or in the future Chrome extension. You can delete it anytime.</p><div className="inline-form"><input aria-label="Saved resume name" value={resumeLabel} onChange={event => setResumeLabel(event.target.value)} /><button className="button button-outline" disabled={loading} onClick={() => void saveCurrentResume()} type="button">Save resume</button></div></details>}
            {!careerRecord && resume.length >= minLength && <details className="career-option"><summary>Save this as a reusable Career Record <span>Facts only</span></summary><p>Rezzie extracts individual claims for you to confirm. Future tailoring can use confirmed facts only.</p><div className="inline-form"><input aria-label="Career Record name" value={recordLabel} onChange={event => setRecordLabel(event.target.value)} /><button className="button button-outline" disabled={loading} onClick={() => void createCareerRecord()} type="button">Create record</button></div></details>}
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
            {(creditPackPrice || subscriptionPrice) && credentialMode === "subscription" && <div className="billing-actions">{creditPackPrice && (!balance || balance.subscription_remaining + balance.purchased_credits === 0) && <button onClick={() => onBilling("credits")} type="button">Purchase credits</button>}{subscriptionPrice && balance?.subscription_status !== "active" && <button onClick={() => onBilling("subscription")} type="button">Upgrade to monthly</button>}<button onClick={() => onBilling()} type="button">Manage credits and plans</button></div>}
            <div className="truth-check"><span>✓</span><p><strong>Truth boundary is on.</strong> Rezzie may reorganize and sharpen supported experience, but cannot add unsupported claims.</p></div>
            <div className="step-actions"><button className="back-link" onClick={() => setStep(2)} type="button">← Back</button><button className="button button-primary button-large" disabled={!credentialsReady || loading} onClick={() => void tailor()} type="button">{loading ? "Tailoring your resume…" : "Tailor my resume"}<span>✦</span></button></div>
          </>}

          {isTailoring && <TailoringProgress />}

          {step === 4 && result && <>
            <div className="step-heading result-heading"><div><p className="eyebrow">YOUR TAILORED DRAFT</p><h1>Sharper, grounded, ready to review.</h1></div><span className="complete-badge">✓ Complete</span></div>
            <div className="result-toolbar"><p>Make any final edits, then download.</p><div><button className="button button-outline" onClick={() => void copyResult()} type="button">{copied ? "Copied" : "Copy text"}</button><button className="button button-outline" onClick={downloadText} type="button">TXT ↓</button><button className="button button-outline" disabled={loading} onClick={() => void downloadResult("pdf")} type="button">PDF ↓</button><button className="button button-primary" disabled={loading} onClick={() => void downloadResult("docx")} type="button">DOCX ↓</button></div></div>
            <div className="save-draft-panel"><div><strong>Keep this version for later</strong><small>Saved drafts stay private in your Rezzie library. You can delete them anytime.</small></div><label htmlFor="draft-label">Draft name<input id="draft-label" value={draftLabel} onChange={event => setDraftLabel(event.target.value)} disabled={draftSaved} /></label><button className="button button-outline" disabled={loading || draftSaved || draftLabel.trim().length === 0} onClick={() => void saveDraft()} type="button">{draftSaved ? "Saved" : "Save draft"}</button></div>
            <RichResumeEditor text={result.tailored_resume} onChange={(html, plainText) => setEditorState({ html, text: plainText })} />
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

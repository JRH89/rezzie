import {
  ChangeEvent,
  ClipboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";
import {
  CareerFact,
  CareerRecord,
  createApi,
  CreditBalance,
  ResumeStyleProfile,
  SavedResume,
  SavedTailoringDraft,
  TailoringChange,
  TailoringResult,
  TrustedSource,
} from "./api";
import { resumeEditorHtml } from "./resumeFormatting";

type ImportMode = "paste" | "url" | "file";
type CredentialMode = "byok" | "subscription";
type Step = 1 | 2 | 3 | 4;
type ResumeTemplateId =
  | "source"
  | "professional"
  | "modern"
  | "classic"
  | "compact";
type ResultTab = "draft" | "changes" | "checks";
type WorkspacePreferences = {
  credentialMode?: CredentialMode;
  importMode?: ImportMode;
  resumeTemplate?: ResumeTemplateId;
  selectedSavedResume?: string;
  selectedSavedDraft?: string;
  selectedTrustedSources?: string[];
};
type WorkspaceSession = {
  step?: Step;
  resume?: string;
  uploadedResumeName?: string;
  sourcePageCount?: number;
  sourceStyleProfile?: ResumeStyleProfile;
  sourceEntryLines?: string[];
  job?: string;
  jobUrl?: string;
  result?: TailoringResult;
  editorText?: string;
  editorHtml?: string;
  draftLabel?: string;
  resultTab?: ResultTab;
};

const minLength = 50;
const workspacePreferencesKey = "rezzie.workspace-preferences.v1";
const workspaceSessionKey = "rezzie.workspace-session.v1";
const fileTypes =
  ".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const stepLabels = ["Your experience", "The job", "Tailor", "Review"];
const tailoringStages = [
  {
    title: "Reading your sources",
    detail: "Keeping your resume as the factual boundary.",
  },
  {
    title: "Finding supported themes",
    detail: "Matching relevant role language to your existing experience.",
  },
  {
    title: "Preparing your draft",
    detail: "Writing a focused version for you to review and edit.",
  },
];

function readWorkspacePreferences(): WorkspacePreferences {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(workspacePreferencesKey) ?? "{}",
    );
    return value && typeof value === "object" ? value as WorkspacePreferences : {};
  } catch {
    return {};
  }
}

function saveWorkspacePreferences(preferences: WorkspacePreferences) {
  try {
    window.localStorage.setItem(workspacePreferencesKey, JSON.stringify(preferences));
  } catch {
    // A private browsing policy can disable storage. The workflow still works.
  }
}

function readWorkspaceSession(): WorkspaceSession {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(workspaceSessionKey) ?? "{}",
    );
    return value && typeof value === "object" ? value as WorkspaceSession : {};
  } catch {
    return {};
  }
}

function saveWorkspaceSession(session: WorkspaceSession) {
  try {
    window.sessionStorage.setItem(workspaceSessionKey, JSON.stringify(session));
  } catch {
    // Storage can be unavailable or full. Keep the active workspace functional.
  }
}

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

function openEditableLink(event: React.MouseEvent<HTMLDivElement>) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();
  window.open(link.href, "_blank", "noopener,noreferrer");
}

function normalizeEditorLink(value: string) {
  const trimmed = value.trim();
  if (/^mailto:/i.test(trimmed)) return trimmed;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function EditorToolbar({
  label,
  command,
  insertLink,
  captureSelection,
}: {
  label: string;
  command: (name: string, value?: string) => void;
  insertLink: () => void;
  captureSelection: () => void;
}) {
  const preserveSelection = (event: React.MouseEvent<HTMLElement>) => {
    captureSelection();
    event.preventDefault();
  };
  return (
    <div className="rich-editor-toolbar" role="toolbar" aria-label={label}>
      <div className="toolbar-group" aria-label="Text style">
        <button aria-label="Bold" onClick={() => command("bold")} onMouseDown={preserveSelection} type="button"><b>B</b></button>
        <button aria-label="Italic" onClick={() => command("italic")} onMouseDown={preserveSelection} type="button"><i>I</i></button>
        <button aria-label="Underline" onClick={() => command("underline")} onMouseDown={preserveSelection} type="button"><u>U</u></button>
        <button aria-label="Clear formatting" onClick={() => command("removeFormat")} onMouseDown={preserveSelection} type="button">Clear</button>
      </div>
      <div className="toolbar-group" aria-label="Font settings">
        <select aria-label="Font family" defaultValue="Arial" onChange={(event) => command("fontName", event.target.value)} onMouseDown={captureSelection}>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Calibri">Calibri</option>
        </select>
        <select aria-label="Font size" defaultValue="3" onChange={(event) => command("fontSize", event.target.value)} onMouseDown={captureSelection}>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">Extra large</option>
        </select>
      </div>
      <div className="toolbar-group" aria-label="Paragraph style">
        <button aria-label="Heading" onClick={() => command("formatBlock", "h3")} onMouseDown={preserveSelection} type="button">Heading</button>
        <button aria-label="Paragraph" onClick={() => command("formatBlock", "p")} onMouseDown={preserveSelection} type="button">Paragraph</button>
        <button aria-label="Bulleted list" onClick={() => command("insertUnorderedList")} onMouseDown={preserveSelection} type="button">• List</button>
        <button aria-label="Numbered list" onClick={() => command("insertOrderedList")} onMouseDown={preserveSelection} type="button">1. List</button>
      </div>
      <div className="toolbar-group" aria-label="Alignment and links">
        <button aria-label="Align left" onClick={() => command("justifyLeft")} onMouseDown={preserveSelection} type="button">Left</button>
        <button aria-label="Align center" onClick={() => command("justifyCenter")} onMouseDown={preserveSelection} type="button">Center</button>
        <button aria-label="Align right" onClick={() => command("justifyRight")} onMouseDown={preserveSelection} type="button">Right</button>
        <button aria-label="Insert link" onClick={insertLink} onMouseDown={preserveSelection} type="button">Link</button>
      </div>
      <div className="toolbar-group" aria-label="Edit history">
        <button aria-label="Undo" onClick={() => command("undo")} onMouseDown={preserveSelection} type="button">Undo</button>
        <button aria-label="Redo" onClick={() => command("redo")} onMouseDown={preserveSelection} type="button">Redo</button>
      </div>
    </div>
  );
}

function RichResumeEditor({
  text,
  html,
  sourceText = "",
  sourceHtml,
  styleProfile,
  templateId,
  onChange,
  entryLines = [],
  controls,
}: {
  text: string;
  html?: string;
  sourceText?: string;
  sourceHtml?: string;
  styleProfile?: ResumeStyleProfile;
  templateId: ResumeTemplateId;
  onChange: (html: string, plainText: string) => void;
  entryLines?: string[];
  controls?: ReactNode;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const selectionRange = useRef<Range | null>(null);
  const draftHtml = useRef("");
  const [view, setView] = useState<"draft" | "original" | "compare">(
    "draft",
  );
  const [draftText, setDraftText] = useState(text);
  useEffect(() => {
    draftHtml.current = html || resumeEditorHtml(text, [], styleProfile, entryLines, []);
    setDraftText(text);
  }, [entryLines, html, styleProfile, templateId, text]);
  useEffect(() => {
    if (editor.current && view === "draft") {
      editor.current.innerHTML = draftHtml.current;
      editor.current.dataset.template = templateId;
      editor.current.style.setProperty(
        "--resume-font",
        styleProfile?.font_family ?? "Arial",
      );
      editor.current.style.setProperty(
        "--resume-body-size",
        `${styleProfile?.body_size ?? 10.5}pt`,
      );
      editor.current.style.setProperty(
        "--resume-line-height",
        `${styleProfile?.line_height ?? 13}pt`,
      );
      editor.current.style.setProperty(
        "--resume-name-size",
        `${styleProfile?.name_size ?? 18}pt`,
      );
      editor.current.style.setProperty(
        "--resume-heading-size",
        `${styleProfile?.heading_size ?? 11}pt`,
      );
    }
  }, [styleProfile, templateId, view]);
  function update() {
    if (editor.current) {
      const copy = editor.current.cloneNode(true) as HTMLDivElement;
      draftHtml.current = copy.innerHTML;
      setDraftText(copy.innerText);
      onChange(copy.innerHTML, copy.innerText);
    }
  }
  function captureSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount) selectionRange.current = selection.getRangeAt(0).cloneRange();
  }
  function command(name: string, value?: string) {
    editor.current?.focus();
    if (selectionRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRange.current);
    }
    document.execCommand(name, false, value);
    update();
  }
  function insertLink() {
    const rawUrl = window.prompt("Paste a web address or email link");
    if (!rawUrl) return;
    const href = normalizeEditorLink(rawUrl);
    if (!href) {
      window.alert("Enter a valid https://, http://, or mailto: link.");
      return;
    }
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      command("createLink", href);
      return;
    }
    const label = window.prompt("Text to display for this link");
    if (!label?.trim()) return;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = label.trim();
    command("insertHTML", anchor.outerHTML);
  }
  function pastePlainText(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.clipboardData.getData("text/plain"),
    );
    update();
  }
  return (
    <div className="rich-editor-shell">
      {(sourceText || controls) && (
        <div className="resume-compare-controls">
          {sourceText && (
            <div aria-label="Resume comparison view" role="tablist">
              <button
                aria-selected={view === "draft"}
                className={view === "draft" ? "active" : ""}
                onClick={() => setView("draft")}
                role="tab"
                type="button"
              >
                Tailored draft (edit)
              </button>
              <button
                aria-selected={view === "original"}
                className={view === "original" ? "active" : ""}
                onClick={() => setView("original")}
                role="tab"
                type="button"
              >
                Original
              </button>
              <button
                aria-selected={view === "compare"}
                className={view === "compare" ? "active" : ""}
                onClick={() => setView("compare")}
                role="tab"
                type="button"
              >
                Side by side
              </button>
            </div>
          )}
          {controls && <div className="resume-document-actions">{controls}</div>}
        </div>
      )}
      {view === "original" && sourceText ? (
        <div
          className="resume-document resume-original"
          dangerouslySetInnerHTML={{
            __html: sourceHtml ?? resumeEditorHtml(sourceText, [], styleProfile, entryLines),
          }}
        />
      ) : view === "compare" && sourceText ? (
        <div className="resume-side-by-side">
          <section>
            <p className="eyebrow">ORIGINAL</p>
            <div
              className="resume-document resume-original"
              dangerouslySetInnerHTML={{
                __html: sourceHtml ?? resumeEditorHtml(
                  sourceText,
                  [],
                  styleProfile,
                  entryLines,
                ),
              }}
            />
          </section>
          <section>
            <p className="eyebrow">TAILORED DRAFT</p>
            <div
              className="resume-document"
              dangerouslySetInnerHTML={{
                __html: resumeEditorHtml(
                  draftText,
                  [],
                  styleProfile,
                  entryLines,
                ),
              }}
            />
          </section>
        </div>
      ) : (
        <>
      {sourceText && <p className="resume-editing-notice">Editing the tailored draft. Formatting tools apply here.</p>}
      <EditorToolbar label="Resume formatting" command={command} insertLink={insertLink} captureSelection={captureSelection} />
      <div
        className="resume-document rich-editor"
        aria-label="Tailored resume"
        contentEditable
        onClick={openEditableLink}
        onInput={update}
        onKeyDown={(event) => {
          if (!(event.ctrlKey || event.metaKey)) return;
          const key = event.key.toLowerCase();
          if (key === "z") {
            event.preventDefault();
            command(event.shiftKey ? "redo" : "undo");
          } else if (key === "y") {
            event.preventDefault();
            command("redo");
          } else if (key === "k") {
            event.preventDefault();
            insertLink();
          }
        }}
        onPaste={pastePlainText}
        ref={editor}
        role="textbox"
        suppressContentEditableWarning
      />
        </>
      )}
    </div>
  );
}

function LibraryResumeEditor({
  text,
  onChange,
}: {
  text: string;
  onChange: (html: string, plainText: string) => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const selectionRange = useRef<Range | null>(null);
  useEffect(() => {
    if (editor.current) editor.current.innerHTML = resumeEditorHtml(text);
  }, [text]);
  const sync = () => {
    if (!editor.current) return;
    onChange(editor.current.innerHTML, editor.current.innerText);
  };
  const captureSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount) selectionRange.current = selection.getRangeAt(0).cloneRange();
  };
  const command = (name: string, value?: string) => {
    editor.current?.focus();
    if (selectionRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(selectionRange.current);
    }
    document.execCommand(name, false, value);
    sync();
  };
  const insertLink = () => {
    const rawUrl = window.prompt("Paste a web address or email link");
    if (!rawUrl) return;
    const href = normalizeEditorLink(rawUrl);
    if (!href) {
      window.alert("Enter a valid https://, http://, or mailto: link.");
      return;
    }
    const selectedText = window.getSelection()?.toString().trim();
    if (selectedText) {
      command("createLink", href);
      return;
    }
    const label = window.prompt("Text to display for this link");
    if (!label?.trim()) return;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.textContent = label.trim();
    command("insertHTML", anchor.outerHTML);
  };
  return (
    <div className="rich-editor-shell library-resume-editor">
      <EditorToolbar label="Saved resume formatting" command={command} insertLink={insertLink} captureSelection={captureSelection} />
      <div
        aria-label="Saved resume editor"
        className="resume-document rich-editor"
        contentEditable
        onClick={openEditableLink}
        onBlur={sync}
        onKeyDown={(event) => {
          if (!(event.ctrlKey || event.metaKey)) return;
          const key = event.key.toLowerCase();
          if (key === "z") {
            event.preventDefault();
            command(event.shiftKey ? "redo" : "undo");
          } else if (key === "y") {
            event.preventDefault();
            command("redo");
          } else if (key === "k") {
            event.preventDefault();
            insertLink();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
          sync();
        }}
        ref={editor}
        role="textbox"
        suppressContentEditableWarning
      />
    </div>
  );
}

function TailoringProgress() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setStage((current) =>
          Math.min(current + 1, tailoringStages.length - 1),
        ),
      2_200,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className="tailoring-progress"
      role="status"
    >
      <div className="tailoring-orbit" aria-hidden="true">
        <span />
        <span />
        <i>✦</i>
      </div>
      <p className="eyebrow">REZZIE IS WORKING</p>
      <h2>Tailoring your resume.</h2>
      <p className="tailoring-stage">{tailoringStages[stage].title}</p>
      <p>{tailoringStages[stage].detail}</p>
      <ol aria-label="Tailoring stages">
        {tailoringStages.map((item, index) => (
          <li
            className={
              index < stage ? "complete" : index === stage ? "current" : ""
            }
            key={item.title}
          >
            <span>{index < stage ? "✓" : index + 1}</span>
            {item.title}
          </li>
        ))}
      </ol>
      <small>
        This usually takes a moment. You will review every change before using
        it.
      </small>
    </section>
  );
}

export function Workspace({
  accessToken,
  onBilling,
  onHome,
  onSignOut,
  onSupport,
}: {
  accessToken?: string;
  onBilling: (intent?: "credits" | "subscription") => void;
  onHome: () => void;
  onSignOut?: () => void;
  onSupport: () => void;
}) {
  const api = useMemo(() => createApi(accessToken), [accessToken]);
  const initialPreferences = useMemo(readWorkspacePreferences, []);
  const initialSession = useMemo(readWorkspaceSession, []);
  const restoredSavedSource = useRef(false);
  const [step, setStep] = useState<Step>(
    initialSession.result && initialSession.step === 4 ? 4 : initialSession.step ?? 1,
  );
  const [resume, setResume] = useState(initialSession.resume ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadedResumeName, setUploadedResumeName] = useState<string | undefined>(initialSession.uploadedResumeName);
  const [uploadedResumePreview, setUploadedResumePreview] = useState<string>();
  const [sourcePageCount, setSourcePageCount] = useState<number | undefined>(initialSession.sourcePageCount);
  const [sourceStyleProfile, setSourceStyleProfile] =
    useState<ResumeStyleProfile | undefined>(initialSession.sourceStyleProfile);
  const [sourceEntryLines, setSourceEntryLines] = useState<string[]>(initialSession.sourceEntryLines ?? []);
  const [sourceHtml, setSourceHtml] = useState<string>();
  const [sourceDocx, setSourceDocx] = useState<File>();
  const [resumeLabel, setResumeLabel] = useState("My resume");
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<SavedTailoringDraft[]>([]);
  const [libraryResume, setLibraryResume] = useState<SavedResume>();
  const [libraryResumeText, setLibraryResumeText] = useState("");
  const [selectedSavedResume, setSelectedSavedResume] = useState<string | undefined>(initialPreferences.selectedSavedResume);
  const [selectedSavedDraft, setSelectedSavedDraft] = useState<string | undefined>(initialPreferences.selectedSavedDraft);
  const [recordLabel, setRecordLabel] = useState("My Career Record");
  const [records, setRecords] = useState<CareerRecord[]>([]);
  const [careerRecord, setCareerRecord] = useState<CareerRecord>();
  const [newFact, setNewFact] = useState("");
  const [job, setJob] = useState(initialSession.job ?? "");
  const [jobUrl, setJobUrl] = useState(initialSession.jobUrl ?? "");
  const [importMode, setImportMode] = useState<ImportMode>(initialPreferences.importMode ?? "paste");
  const [credentialMode, setCredentialMode] = useState<CredentialMode>(initialPreferences.credentialMode ?? "byok");
  const [apiKey, setApiKey] = useState("");
  const [balance, setBalance] = useState<CreditBalance>();
  const [trustedSources, setTrustedSources] = useState<TrustedSource[]>([]);
  const [selectedTrustedSources, setSelectedTrustedSources] = useState<
    string[]
  >([]);
  const [trustedSourceUrl, setTrustedSourceUrl] = useState("");
  const [trustedSourceLabel, setTrustedSourceLabel] = useState("");
  const [sourceOwnershipAttested, setSourceOwnershipAttested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<TailoringResult | undefined>(initialSession.result);
  const [editorState, setEditorState] = useState({ html: initialSession.editorHtml ?? "", text: initialSession.editorText ?? initialSession.result?.tailored_resume ?? "" });
  const priorStep = useRef<Step>(step);
  const [resumeTemplate, setResumeTemplate] = useState<ResumeTemplateId>(
    initialPreferences.resumeTemplate ?? "professional",
  );
  const [copied, setCopied] = useState(false);
  const [draftLabel, setDraftLabel] = useState(initialSession.draftLabel ?? "Tailored resume");
  const [draftSaved, setDraftSaved] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>(initialSession.resultTab ?? "draft");

  useEffect(() => {
    void api
      .balance()
      .then(setBalance)
      .catch(() => undefined);
    void api
      .listCareerRecords()
      .then(setRecords)
      .catch(() => undefined);
    void api
      .listSavedResumes()
      .then((resumes) => setSavedResumes(Array.isArray(resumes) ? resumes : []))
      .catch(() => undefined);
    void api
      .listTailoringDrafts()
      .then((drafts) => setSavedDrafts(Array.isArray(drafts) ? drafts : []))
      .catch(() => undefined);
    void api
      .listTrustedSources()
      .then((sources) => {
        if (!Array.isArray(sources)) {
          setTrustedSources([]);
          setSelectedTrustedSources([]);
          return;
        }
        setTrustedSources(sources);
        const savedSelection = initialPreferences.selectedTrustedSources;
        setSelectedTrustedSources(
          savedSelection
            ? savedSelection.filter((id) => sources.some((source) => source.id === id))
            : sources.map((source) => source.id),
        );
      })
      .catch(() => undefined);
  }, [api, initialPreferences.selectedTrustedSources]);

  useEffect(() => {
    saveWorkspacePreferences({
      credentialMode,
      importMode,
      resumeTemplate,
      selectedSavedResume,
      selectedSavedDraft,
      selectedTrustedSources,
    });
  }, [
    credentialMode,
    importMode,
    resumeTemplate,
    selectedSavedResume,
    selectedSavedDraft,
    selectedTrustedSources,
  ]);

  useEffect(() => {
    saveWorkspaceSession({
      step,
      resume,
      uploadedResumeName,
      sourcePageCount,
      sourceStyleProfile,
      sourceEntryLines,
      job,
      jobUrl,
      result: result
        ? {
            ...result,
            tailored_resume: editorState.text || result.tailored_resume,
          }
        : undefined,
      editorText: editorState.text,
      editorHtml: editorState.html,
      draftLabel,
      resultTab,
    });
  }, [
    draftLabel,
    editorState.html,
    editorState.text,
    job,
    jobUrl,
    result,
    resultTab,
    resume,
    sourceEntryLines,
    sourcePageCount,
    sourceStyleProfile,
    step,
    uploadedResumeName,
  ]);

  useEffect(() => {
    if (priorStep.current === step) return;
    priorStep.current = step;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(
        step === 4 ? "tailored-review" : `setup-step-${step}`,
      );
      if (typeof target?.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  useEffect(
    () => () => {
      if (uploadedResumePreview) URL.revokeObjectURL(uploadedResumePreview);
    },
    [uploadedResumePreview],
  );

  useEffect(() => {
    if (restoredSavedSource.current) return;
    if (!Array.isArray(savedDrafts) || !Array.isArray(savedResumes)) return;
    if (selectedSavedDraft) {
      const draft = savedDrafts.find((item) => item.id === selectedSavedDraft);
      if (draft) {
        restoredSavedSource.current = true;
        selectSavedDraft(draft.id);
      }
      return;
    }
    if (selectedSavedResume) {
      const saved = savedResumes.find((item) => item.id === selectedSavedResume);
      if (saved) {
        restoredSavedSource.current = true;
        selectSavedResume(saved.id);
      }
    }
  }, [savedDrafts, savedResumes, selectedSavedDraft, selectedSavedResume]);

  const confirmedCount =
    careerRecord?.facts.filter((fact) => fact.status === "confirmed").length ??
    0;
  const reviewCount =
    careerRecord?.facts.filter((fact) => fact.status === "needs_review")
      .length ?? 0;
  const sourceReady = careerRecord
    ? confirmedCount > 0
    : resume.trim().length >= minLength;
  const jobReady = job.trim().length >= minLength;
  const usesTrustedSources = selectedTrustedSources.length > 0;
  const credentialsReady = usesTrustedSources
    ? credentialMode === "subscription"
    : credentialMode === "subscription" || apiKey.trim().length >= 10;

  async function importResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(undefined);
    try {
      const imported = await api.importResumeFile(file);
      setResume(imported.text);
      setUploadedResumeName(file.name);
      setUploadedResumePreview(
        file.type === "application/pdf" &&
          typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(file)
          : undefined,
      );
      setSourcePageCount(imported.page_count ?? undefined);
      setSourceStyleProfile(imported.style_profile ?? undefined);
      setSourceEntryLines(imported.entry_lines ?? []);
      setSourceHtml(imported.editor_html ?? undefined);
      setSourceDocx(file.name.toLowerCase().endsWith(".docx") ? file : undefined);
      setResumeTemplate(imported.style_profile ? "source" : "professional");
      setCareerRecord(undefined);
      setSelectedSavedResume(undefined);
      setSelectedSavedDraft(undefined);
    } catch (reason) {
      setError(errorMessage(reason, "We could not read that resume."));
    } finally {
      setLoading(false);
    }
  }

  async function importJob(event?: ChangeEvent<HTMLInputElement>) {
    setLoading(true);
    setError(undefined);
    try {
      const file = event?.target.files?.[0];
      const imported =
        importMode === "url"
          ? await api.importUrl(jobUrl)
          : file
            ? await api.importFile(file)
            : await api.importText(job);
      setJob(imported.text);
    } catch (reason) {
      setError(
        errorMessage(reason, "We could not import that job description."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function createCareerRecord() {
    setLoading(true);
    setError(undefined);
    try {
      const created = await api.createCareerRecord({
        label: recordLabel,
        source_text: resume,
      });
      setCareerRecord(created);
      setRecords((current) => [created, ...current]);
    } catch (reason) {
      setError(errorMessage(reason, "We could not create your Career Record."));
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentResume() {
    setLoading(true);
    setError(undefined);
    try {
      const saved = await api.saveResume({
        label: resumeLabel,
        source_text: resume,
      });
      setSavedResumes((current) => [saved, ...current]);
      setSelectedSavedResume(saved.id);
    } catch (reason) {
      setError(errorMessage(reason, "We could not save that resume."));
    } finally {
      setLoading(false);
    }
  }

  async function addTrustedSource() {
    if (!trustedSourceUrl.trim() || !trustedSourceLabel.trim()) return;
    setLoading(true);
    setError(undefined);
    try {
      const source = await api.addTrustedSource({
        url: trustedSourceUrl.trim(),
        label: trustedSourceLabel.trim(),
        ownership_attested: sourceOwnershipAttested,
      });
      setTrustedSources((current) => [source, ...current]);
      setSelectedTrustedSources((current) => [source.id, ...current]);
      setTrustedSourceUrl("");
      setTrustedSourceLabel("");
      setSourceOwnershipAttested(false);
    } catch (reason) {
      setError(errorMessage(reason, "We could not add that Trusted Source."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTrustedSource(sourceId: string) {
    setLoading(true);
    setError(undefined);
    try {
      await api.deleteTrustedSource(sourceId);
      setTrustedSources((current) =>
        current.filter((source) => source.id !== sourceId),
      );
      setSelectedTrustedSources((current) =>
        current.filter((id) => id !== sourceId),
      );
    } catch (reason) {
      setError(
        errorMessage(reason, "We could not remove that Trusted Source."),
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleTrustedSource(sourceId: string) {
    setSelectedTrustedSources((current) =>
      current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId],
    );
  }

  function selectSavedResume(resumeId: string) {
    setSelectedSavedResume(resumeId || undefined);
    setSelectedSavedDraft(undefined);
    const saved = savedResumes.find((item) => item.id === resumeId);
    if (saved) {
      setResume(saved.source_text);
      setUploadedResumeName(`${saved.label} (saved)`);
      setUploadedResumePreview(undefined);
      setSourcePageCount(undefined);
      setSourceStyleProfile(undefined);
      setSourceDocx(undefined);
      setResumeTemplate("professional");
      setCareerRecord(undefined);
    } else {
      setResume("");
      setUploadedResumeName(undefined);
      setUploadedResumePreview(undefined);
      setSourcePageCount(undefined);
      setSourceStyleProfile(undefined);
      setSourceDocx(undefined);
      setResumeTemplate("professional");
    }
  }

  function selectSavedDraft(draftId: string) {
    const draft = savedDrafts.find((item) => item.id === draftId);
    setSelectedSavedDraft(draftId || undefined);
    if (!draft) {
      setSelectedSavedResume(undefined);
      setResume("");
      setUploadedResumeName(undefined);
      setUploadedResumePreview(undefined);
      setSourcePageCount(undefined);
      setSourceStyleProfile(undefined);
      setSourceEntryLines([]);
      setSourceDocx(undefined);
      setResumeTemplate("professional");
      return;
    }
    setSelectedSavedResume(draft.resume_id ?? undefined);
    setResume(draft.tailored_resume);
    setUploadedResumeName(`${draft.label} (saved tailored draft)`);
    setUploadedResumePreview(undefined);
    setSourcePageCount(undefined);
    setSourceStyleProfile(undefined);
    setSourceDocx(undefined);
    setSourceEntryLines([]);
    setResumeTemplate("professional");
    setCareerRecord(undefined);
  }

  function selectSavedSource(value: string) {
    if (value.startsWith("resume:")) {
      selectSavedResume(value.slice("resume:".length));
      return;
    }
    if (value.startsWith("draft:")) {
      selectSavedDraft(value.slice("draft:".length));
      return;
    }
    selectSavedResume("");
  }

  async function deleteSavedResume(resumeId: string) {
    if (!window.confirm("Delete this saved resume? This cannot be undone."))
      return;
    setLoading(true);
    setError(undefined);
    try {
      await api.deleteSavedResume(resumeId);
      setSavedResumes((current) =>
        current.filter((item) => item.id !== resumeId),
      );
      if (selectedSavedResume === resumeId) {
        setSelectedSavedResume(undefined);
        setResume("");
      }
      if (libraryResume?.id === resumeId) {
        setLibraryResume(undefined);
        setLibraryResumeText("");
      }
    } catch (reason) {
      setError(errorMessage(reason, "We could not delete that saved resume."));
    } finally {
      setLoading(false);
    }
  }

  function openLibraryResume(saved: SavedResume) {
    setLibraryResume(saved);
    setLibraryResumeText(saved.source_text);
  }

  async function saveLibraryResume() {
    if (!libraryResume || libraryResumeText.trim().length < minLength) return;
    setLoading(true);
    setError(undefined);
    try {
      const saved = await api.addResumeVersion(libraryResume.id, {
        source_text: libraryResumeText,
      });
      setSavedResumes((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      setLibraryResume(saved);
    } catch (reason) {
      setError(errorMessage(reason, "We could not save those resume edits."));
    } finally {
      setLoading(false);
    }
  }

  function downloadLibraryResume() {
    if (!libraryResume) return;
    saveResume(
      new Blob([libraryResumeText], { type: "text/plain;charset=utf-8" }),
      `${libraryResume.label.replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "") || "rezzie-resume"}.txt`,
    );
  }

  async function deleteSavedDraft(draftId: string) {
    if (!window.confirm("Delete this saved draft? This cannot be undone."))
      return;
    setLoading(true);
    setError(undefined);
    try {
      await api.deleteTailoringDraft(draftId);
      setSavedDrafts((current) =>
        current.filter((item) => item.id !== draftId),
      );
      if (selectedSavedDraft === draftId) selectSavedDraft("");
    } catch (reason) {
      setError(errorMessage(reason, "We could not delete that saved draft."));
    } finally {
      setLoading(false);
    }
  }

  function reopenDraft(draft: SavedTailoringDraft) {
    setResult({
      tailored_resume: draft.tailored_resume,
      matched_keywords: [],
      review_items: [],
      truth_statement:
        "This is a private draft you previously saved. Review it before using it.",
      changes: [],
    });
    setEditorState({
      html: draft.resume_html ?? resumeEditorHtml(draft.tailored_resume),
      text: draft.tailored_resume,
    });
    setDraftLabel(draft.label);
    setDraftSaved(true);
    setResultTab("draft");
    setStep(4);
  }

  async function updateFact(
    fact: CareerFact,
    changes: Partial<Pick<CareerFact, "text" | "status" | "evidence_note">>,
  ) {
    if (!careerRecord) return;
    setLoading(true);
    setError(undefined);
    try {
      const updated = await api.updateCareerFact(careerRecord.id, fact.id, {
        text: changes.text ?? fact.text,
        status: changes.status ?? fact.status,
        evidence_note: changes.evidence_note ?? fact.evidence_note,
      });
      const next = {
        ...careerRecord,
        facts: careerRecord.facts.map((item) =>
          item.id === fact.id ? updated : item,
        ),
      };
      setCareerRecord(next);
      setRecords((current) =>
        current.map((item) => (item.id === next.id ? next : item)),
      );
    } catch (reason) {
      setError(errorMessage(reason, "We could not update that fact."));
    } finally {
      setLoading(false);
    }
  }

  async function addFact() {
    if (!careerRecord || newFact.trim().length < 2) return;
    setLoading(true);
    setError(undefined);
    try {
      const fact = await api.addCareerFact(careerRecord.id, {
        fact_type: "claim",
        text: newFact.trim(),
      });
      setCareerRecord({
        ...careerRecord,
        facts: [...careerRecord.facts, fact],
      });
      setNewFact("");
    } catch (reason) {
      setError(errorMessage(reason, "We could not add that fact."));
    } finally {
      setLoading(false);
    }
  }

  async function tailor() {
    setLoading(true);
    setIsTailoring(true);
    setError(undefined);
    setCopied(false);
    const body = {
      job_description: job,
      credential_mode: credentialMode,
      api_key: credentialMode === "byok" ? apiKey : undefined,
      external_source_ids: selectedTrustedSources,
    };
    try {
      const tailored = careerRecord
        ? await api.tailorCareerRecord({ ...body, record_id: careerRecord.id })
        : await api.tailor({ ...body, resume_text: resume });
      setResult(tailored);
      setEditorState({
        html: resumeEditorHtml(
          tailored.tailored_resume,
          tailored.changes ?? [],
          sourceStyleProfile,
        ),
        text: tailored.tailored_resume,
      });
      setDraftSaved(false);
      setResultTab("draft");
      setStep(4);
      if (credentialMode === "subscription") setBalance(await api.balance());
    } catch (reason) {
      setError(
        errorMessage(
          reason,
          "Tailoring failed. Your credit was not kept if the model failed.",
        ),
      );
    } finally {
      setLoading(false);
      setIsTailoring(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(
      editorState.text || result.tailored_resume,
    );
    setCopied(true);
  }

  async function saveDraft() {
    if (!result || draftSaved) return;
    setLoading(true);
    setError(undefined);
    try {
      await api.saveTailoringDraft({
        label: draftLabel,
        tailored_resume: editorState.text || result.tailored_resume,
        resume_html: editorState.html,
        resume_id: selectedSavedResume,
      });
      setDraftSaved(true);
    } catch (reason) {
      setError(errorMessage(reason, "We could not save that draft."));
    } finally {
      setLoading(false);
    }
  }

  async function downloadResult(format: "docx" | "pdf") {
    if (!result) return;
    setLoading(true);
    setError(undefined);
    try {
      const resumeText = editorState.text || result.tailored_resume;
      const content = format === "docx" && sourceDocx
        ? await api.exportSourceDocx(resumeText, editorState.html, sourceDocx)
        : await api.exportResume(
            resumeText,
            editorState.html,
            format,
            sourcePageCount,
            resumeTemplate,
            sourceStyleProfile,
          );
      saveResume(content, sourceDocx && format === "docx" ? "rezzie-tailored-source.docx" : `rezzie-tailored-resume.${format}`);
    } catch (reason) {
      setError(
        errorMessage(
          reason,
          `We could not create the ${format.toUpperCase()} file.`,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadText() {
    if (!result) return;
    saveResume(
      new Blob([editorState.text || result.tailored_resume], {
        type: "text/plain;charset=utf-8",
      }),
      "rezzie-tailored-resume.txt",
    );
  }

  function undoTailoringChange(change: TailoringChange) {
    const nextText = editorState.text
      .split("\n")
      .filter((line) => line.trim() !== change.text.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const remaining = result?.changes?.filter((item) => item !== change) ?? [];
    setEditorState({
      text: nextText,
      html: resumeEditorHtml(nextText, remaining),
    });
    setResult((current) =>
      current ? { ...current, changes: remaining } : current,
    );
  }

  const creditPackPrice = import.meta.env.VITE_CREDIT_PACK_PRICE_ID;
  const subscriptionPrice = import.meta.env.VITE_SUBSCRIPTION_PRICE_ID;
  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <button
          className="brand-button"
          onClick={onHome}
          type="button"
          aria-label="Back to Rezzie home"
        >
          <BrandMark />
        </button>
        <div className="workspace-header-actions">
          {step === 4 && result && (
            <button className="setup-return-link" onClick={() => setStep(3)} type="button">
              ← Back to setup
            </button>
          )}
          <span className="privacy-badge">
            <i /> Private workspace
          </span>
          {balance ? (
            <button
              className="credit-badge"
              onClick={() => onBilling()}
              type="button"
            >
              {balance.unlimited
                ? "Unlimited access"
                : `${balance.subscription_remaining + balance.purchased_credits} credits · Manage`}
            </button>
          ) : (
            <button
              className="icon-button"
              onClick={() => onBilling()}
              type="button"
            >
              Billing
            </button>
          )}
          <button className="icon-button" onClick={onSupport} type="button">
            Support
          </button>
          {onSignOut && (
            <button className="icon-button" onClick={onSignOut} type="button">
              Sign out
            </button>
          )}
          <button className="icon-button" onClick={onHome} type="button">
            Exit
          </button>
        </div>
        <MobileMenu
          isOpen={menuOpen}
          label="Workspace menu"
          onClose={() => setMenuOpen(false)}
          onToggle={() => setMenuOpen((current) => !current)}
        >
          <span className="mobile-menu-status">
            <i /> Private workspace
          </span>
          {step === 4 && result && (
            <button
              onClick={() => {
                setMenuOpen(false);
                setStep(3);
              }}
              type="button"
            >
              Back to setup
            </button>
          )}
          <button
            onClick={() => {
              setMenuOpen(false);
              onBilling();
            }}
            type="button"
          >
            Billing and credits
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              onSupport();
            }}
            type="button"
          >
            Support
          </button>
          {onSignOut && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onSignOut();
              }}
              type="button"
            >
              Sign out
            </button>
          )}
          <button
            className="mobile-menu-primary"
            onClick={() => {
              setMenuOpen(false);
              onHome();
            }}
            type="button"
          >
            Exit workspace
          </button>
        </MobileMenu>
      </header>
      <nav className="stepper" aria-label="Tailoring progress">
        {stepLabels.map((label, index) => {
          const number = (index + 1) as Step;
          const available =
            number <= step ||
            (number === 2 && sourceReady) ||
            (number === 3 && sourceReady && jobReady) ||
            (number === 4 && Boolean(result));
          return (
            <button
              key={label}
              className={
                number === step ? "current" : number < step ? "complete" : ""
              }
              disabled={!available}
              onClick={() => setStep(number)}
              type="button"
            >
              <span>{number < step ? "✓" : number}</span>
              <small>{label}</small>
            </button>
          );
        })}
      </nav>

      <main
        className={`workspace-main${step === 4 ? " workspace-main-result" : ""}`}
      >
        <section aria-busy={isTailoring} className="workspace-content">
          {step !== 4 && (
            <details
              className="workflow-step"
              id="setup-step-1"
              open={step === 1}
              onToggle={(event) => {
                if (event.currentTarget.open) setStep(1);
              }}
            >
              <summary>
                <span><b>01</b> Your experience</span>
                <small>{sourceReady ? "Resume ready" : "Add your resume"}</small>
              </summary>
              <div className="step-heading">
                <p className="eyebrow">STEP 1 OF 4</p>
                <h1>Start with what’s true.</h1>
                <p>
                  Add the resume you trust. Rezzie will use it as the boundary
                  for every suggestion.
                </p>
              </div>
              {(savedResumes.length > 0 || savedDrafts.length > 0) && (
                <>
                  <div className="source-switcher">
                    <label htmlFor="saved-source">
                      Choose from your Rezzie library
                    </label>
                    <select
                      id="saved-source"
                      value={
                        selectedSavedDraft
                          ? `draft:${selectedSavedDraft}`
                          : selectedSavedResume
                            ? `resume:${selectedSavedResume}`
                            : ""
                      }
                      onChange={(event) =>
                        selectSavedSource(event.target.value)
                      }
                    >
                      <option value="">Use a new resume instead</option>
                      {savedResumes.length > 0 && (
                        <optgroup label="Saved resumes">
                          {savedResumes.map((saved) => (
                            <option key={saved.id} value={`resume:${saved.id}`}>
                              {saved.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {savedDrafts.length > 0 && (
                        <optgroup label="Saved tailored drafts">
                          {savedDrafts.map((draft) => (
                            <option key={draft.id} value={`draft:${draft.id}`}>
                              {draft.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <small>
                      Tailored drafts are reusable sources. Rezzie will still
                      keep every new change grounded in the version you select.
                    </small>
                  </div>
                  <details className="library-manager">
                    <summary>
                      Your private library · {savedResumes.length} resume
                      {savedResumes.length === 1 ? "" : "s"} ·{" "}
                      {savedDrafts.length} tailored draft
                      {savedDrafts.length === 1 ? "" : "s"}
                    </summary>
                    <p>
                      Only you can see these saved resumes and drafts. Deleting
                      an item removes it from Rezzie.
                    </p>
                    {savedResumes.length > 0 && (
                      <section>
                        <strong>Saved resumes</strong>
                        {savedResumes.map((saved) => (
                          <div key={saved.id}>
                            <span>{saved.label}</span>
                            <button
                              disabled={loading}
                              onClick={() => selectSavedResume(saved.id)}
                              type="button"
                            >
                              Use to tailor
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => openLibraryResume(saved)}
                              type="button"
                            >
                              Open & edit
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => void deleteSavedResume(saved.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </section>
                    )}
                    {libraryResume && (
                      <section className="library-editor-panel">
                        <div className="library-editor-heading">
                          <div>
                            <strong>{libraryResume.label}</strong>
                            <small>Edit this saved source, then save a new private version.</small>
                          </div>
                          <button onClick={() => setLibraryResume(undefined)} type="button">Close</button>
                        </div>
                        <LibraryResumeEditor
                          text={libraryResumeText}
                          onChange={(_html, plainText) => setLibraryResumeText(plainText)}
                        />
                        <div className="library-editor-actions">
                          <button className="button button-outline" onClick={downloadLibraryResume} type="button">Download TXT</button>
                          <button className="button button-primary" disabled={loading || libraryResumeText.trim().length < minLength} onClick={() => void saveLibraryResume()} type="button">Save new version</button>
                        </div>
                      </section>
                    )}
                    {savedDrafts.length > 0 && (
                      <section>
                        <strong>Saved tailored drafts</strong>
                        {savedDrafts.map((draft) => (
                          <div key={draft.id}>
                            <span>{draft.label}</span>
                            <button
                              disabled={loading}
                              onClick={() => selectSavedDraft(draft.id)}
                              type="button"
                            >
                              Use to tailor
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => reopenDraft(draft)}
                              type="button"
                            >
                              Open
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => void deleteSavedDraft(draft.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </section>
                    )}
                  </details>
                </>
              )}
              {!careerRecord && (
                <div className="upload-panel">
                  {uploadedResumeName ? (
                    <>
                      <div className="uploaded-source-card">
                        <span
                          className="uploaded-source-icon"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <div>
                          <strong>{uploadedResumeName}</strong>
                          <small>
                            Resume imported · {resume.length.toLocaleString()}{" "}
                            characters ready for tailoring
                          </small>
                        </div>
                        <label className="source-file-replace">
                          <input
                            aria-label="Replace resume file"
                            onChange={importResume}
                            accept={fileTypes}
                            type="file"
                          />
                          Replace
                        </label>
                      </div>
                      <details className="extracted-text-review">
                        <summary>
                          Review extracted text <span>Optional</span>
                        </summary>
                        <p>
                          Only open this if you need to correct what Rezzie read
                          from the file before tailoring.
                        </p>
                        <label htmlFor="resume">
                          Extracted resume text{" "}
                          <span className="field-count">
                            {resume.length.toLocaleString()} characters
                          </span>
                        </label>
                        <textarea
                          id="resume"
                          value={resume}
                          onChange={(event) => {
                            setResume(event.target.value);
                            setCareerRecord(undefined);
                          }}
                        />
                      </details>
                    </>
                  ) : (
                    <>
                      <label className="drop-zone">
                        <input
                          aria-label="Resume file"
                          onChange={importResume}
                          accept={fileTypes}
                          type="file"
                        />
                        <span className="upload-icon">↑</span>
                        <strong>Upload your resume</strong>
                        <small>
                          PDF, DOCX, Markdown, or text · maximum 5 MB
                        </small>
                      </label>
                      <p className="docx-recommendation">
                        <strong>Best formatting match: upload a DOCX.</strong>{" "}
                        PDFs still work for text extraction, but DOCX preserves
                        headings, bullets, links, and styling more accurately.
                      </p>
                      <div className="divider">
                        <span>or paste it below</span>
                      </div>
                      <label htmlFor="resume">
                        Current resume{" "}
                        <span className="field-count">
                          {resume.length.toLocaleString()} characters
                        </span>
                      </label>
                      <textarea
                        id="resume"
                        value={resume}
                        onChange={(event) => {
                          setResume(event.target.value);
                          setCareerRecord(undefined);
                        }}
                        placeholder="Paste the complete resume you want to tailor…"
                      />
                    </>
                  )}
                </div>
              )}
              {uploadedResumeName && sourcePageCount && (
                <p className="source-page-meta">
                  Original source: {sourcePageCount} page
                  {sourcePageCount === 1 ? "" : "s"}
                </p>
              )}
              <details className="optional-source-tools">
                <summary>Optional: save or add more context</summary>
                <div>
                  {records.length > 0 && (
                    <div className="source-switcher">
                      <label htmlFor="saved-record">
                        Use a saved Career Record
                      </label>
                      <select
                        id="saved-record"
                        value={careerRecord?.id ?? ""}
                        onChange={(event) => {
                          const record = records.find(
                            (item) => item.id === event.target.value,
                          );
                          setCareerRecord(record);
                          if (record) {
                            setSelectedSavedResume(undefined);
                            setSelectedSavedDraft(undefined);
                          }
                        }}
                      >
                        <option value="">Keep using this resume</option>
                        {records.map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {resume.length >= minLength && !selectedSavedResume && (
                    <details className="career-option">
                      <summary>
                        Save this private resume for later <span>Optional</span>
                      </summary>
                      <p>
                        It stays in your Rezzie library so you can select it on
                        another device or in the future Chrome extension. You
                        can delete it anytime.
                      </p>
                      <div className="inline-form">
                        <input
                          aria-label="Saved resume name"
                          value={resumeLabel}
                          onChange={(event) =>
                            setResumeLabel(event.target.value)
                          }
                        />
                        <button
                          className="button button-outline"
                          disabled={loading}
                          onClick={() => void saveCurrentResume()}
                          type="button"
                        >
                          Save resume
                        </button>
                      </div>
                    </details>
                  )}
                  {!careerRecord && resume.length >= minLength && (
                    <details className="career-option">
                      <summary>
                        Save this as a reusable Career Record{" "}
                        <span>Facts only</span>
                      </summary>
                      <p>
                        Rezzie extracts individual claims for you to confirm.
                        Future tailoring can use confirmed facts only.
                      </p>
                      <div className="inline-form">
                        <input
                          aria-label="Career Record name"
                          value={recordLabel}
                          onChange={(event) =>
                            setRecordLabel(event.target.value)
                          }
                        />
                        <button
                          className="button button-outline"
                          disabled={loading}
                          onClick={() => void createCareerRecord()}
                          type="button"
                        >
                          Create record
                        </button>
                      </div>
                    </details>
                  )}
                  {!careerRecord && (
                    <details className="trusted-sources-panel">
                      <summary>
                        Use Trusted Sources <span>Subscribers</span>
                      </summary>
                      <p>
                        Add a public GitHub profile, repository, or portfolio
                        you own. Rezzie will visibly label any source-backed
                        resume changes for you to keep or undo.
                      </p>
                      {balance?.subscription_status === "active" ||
                      balance?.subscription_status === "trialing" ? (
                        <>
                          <div className="inline-form">
                            <input
                              aria-label="Trusted Source label"
                              value={trustedSourceLabel}
                              onChange={(event) =>
                                setTrustedSourceLabel(event.target.value)
                              }
                              placeholder="Project portfolio"
                            />
                            <input
                              aria-label="Trusted Source URL"
                              value={trustedSourceUrl}
                              onChange={(event) =>
                                setTrustedSourceUrl(event.target.value)
                              }
                              placeholder="https://github.com/you"
                              type="url"
                            />
                            <button
                              className="button button-outline"
                              disabled={
                                loading ||
                                !trustedSourceUrl ||
                                !trustedSourceLabel ||
                                !sourceOwnershipAttested
                              }
                              onClick={() => void addTrustedSource()}
                              type="button"
                            >
                              Add source
                            </button>
                          </div>
                          <label className="trusted-source-attestation">
                            <input
                              checked={sourceOwnershipAttested}
                              onChange={(event) =>
                                setSourceOwnershipAttested(event.target.checked)
                              }
                              type="checkbox"
                            />
                            I own this public work or am authorized to use it as
                            resume evidence.
                          </label>
                          {trustedSources.length > 0 && (
                            <div className="trusted-source-list">
                              {trustedSources.map((source) => (
                                <label key={source.id}>
                                  <input
                                    checked={selectedTrustedSources.includes(
                                      source.id,
                                    )}
                                    onChange={() =>
                                      toggleTrustedSource(source.id)
                                    }
                                    type="checkbox"
                                  />
                                  <span>
                                    <strong>{source.label}</strong>
                                    <small>
                                      {source.source_type} ·{" "}
                                      {new URL(source.url).hostname}
                                    </small>
                                  </span>
                                  <button
                                    disabled={loading}
                                    onClick={() =>
                                      void deleteTrustedSource(source.id)
                                    }
                                    type="button"
                                  >
                                    Remove
                                  </button>
                                </label>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="trusted-source-upgrade">
                          <strong>Available with Rezzie Monthly</strong>
                          <span>
                            Use public work you own as grounded evidence, then
                            review every new resume line.
                          </span>
                          <button
                            onClick={() => onBilling("subscription")}
                            type="button"
                          >
                            Upgrade to monthly
                          </button>
                        </div>
                      )}
                    </details>
                  )}
                </div>
              </details>
              {careerRecord && (
                <CareerRecordReview
                  record={careerRecord}
                  reviewCount={reviewCount}
                  confirmedCount={confirmedCount}
                  loading={loading}
                  newFact={newFact}
                  setNewFact={setNewFact}
                  onUpdate={updateFact}
                  onAdd={addFact}
                />
              )}
              <div className="step-actions">
                <span>
                  {careerRecord
                    ? `${confirmedCount} confirmed fact${confirmedCount === 1 ? "" : "s"} ready`
                    : sourceReady
                      ? "Resume ready"
                      : "Add at least 50 characters to continue"}
                </span>
                <button
                  className="button button-primary"
                  disabled={!sourceReady || loading}
                  onClick={() => setStep(2)}
                  type="button"
                >
                  Continue to the job <span>→</span>
                </button>
              </div>
            </details>
          )}

          {step !== 4 && sourceReady && (
            <details
              className="workflow-step"
              id="setup-step-2"
              open={step === 2}
              onToggle={(event) => {
                if (event.currentTarget.open) setStep(2);
              }}
            >
              <summary>
                <span><b>02</b> The job</span>
                <small>{jobReady ? "Job description ready" : "Add the role you want"}</small>
              </summary>
              <div className="step-heading">
                <p className="eyebrow">STEP 2 OF 4</p>
                <h1>What are you aiming for?</h1>
                <p>
                  Use the full posting when possible. Responsibilities and
                  requirements give Rezzie the strongest signal.
                </p>
              </div>
              <div
                className="segmented-control"
                aria-label="Job description import method"
              >
                {(["paste", "url", "file"] as ImportMode[]).map((mode) => (
                  <button
                    className={importMode === mode ? "active" : ""}
                    onClick={() => setImportMode(mode)}
                    key={mode}
                    type="button"
                  >
                    {mode === "paste"
                      ? "Paste text"
                      : mode === "url"
                        ? "Import link"
                        : "Upload file"}
                  </button>
                ))}
              </div>
              <div className="input-panel">
                {importMode === "paste" && (
                  <>
                    <label htmlFor="job-description">
                      Job description{" "}
                      <span className="field-count">
                        {job.length.toLocaleString()} characters
                      </span>
                    </label>
                    <textarea
                      id="job-description"
                      aria-label="Job description text"
                      value={job}
                      onChange={(event) => setJob(event.target.value)}
                      placeholder="Paste the complete job description…"
                    />
                  </>
                )}
                {importMode === "url" && (
                  <>
                    <label htmlFor="job-url">Public job link</label>
                    <div className="inline-form">
                      <input
                        id="job-url"
                        type="url"
                        value={jobUrl}
                        onChange={(event) => setJobUrl(event.target.value)}
                        placeholder="https://company.com/jobs/role"
                      />
                      <button
                        className="button button-outline"
                        disabled={!jobUrl || loading}
                        onClick={() => void importJob()}
                        type="button"
                      >
                        Import
                      </button>
                    </div>
                    {job && (
                      <p className="success-message">
                        ✓ Job description imported ·{" "}
                        {job.length.toLocaleString()} characters
                      </p>
                    )}
                  </>
                )}
                {importMode === "file" && (
                  <label className="drop-zone compact">
                    <input
                      aria-label="Job description file"
                      onChange={(event) => void importJob(event)}
                      accept={fileTypes}
                      type="file"
                    />
                    <span className="upload-icon">↑</span>
                    <strong>Upload the job description</strong>
                    <small>PDF, DOCX, Markdown, or text</small>
                  </label>
                )}
              </div>
              <div className="step-actions">
                <button
                  className="back-link"
                  onClick={() => setStep(1)}
                  type="button"
                >
                  ← Back
                </button>
                <button
                  className="button button-primary"
                  disabled={!jobReady || loading}
                  onClick={() => setStep(3)}
                  type="button"
                >
                  Review setup <span>→</span>
                </button>
              </div>
            </details>
          )}

          {step !== 4 && (
            <details
              className="workflow-step"
              id="setup-step-3"
              open={step === 3}
              onToggle={(event) => {
                if (!event.currentTarget.open) return;
                if (sourceReady && jobReady) setStep(3);
                else event.currentTarget.open = false;
              }}
            >
              <summary>
                <span><b>03</b> Tailor</span>
                <small>
                  {sourceReady && jobReady
                    ? "Choose access and review your sources"
                    : "Complete the first two steps to unlock"}
                </small>
              </summary>
              <div className="step-heading">
                <p className="eyebrow">STEP 3 OF 4</p>
                <h1>Ready for a focused rewrite.</h1>
                <p>
                  Choose how to run Claude, check the sources, and start your
                  tailored draft.
                </p>
              </div>
              <div className="source-summary" hidden>
                <article>
                  <span>01</span>
                  <div>
                    <strong>
                      {careerRecord ? careerRecord.label : "Current resume"}
                    </strong>
                    <small>
                      {careerRecord
                        ? `${confirmedCount} confirmed facts`
                        : `${resume.length.toLocaleString()} characters`}{" "}
                      · source ready
                    </small>
                  </div>
                  <button onClick={() => setStep(1)} type="button">
                    Edit
                  </button>
                </article>
                <article>
                  <span>02</span>
                  <div>
                    <strong>Job description</strong>
                    <small>
                      {job.length.toLocaleString()} characters · source ready
                    </small>
                  </div>
                  <button onClick={() => setStep(2)} type="button">
                    Edit
                  </button>
                </article>
              </div>
              <fieldset className="credential-panel">
                <legend>Choose your Claude access</legend>
                <label
                  className={
                    credentialMode === "byok"
                      ? "choice-card selected"
                      : "choice-card"
                  }
                >
                  <input
                    type="radio"
                    checked={credentialMode === "byok"}
                    onChange={() => setCredentialMode("byok")}
                  />
                  <span>
                    <strong>Use my Anthropic key</strong>
                    <small>
                      No Rezzie credit needed. Your key is used once and never
                      saved.
                    </small>
                  </span>
                </label>
                <label
                  className={
                    credentialMode === "subscription"
                      ? "choice-card selected"
                      : "choice-card"
                  }
                >
                  <input
                    type="radio"
                    checked={credentialMode === "subscription"}
                    onChange={() => setCredentialMode("subscription")}
                  />
                  <span>
                    <strong>Use a Rezzie credit</strong>
                    <small>
                      {balance
                        ? `${balance.subscription_remaining + balance.purchased_credits} available`
                        : "Sign in and add credits to use the managed service."}
                    </small>
                  </span>
                </label>
                {credentialMode === "byok" && (
                  <div className="key-field">
                    <label htmlFor="api-key">Anthropic API key</label>
                    <input
                      id="api-key"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      type="password"
                      autoComplete="off"
                      placeholder="sk-ant-…"
                    />
                    <small>
                      Sent directly to the API for this request. It is never
                      stored or returned.
                    </small>
                  </div>
                )}
              </fieldset>
              {(creditPackPrice || subscriptionPrice) &&
                credentialMode === "subscription" && (
                  <div className="billing-actions">
                    {creditPackPrice &&
                      (!balance ||
                        balance.subscription_remaining +
                          balance.purchased_credits ===
                          0) && (
                        <button
                          onClick={() => onBilling("credits")}
                          type="button"
                        >
                          Purchase credits
                        </button>
                      )}
                    {subscriptionPrice &&
                      balance?.subscription_status !== "active" && (
                        <button
                          onClick={() => onBilling("subscription")}
                          type="button"
                        >
                          Upgrade to monthly
                        </button>
                      )}
                    <button onClick={() => onBilling()} type="button">
                      Manage credits and plans
                    </button>
                  </div>
                )}
              <div className="truth-check">
                <span>✓</span>
                <p>
                  <strong>Truth boundary is on.</strong> Rezzie may reorganize
                  and sharpen supported experience, but cannot add unsupported
                  claims.
                </p>
              </div>
              <div className="step-actions">
                <button
                  className="back-link"
                  onClick={() => setStep(2)}
                  type="button"
                >
                  ← Back
                </button>
                <button
                  className="button button-primary button-large"
                  disabled={!credentialsReady || loading}
                  onClick={() => void tailor()}
                  type="button"
                >
                  {loading ? "Tailoring your resume…" : "Tailor my resume"}
                  <span>✦</span>
                </button>
              </div>
            </details>
          )}

          {isTailoring && <TailoringProgress />}

          {step === 4 && result && (
            <section id="tailored-review">
              <div className="step-heading result-heading">
                <div>
                  <p className="eyebrow">YOUR TAILORED DRAFT</p>
                  <h1>Sharper, grounded, ready to review.</h1>
                </div>
                <span className="complete-badge">✓ Complete</span>
              </div>
              <div className="result-toolbar">
                <p>
                  {sourceDocx
                    ? "Your DOCX source will be edited in place for download."
                    : "Make any final edits, then download."}
                </p>
                <div hidden>
                  <button
                    className="button button-outline"
                    onClick={() => void copyResult()}
                    type="button"
                  >
                    {copied ? "Copied" : "Copy text"}
                  </button>
                  <button
                    className="button button-outline"
                    onClick={downloadText}
                    type="button"
                  >
                    TXT ↓
                  </button>
                  <button
                    className="button button-outline"
                    disabled={loading}
                    onClick={() => void downloadResult("pdf")}
                    type="button"
                  >
                    PDF ↓
                  </button>
                  <button
                    className="button button-primary"
                    disabled={loading}
                    onClick={() => void downloadResult("docx")}
                    type="button"
                  >
                    DOCX ↓
                  </button>
                </div>
              </div>
              <div
                className="result-tabs"
                role="tablist"
                aria-label="Tailored resume review"
              >
                <button
                  aria-controls="result-draft"
                  aria-selected={resultTab === "draft"}
                  className={resultTab === "draft" ? "active" : ""}
                  onClick={() => setResultTab("draft")}
                  role="tab"
                  type="button"
                >
                  Draft
                </button>
                <button
                  aria-controls="result-checks"
                  aria-selected={resultTab === "checks"}
                  className={resultTab === "checks" ? "active" : ""}
                  onClick={() => setResultTab("checks")}
                  role="tab"
                  type="button"
                >
                  Checks <span>{result.review_items.length}</span>
                </button>
              </div>
              {resultTab === "draft" && (
                <section id="result-draft" role="tabpanel">
                  <div className="save-draft-panel">
                    <div>
                      <strong>Keep this version for later</strong>
                      <small>
                        Saved drafts stay private in your Rezzie library. You
                        can delete them anytime.
                      </small>
                    </div>
                    <label htmlFor="draft-label">
                      Draft name
                      <input
                        id="draft-label"
                        value={draftLabel}
                        onChange={(event) => setDraftLabel(event.target.value)}
                        disabled={draftSaved}
                      />
                    </label>
                    <button
                      className="button button-outline"
                      disabled={
                        loading || draftSaved || draftLabel.trim().length === 0
                      }
                      onClick={() => void saveDraft()}
                      type="button"
                    >
                      {draftSaved ? "Saved" : "Save draft"}
                    </button>
                  </div>
                  <div className="resume-template-control" hidden>
                    <label htmlFor="resume-template">Document template</label>
                    <select
                      id="resume-template"
                      value={resumeTemplate}
                      onChange={(event) =>
                        setResumeTemplate(
                          event.target.value as ResumeTemplateId,
                        )
                      }
                    >
                      {sourceStyleProfile && (
                        <option value="source">Match uploaded DOCX</option>
                      )}
                      <option value="professional">Professional</option>
                      <option value="modern">Modern</option>
                      <option value="classic">Classic</option>
                      <option value="compact">Compact</option>
                    </select>
                    <small>
                      Your preview and DOCX/PDF downloads use this same
                      template.
                    </small>
                  </div>
                  <RichResumeEditor
                    text={result.tailored_resume}
                    html={editorState.html}
                    sourceText={careerRecord ? "" : resume}
                    sourceHtml={sourceHtml}
                    entryLines={sourceEntryLines}
                    styleProfile={
                      resumeTemplate === "source"
                        ? sourceStyleProfile
                        : undefined
                    }
                    templateId={resumeTemplate}
                    controls={
                      <>
                        <label
                          className="resume-template-select"
                          htmlFor="resume-template-control"
                        >
                          <span>Template</span>
                          <select
                            id="resume-template-control"
                            value={resumeTemplate}
                            onChange={(event) =>
                              setResumeTemplate(
                                event.target.value as ResumeTemplateId,
                              )
                            }
                          >
                            {sourceStyleProfile && (
                              <option value="source">Match uploaded DOCX</option>
                            )}
                            <option value="professional">Professional</option>
                            <option value="modern">Modern</option>
                            <option value="classic">Classic</option>
                            <option value="compact">Compact</option>
                          </select>
                        </label>
                        <div className="resume-download-actions">
                          <button onClick={() => void copyResult()} type="button">
                            {copied ? "Copied" : "Copy"}
                          </button>
                          <button onClick={downloadText} type="button">TXT ↓</button>
                          <button disabled={loading} onClick={() => void downloadResult("pdf")} type="button">PDF ↓</button>
                          <button className="primary" disabled={loading} onClick={() => void downloadResult("docx")} type="button">DOCX ↓</button>
                        </div>
                      </>
                    }
                    onChange={(html, plainText) =>
                      setEditorState({ html, text: plainText })
                    }
                  />
                </section>
              )}
              {resultTab === "changes" && (
                <section
                  className="tailoring-diff"
                  id="result-changes"
                  role="tabpanel"
                >
                  <div>
                    <p className="eyebrow">CHANGE REVIEW</p>
                    <h2>Keep what supports you.</h2>
                    <p>
                      Review the focused edits separately from the full
                      document. Undo removes that exact line from your draft.
                    </p>
                  </div>
                  {result.changes?.length ? (
                    result.changes.map((change, index) => (
                      <article
                        className={change.kind}
                        key={`${change.text}-${index}`}
                      >
                        <div>
                          <span>
                            {change.kind === "source_backed"
                              ? "Source-backed"
                              : "Tailored"}
                          </span>
                          <p>{change.text}</p>
                          {change.source_url && (
                            <a
                              href={change.source_url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              View source ↗
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => undoTailoringChange(change)}
                          type="button"
                        >
                          Undo change
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className="empty-review">
                      No tracked line-level changes were returned for this
                      draft.
                    </p>
                  )}
                </section>
              )}
              {resultTab === "checks" && (
                <section
                  className="result-checks"
                  id="result-checks"
                  role="tabpanel"
                >
                  <div className="result-insights">
                    {result.matched_keywords.length > 0 && (
                      <section className="grounded-keywords">
                        <p className="eyebrow">GROUNDED KEYWORDS</p>
                        <div className="keyword-list">
                          {result.matched_keywords.map((keyword) => (
                            <span key={keyword}>{keyword}</span>
                          ))}
                        </div>
                      </section>
                    )}
                    <section className="review-queue">
                      <div className="review-queue-heading">
                        <div>
                          <p className="eyebrow">YOUR REVIEW QUEUE</p>
                          <h2>Things worth confirming.</h2>
                        </div>
                        {result.review_items.length > 0 && (
                          <span className="review-count">
                            {result.review_items.length} checks
                          </span>
                        )}
                      </div>
                      {result.review_items.length ? (
                        <ol>
                          {result.review_items.map((item, index) => (
                            <li key={item}>
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <p>{item}</p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="success-message">
                          ✓ No extra review items returned.
                        </p>
                      )}
                    </section>
                  </div>
                  <div className="truth-check">
                    <span>✓</span>
                    <p>{result.truth_statement}</p>
                  </div>
                </section>
              )}
              <div className="step-actions">
                <button
                  className="back-link"
                  onClick={() => setStep(3)}
                  type="button"
                >
                  ← Adjust setup
                </button>
                <button
                  className="button button-dark"
                  onClick={() => {
                    setJob("");
                    setResult(undefined);
                    setStep(2);
                  }}
                  type="button"
                >
                  Tailor for another job <span>→</span>
                </button>
              </div>
            </section>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>!</span>
              <p>{error}</p>
              <button
                onClick={() => setError(undefined)}
                aria-label="Dismiss error"
                type="button"
              >
                ×
              </button>
            </div>
          )}
        </section>
        <aside className="workspace-aside">
          <p className="aside-label">GOOD TO KNOW</p>
          {step === 1 && (
            <>
              <h2>Your resume is the ceiling, not the script.</h2>
              <p>
                Include the experience you may want to use. Rezzie can
                prioritize and rephrase it, but it will not fill gaps with
                guesses.
              </p>
              <ul>
                <li>Use your most complete resume</li>
                <li>Keep dates and metrics intact</li>
                <li>Confirm saved facts carefully</li>
              </ul>
            </>
          )}
          {step === 2 && (
            <>
              <h2>The full posting works best.</h2>
              <p>
                Include responsibilities, requirements, and company context.
                Remove cookie banners or navigation text if you paste from a
                page.
              </p>
              <ul>
                <li>Aim for at least 150 words</li>
                <li>Keep preferred qualifications</li>
                <li>One role at a time</li>
              </ul>
            </>
          )}
          {step === 3 && (
            <>
              <h2>You stay in control.</h2>
              <p>
                The draft is a starting point, not an automatic submission.
                Rezzie surfaces review items so uncertainty never hides behind
                polished prose.
              </p>
              <div className="aside-stat">
                <strong>{careerRecord ? confirmedCount : "1"}</strong>
                <span>
                  {careerRecord
                    ? "confirmed facts available"
                    : "resume source attached"}
                </span>
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2>Do one human pass.</h2>
              <p>
                Check tone, formatting, dates, and every review item. Then move
                the text into your preferred resume template or download it.
              </p>
              <ul>
                <li>Verify every claim</li>
                <li>Keep formatting ATS-simple</li>
                <li>Save the job-specific version</li>
              </ul>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

function CareerRecordReview({
  record,
  reviewCount,
  confirmedCount,
  loading,
  newFact,
  setNewFact,
  onUpdate,
  onAdd,
}: {
  record: CareerRecord;
  reviewCount: number;
  confirmedCount: number;
  loading: boolean;
  newFact: string;
  setNewFact: (value: string) => void;
  onUpdate: (
    fact: CareerFact,
    changes: Partial<Pick<CareerFact, "text" | "status">>,
  ) => Promise<void>;
  onAdd: () => Promise<void>;
}) {
  return (
    <div className="record-review">
      <div className="record-review-heading">
        <div>
          <p className="eyebrow">CAREER RECORD</p>
          <h2>Confirm what Rezzie may use.</h2>
        </div>
        <div>
          <span className="count confirmed">{confirmedCount} confirmed</span>
          <span className="count pending">{reviewCount} to review</span>
        </div>
      </div>
      <p className="record-guidance">
        Imported lines are suggestions only. Edit any wording, then confirm only
        what you can personally verify.
      </p>
      <div className="fact-list">
        {record.facts
          .filter((fact) => fact.status !== "rejected")
          .map((fact) => (
            <div className={`fact-row ${fact.status}`} key={fact.id}>
              <span className="fact-type">{fact.fact_type}</span>
              <textarea
                aria-label={`Career fact: ${fact.text}`}
                defaultValue={fact.text}
                onBlur={(event) => {
                  if (event.target.value !== fact.text)
                    void onUpdate(fact, { text: event.target.value });
                }}
              />
              <div className="fact-actions">
                {fact.status === "confirmed" ? (
                  <button
                    className="confirmed-action"
                    onClick={() =>
                      void onUpdate(fact, { status: "needs_review" })
                    }
                    type="button"
                  >
                    ✓ Confirmed
                  </button>
                ) : (
                  <button
                    onClick={() => void onUpdate(fact, { status: "confirmed" })}
                    disabled={loading}
                    type="button"
                  >
                    Confirm
                  </button>
                )}
                <button
                  onClick={() => void onUpdate(fact, { status: "rejected" })}
                  disabled={loading}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
      </div>
      <div className="inline-form add-fact">
        <input
          aria-label="Add a career fact"
          value={newFact}
          onChange={(event) => setNewFact(event.target.value)}
          placeholder="Add a fact the import missed…"
        />
        <button
          className="button button-outline"
          disabled={newFact.trim().length < 2 || loading}
          onClick={() => void onAdd()}
          type="button"
        >
          Add fact
        </button>
      </div>
    </div>
  );
}

export type ResumeStyleProfile = { font_family: "Aptos" | "Arial" | "Calibri" | "Georgia" | "Times New Roman"; body_size: number; line_height: number; name_size: number; heading_size: number; heading_uppercase: boolean; emphasize_role_lines: boolean; italic_metadata: boolean };
export type ImportResponse = { text: string; source_type: string; source_url?: string; page_count?: number | null; style_profile?: ResumeStyleProfile | null };
export type TailoringChange = { text: string; kind: "source_backed" | "tailored"; source_url?: string | null };
export type TailoringResult = { tailored_resume: string; matched_keywords: string[]; review_items: string[]; truth_statement: string; changes: TailoringChange[] };
export type CreditBalance = { subscription_status: string; subscription_remaining: number; purchased_credits: number };
export type CareerFact = { id: string; fact_type: "claim" | "skill"; text: string; source_excerpt: string; status: "needs_review" | "confirmed" | "rejected"; evidence_note?: string | null };
export type CareerRecord = { id: string; label: string; created_at: string; updated_at: string; facts: CareerFact[] };
export type SavedResume = { id: string; version_id: string; label: string; source_text: string; created_at: string; updated_at: string };
export type SavedTailoringDraft = { id: string; resume_id?: string | null; label: string; tailored_resume: string; resume_html?: string | null; created_at: string };
export type TrustedSource = { id: string; label: string; url: string; source_type: "github" | "portfolio"; fetched_at: string };

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${apiBaseUrl}${path}`;

function requestFor(accessToken?: string) {
  return async function request<T>(path: string, options: RequestInit): Promise<T> {
  const headers = new Headers(options.headers);
  if (import.meta.env.DEV) headers.set("X-Rezzie-User-Id", import.meta.env.VITE_DEVELOPMENT_USER_ID ?? "local-user");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(apiUrl(path), { ...options, headers });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? "Request failed."); }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
  };
}
export function createApi(accessToken?: string) {
  const request = requestFor(accessToken);
  async function exportResume(resumeText: string, resumeHtml: string, format: "docx" | "pdf", targetPageCount?: number, templateId = "professional", styleProfile?: ResumeStyleProfile): Promise<Blob> {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (import.meta.env.DEV) headers.set("X-Rezzie-User-Id", import.meta.env.VITE_DEVELOPMENT_USER_ID ?? "local-user");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const path = format === "pdf" ? "/api/v1/resumes/export/pdf" : "/api/v1/resumes/export";
    const response = await fetch(apiUrl(path), { method: "POST", headers, body: JSON.stringify({ resume_text: resumeText, resume_html: resumeHtml, target_page_count: targetPageCount, template_id: templateId, style_profile: styleProfile }) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? `We could not create the ${format.toUpperCase()} file.`); }
    return response.blob();
  }
  return {
    importText: (text: string) => request<ImportResponse>("/api/v1/job-descriptions/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }),
    importUrl: (url: string) => request<ImportResponse>("/api/v1/job-descriptions/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
    importFile: (file: File) => { const form = new FormData(); form.append("file", file); return request<ImportResponse>("/api/v1/job-descriptions/file", { method: "POST", body: form }); },
    importResumeFile: (file: File) => { const form = new FormData(); form.append("file", file); return request<ImportResponse>("/api/v1/resumes/file", { method: "POST", body: form }); },
    saveResume: (body: { label: string; source_text: string }) => request<SavedResume>("/api/v1/resumes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    listSavedResumes: () => request<SavedResume[]>("/api/v1/resumes", { method: "GET" }),
    addResumeVersion: (resumeId: string, body: { source_text: string }) => request<SavedResume>(`/api/v1/resumes/${resumeId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    deleteSavedResume: (resumeId: string) => request<void>(`/api/v1/resumes/${resumeId}`, { method: "DELETE" }),
    addTrustedSource: (body: { url: string; label: string; ownership_attested: boolean }) => request<TrustedSource>("/api/v1/trusted-sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    listTrustedSources: () => request<TrustedSource[]>("/api/v1/trusted-sources", { method: "GET" }),
    deleteTrustedSource: (sourceId: string) => request<void>(`/api/v1/trusted-sources/${sourceId}`, { method: "DELETE" }),
    saveTailoringDraft: (body: { label: string; tailored_resume: string; resume_html?: string; resume_id?: string }) => request<SavedTailoringDraft>("/api/v1/tailoring-drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    listTailoringDrafts: () => request<SavedTailoringDraft[]>("/api/v1/tailoring-drafts", { method: "GET" }),
    deleteTailoringDraft: (draftId: string) => request<void>(`/api/v1/tailoring-drafts/${draftId}`, { method: "DELETE" }),
    exportResume,
    createCareerRecord: (body: { label: string; source_text: string }) => request<CareerRecord>("/api/v1/career-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    listCareerRecords: () => request<CareerRecord[]>("/api/v1/career-records", { method: "GET" }),
    addCareerFact: (recordId: string, body: { fact_type: "claim" | "skill"; text: string; evidence_note?: string }) => request<CareerFact>(`/api/v1/career-records/${recordId}/facts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    updateCareerFact: (recordId: string, factId: string, body: Pick<CareerFact, "text" | "status" | "evidence_note">) => request<CareerFact>(`/api/v1/career-records/${recordId}/facts/${factId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    tailorCareerRecord: (body: { record_id: string; job_description: string; credential_mode: "byok" | "subscription"; api_key?: string }) => request<TailoringResult>("/api/v1/tailor/career-record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    tailor: (body: { resume_text: string; job_description: string; credential_mode: "byok" | "subscription"; api_key?: string; external_source_ids?: string[] }) => request<TailoringResult>("/api/v1/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    balance: () => request<CreditBalance>("/api/v1/billing/me", { method: "GET" }),
    checkout: (kind: "credits" | "subscription", priceId: string, quantity = 1) => request<{ url: string }>("/api/v1/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, price_id: priceId, quantity }) }),
    portal: () => request<{ url: string }>("/api/v1/billing/portal", { method: "POST" }),
  };
}

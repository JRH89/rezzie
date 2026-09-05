export type ImportResponse = { text: string; source_type: string; source_url?: string };
export type TailoringResult = { tailored_resume: string; matched_keywords: string[]; review_items: string[]; truth_statement: string };
export type CreditBalance = { subscription_status: string; subscription_remaining: number; purchased_credits: number };
export type CareerFact = { id: string; fact_type: "claim" | "skill"; text: string; source_excerpt: string; status: "needs_review" | "confirmed" | "rejected"; evidence_note?: string | null };
export type CareerRecord = { id: string; label: string; created_at: string; updated_at: string; facts: CareerFact[] };

function requestFor(accessToken?: string) {
  return async function request<T>(path: string, options: RequestInit): Promise<T> {
  const headers = new Headers(options.headers);
  if (import.meta.env.DEV) headers.set("X-Rezzie-User-Id", import.meta.env.VITE_DEVELOPMENT_USER_ID ?? "local-user");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? "Request failed."); }
  return response.json() as Promise<T>;
  };
}
export function createApi(accessToken?: string) {
  const request = requestFor(accessToken);
  async function exportResume(resumeText: string, resumeHtml: string, format: "docx" | "pdf"): Promise<Blob> {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (import.meta.env.DEV) headers.set("X-Rezzie-User-Id", import.meta.env.VITE_DEVELOPMENT_USER_ID ?? "local-user");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    const path = format === "pdf" ? "/api/v1/resumes/export/pdf" : "/api/v1/resumes/export";
    const response = await fetch(path, { method: "POST", headers, body: JSON.stringify({ resume_text: resumeText, resume_html: resumeHtml }) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? `We could not create the ${format.toUpperCase()} file.`); }
    return response.blob();
  }
  return {
    importText: (text: string) => request<ImportResponse>("/api/v1/job-descriptions/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }),
    importUrl: (url: string) => request<ImportResponse>("/api/v1/job-descriptions/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
    importFile: (file: File) => { const form = new FormData(); form.append("file", file); return request<ImportResponse>("/api/v1/job-descriptions/file", { method: "POST", body: form }); },
    importResumeFile: (file: File) => { const form = new FormData(); form.append("file", file); return request<ImportResponse>("/api/v1/resumes/file", { method: "POST", body: form }); },
    exportResume,
    createCareerRecord: (body: { label: string; source_text: string }) => request<CareerRecord>("/api/v1/career-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    listCareerRecords: () => request<CareerRecord[]>("/api/v1/career-records", { method: "GET" }),
    addCareerFact: (recordId: string, body: { fact_type: "claim" | "skill"; text: string; evidence_note?: string }) => request<CareerFact>(`/api/v1/career-records/${recordId}/facts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    updateCareerFact: (recordId: string, factId: string, body: Pick<CareerFact, "text" | "status" | "evidence_note">) => request<CareerFact>(`/api/v1/career-records/${recordId}/facts/${factId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    tailorCareerRecord: (body: { record_id: string; job_description: string; credential_mode: "byok" | "subscription"; api_key?: string }) => request<TailoringResult>("/api/v1/tailor/career-record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    tailor: (body: { resume_text: string; job_description: string; credential_mode: "byok" | "subscription"; api_key?: string }) => request<TailoringResult>("/api/v1/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    balance: () => request<CreditBalance>("/api/v1/billing/me", { method: "GET" }),
    checkout: (kind: "credits" | "subscription", priceId: string) => request<{ url: string }>("/api/v1/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, price_id: priceId }) }),
    portal: () => request<{ url: string }>("/api/v1/billing/portal", { method: "POST" }),
  };
}

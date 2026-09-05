export type ImportResponse = { text: string; source_type: string; source_url?: string };
export type TailoringResult = { tailored_resume: string; matched_keywords: string[]; review_items: string[]; truth_statement: string };

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? "Request failed."); }
  return response.json() as Promise<T>;
}
export const api = {
  importText: (text: string) => request<ImportResponse>("/api/v1/job-descriptions/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }),
  importUrl: (url: string) => request<ImportResponse>("/api/v1/job-descriptions/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
  importFile: (file: File) => { const form = new FormData(); form.append("file", file); return request<ImportResponse>("/api/v1/job-descriptions/file", { method: "POST", body: form }); },
  tailor: (body: { resume_text: string; job_description: string; credential_mode: "byok"; api_key: string }) => request<TailoringResult>("/api/v1/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
};

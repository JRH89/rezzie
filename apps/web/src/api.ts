export type ImportResponse = { text: string; source_type: string; source_url?: string };
export type TailoringResult = { tailored_resume: string; matched_keywords: string[]; review_items: string[]; truth_statement: string };
export type CreditBalance = { subscription_status: string; subscription_remaining: number; purchased_credits: number };

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
  return {
    importText: (text: string) => request<ImportResponse>("/api/v1/job-descriptions/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }),
    importUrl: (url: string) => request<ImportResponse>("/api/v1/job-descriptions/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
    importFile: (file: File) => { const form = new FormData(); form.append("file", file); return request<ImportResponse>("/api/v1/job-descriptions/file", { method: "POST", body: form }); },
    importResumeFile: (file: File) => { const form = new FormData(); form.append("file", file); return request<ImportResponse>("/api/v1/resumes/file", { method: "POST", body: form }); },
    tailor: (body: { resume_text: string; job_description: string; credential_mode: "byok" | "subscription"; api_key?: string }) => request<TailoringResult>("/api/v1/tailor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    balance: () => request<CreditBalance>("/api/v1/billing/me", { method: "GET" }),
    checkout: (kind: "credits" | "subscription", priceId: string) => request<{ url: string }>("/api/v1/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, price_id: priceId }) }),
    portal: () => request<{ url: string }>("/api/v1/billing/portal", { method: "POST" }),
  };
}

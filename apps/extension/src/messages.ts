export type JobSnapshot = {
  title: string;
  company: string;
  text: string;
  sourceUrl: string;
  confidence: "high" | "medium" | "low";
};

export type ExtensionMessage =
  | { type: "extract-job" }
  | { type: "job-extracted"; snapshot: JobSnapshot; error?: string }
  | { type: "google-auth" }
  | { type: "google-auth-offscreen" }
  | { type: "google-auth-result"; token?: string; error?: string };

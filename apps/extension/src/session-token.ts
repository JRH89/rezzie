const TOKEN_KEY = "rezzie.firebase-id-token";
const EXPIRY_SKEW_SECONDS = 30;

type JwtPayload = { exp?: number };

function payload(token: string): JwtPayload | undefined {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return undefined;
    return JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))) as JwtPayload;
  } catch {
    return undefined;
  }
}

export function hasUsableLifetime(token: string, nowSeconds = Date.now() / 1_000) {
  const expiry = payload(token)?.exp;
  return typeof expiry === "number" && expiry > nowSeconds + EXPIRY_SKEW_SECONDS;
}

export async function readSessionToken() {
  const stored = await chrome.storage.session.get(TOKEN_KEY);
  const token = stored[TOKEN_KEY];
  if (typeof token === "string" && hasUsableLifetime(token)) return token;
  await chrome.storage.session.remove(TOKEN_KEY);
  return undefined;
}

export async function storeSessionToken(token: string) {
  await chrome.storage.session.set({ [TOKEN_KEY]: token });
}

export async function clearSessionToken() {
  await chrome.storage.session.remove(TOKEN_KEY);
}

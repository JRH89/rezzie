import { describe, expect, it } from "vitest";
import { hasUsableLifetime } from "./session-token";

function token(exp: number) {
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

describe("session token lifetime", () => {
  it("accepts a token with enough remaining lifetime", () => {
    expect(hasUsableLifetime(token(1_100), 1_000)).toBe(true);
  });

  it("rejects expired, nearly expired, and malformed tokens", () => {
    expect(hasUsableLifetime(token(1_029), 1_000)).toBe(false);
    expect(hasUsableLifetime("not-a-token", 1_000)).toBe(false);
  });
});

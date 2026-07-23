import { describe, expect, it } from "vitest";
import { addSecurityHeaders, isTrustedMutationOrigin } from "./http";

describe("HTTP security", () => {
  it("accepts only the canonical mutation origin", () => {
    expect(
      isTrustedMutationOrigin(
        new Request("https://learn.example.com/api", { headers: { Origin: "https://learn.example.com" } }),
        "https://learn.example.com"
      )
    ).toBe(true);
    expect(
      isTrustedMutationOrigin(
        new Request("https://learn.example.com/api", { headers: { Origin: "https://evil.example" } }),
        "https://learn.example.com"
      )
    ).toBe(false);
    expect(isTrustedMutationOrigin(new Request("https://learn.example.com/api"), "https://learn.example.com")).toBe(false);
  });

  it("adds browser hardening headers and production HSTS", () => {
    const response = addSecurityHeaders(new Response("ok"), true);
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });
});

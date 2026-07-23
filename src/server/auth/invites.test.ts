import { describe, expect, it } from "vitest";
import { hashInviteCode, isValidUsername, normalizeInviteCode, normalizeInviteEmail } from "./invites";

describe("invite credentials", () => {
  it("normalizes invite input consistently", () => {
    expect(normalizeInviteEmail("  Learner@Example.COM ")).toBe("learner@example.com");
    expect(normalizeInviteCode("  one-time-code  ")).toBe("one-time-code");
  });

  it("hashes invite codes without retaining plaintext", async () => {
    expect(await hashInviteCode("lorne-invite")).toBe("72e03ed2e40aa0afd13937b980540bce9f1098711c410091268e1f16fcc38961");
  });

  it("accepts only the supported username alphabet and length", () => {
    expect(isValidUsername("james.mac-fie_1")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("not an account")).toBe(false);
    expect(isValidUsername("a".repeat(31))).toBe(false);
  });
});

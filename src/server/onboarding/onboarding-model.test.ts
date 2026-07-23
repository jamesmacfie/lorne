import { describe, expect, it } from "vitest";
import { missingOnboardingRequirements, onboardingAdvanceBlocker, type OnboardingFacts } from "./onboarding-model";

const readyFacts: OnboardingFacts = {
  activeTopicCount: 1,
  credentialStatus: "verified",
  hasPreferences: true
};

describe("onboarding readiness", () => {
  it("requires a topic, preferences, and a verified credential", () => {
    expect(
      missingOnboardingRequirements({
        activeTopicCount: 0,
        credentialStatus: "limited",
        hasPreferences: false
      })
    ).toEqual(["topics", "preferences", "credential"]);
    expect(missingOnboardingRequirements(readyFacts)).toEqual([]);
  });

  it("prevents advancing past the first unmet requirement", () => {
    expect(onboardingAdvanceBlocker(1, { ...readyFacts, activeTopicCount: 0 })).toBeNull();
    expect(onboardingAdvanceBlocker(2, { ...readyFacts, activeTopicCount: 0 })).toBe("topics");
    expect(onboardingAdvanceBlocker(3, { ...readyFacts, hasPreferences: false })).toBe("preferences");
    expect(onboardingAdvanceBlocker(4, { ...readyFacts, credentialStatus: "limited" })).toBe("credential");
    expect(onboardingAdvanceBlocker(4, readyFacts)).toBeNull();
  });
});

import type { OnboardingStep } from "#/shared/contracts";

export type OnboardingFacts = {
  activeTopicCount: number;
  credentialStatus: "verified" | "limited" | "invalid" | null;
  hasPreferences: boolean;
};

export type OnboardingRequirement = "topics" | "preferences" | "credential";

export function missingOnboardingRequirements(facts: OnboardingFacts): OnboardingRequirement[] {
  const missing: OnboardingRequirement[] = [];
  if (facts.activeTopicCount < 1) missing.push("topics");
  if (!facts.hasPreferences) missing.push("preferences");
  if (facts.credentialStatus !== "verified") missing.push("credential");
  return missing;
}

export function onboardingAdvanceBlocker(step: OnboardingStep, facts: OnboardingFacts): OnboardingRequirement | null {
  if (step >= 2 && facts.activeTopicCount < 1) return "topics";
  if (step >= 3 && !facts.hasPreferences) return "preferences";
  if (step >= 4 && facts.credentialStatus !== "verified") return "credential";
  return null;
}

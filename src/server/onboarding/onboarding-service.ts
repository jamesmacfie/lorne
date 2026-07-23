import { and, eq, sql } from "drizzle-orm";
import type { OnboardingStep } from "#/shared/contracts";
import { credentialSummary } from "#/server/crypto/credential-service";
import { getDb } from "#/server/db/client";
import { topics, userPreferences } from "#/server/db/schema";
import { missingOnboardingRequirements, onboardingAdvanceBlocker, type OnboardingFacts } from "./onboarding-model";

const requirementLabels = {
  topics: "Add at least one topic.",
  preferences: "Save your study preferences.",
  credential: "Connect a verified OpenAI key."
} as const;

export class OnboardingStateError extends Error {
  constructor(
    public readonly code: "OUT_OF_ORDER" | "INCOMPLETE",
    message: string
  ) {
    super(message);
  }
}

async function readOnboardingData(userId: string) {
  const db = getDb();
  const [preferences, credential, activeTopics] = await Promise.all([
    db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) }),
    credentialSummary(userId),
    db
      .select({
        id: topics.id,
        title: topics.title,
        difficulty: topics.difficulty,
        visualMix: topics.visualMix
      })
      .from(topics)
      .where(and(eq(topics.userId, userId), eq(topics.status, "active")))
      .orderBy(topics.createdAt)
  ]);

  const facts: OnboardingFacts = {
    activeTopicCount: activeTopics.length,
    credentialStatus: credential.status,
    hasPreferences: Boolean(preferences)
  };
  return { activeTopics, credential, facts, preferences };
}

export async function isOnboardingRequired(userId: string): Promise<boolean> {
  const preferences = await getDb().query.userPreferences.findFirst({
    columns: { onboardingCompletedAt: true },
    where: eq(userPreferences.userId, userId)
  });
  return !preferences?.onboardingCompletedAt;
}

export async function getOnboardingState(userId: string) {
  const data = await readOnboardingData(userId);
  return {
    step: Math.min(4, Math.max(0, data.preferences?.onboardingStep ?? 0)),
    completedAt: data.preferences?.onboardingCompletedAt?.toISOString() ?? null,
    preferences: data.preferences
      ? {
          timezone: data.preferences.timezone,
          dailyGoal: data.preferences.dailyGoal,
          textCardPercent: data.preferences.textCardPercent
        }
      : null,
    credential: data.credential,
    topics: data.activeTopics,
    missingRequirements: missingOnboardingRequirements(data.facts)
  };
}

export async function advanceOnboarding(userId: string, targetStep: OnboardingStep) {
  const data = await readOnboardingData(userId);
  const currentStep = data.preferences?.onboardingStep ?? 0;
  if (targetStep > currentStep + 1) {
    throw new OnboardingStateError("OUT_OF_ORDER", "Finish the current setup step before moving ahead.");
  }
  const blocker = onboardingAdvanceBlocker(targetStep, data.facts);
  if (blocker) throw new OnboardingStateError("INCOMPLETE", requirementLabels[blocker]);

  const updatedAt = new Date();
  await getDb()
    .insert(userPreferences)
    .values({ userId, onboardingStep: targetStep, updatedAt })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        onboardingStep: sql`max(${userPreferences.onboardingStep}, ${targetStep})`,
        updatedAt
      }
    })
    .run();
  return getOnboardingState(userId);
}

export async function completeOnboarding(userId: string) {
  const data = await readOnboardingData(userId);
  const missing = missingOnboardingRequirements(data.facts);
  if ((data.preferences?.onboardingStep ?? 0) < 4 || missing.length) {
    const messages = missing.map((requirement) => requirementLabels[requirement]);
    throw new OnboardingStateError("INCOMPLETE", messages[0] ?? "Finish each setup step before opening Lorne.");
  }

  const completedAt = data.preferences?.onboardingCompletedAt ?? new Date();
  await getDb()
    .update(userPreferences)
    .set({ onboardingCompletedAt: completedAt, updatedAt: new Date() })
    .where(eq(userPreferences.userId, userId));
  return { completedAt: completedAt.toISOString() };
}

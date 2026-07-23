import { createServerFn } from "@tanstack/react-start";
import { advanceOnboardingInputSchema, failure, success } from "#/shared/contracts";
import { advanceOnboarding, completeOnboarding, getOnboardingState, OnboardingStateError } from "#/server/onboarding/onboarding-service";
import { serverUser } from "./authenticated";

export const getOnboardingFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await serverUser();
  return getOnboardingState(user.id);
});

export const advanceOnboardingFn = createServerFn({ method: "POST" })
  .validator(advanceOnboardingInputSchema)
  .handler(async ({ data }) => {
    try {
      const user = await serverUser({ mutation: true });
      return success(await advanceOnboarding(user.id, data.step));
    } catch (error) {
      if (error instanceof OnboardingStateError) return failure("INVALID_INPUT", error.message);
      return failure("INTERNAL_ERROR", "Setup progress could not be saved.");
    }
  });

export const completeOnboardingFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const user = await serverUser({ mutation: true });
    return success(await completeOnboarding(user.id));
  } catch (error) {
    if (error instanceof OnboardingStateError) return failure("INVALID_INPUT", error.message);
    return failure("INTERNAL_ERROR", "Setup could not be completed.");
  }
});

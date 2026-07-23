import { z } from "zod";

export const advanceOnboardingInputSchema = z.object({
  step: z.number().int().min(1).max(4)
});

export type OnboardingStep = z.infer<typeof advanceOnboardingInputSchema>["step"];

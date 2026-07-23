import { z } from "zod";

export const saveCredentialInputSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20)
    .max(256)
    .regex(/^sk-[A-Za-z0-9_-]+$/, "Enter a valid OpenAI project key.")
});

export const updatePreferencesInputSchema = z.object({
  timezone: z.string().min(1).max(80),
  dailyGoal: z.number().int().min(1).max(100),
  textCardPercent: z.number().int().min(0).max(100)
});

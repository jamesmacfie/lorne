import { z } from "zod";
import { nonEmptyIdSchema } from "./common";

export const topicDifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export const visualMixSchema = z.enum(["mostly_text", "balanced", "mostly_visual"]);
export const topicStatusSchema = z.enum(["active", "archived"]);

export const topicInputSchema = z.object({
  title: z.string().trim().min(1, "Give this topic a name.").max(120),
  context: z.string().trim().max(2_000).default(""),
  difficulty: topicDifficultySchema,
  visualMix: visualMixSchema.default("balanced"),
  parentTopicId: nonEmptyIdSchema.nullable().default(null)
});

export const bulkTopicInputSchema = z.object({
  topics: z.array(topicInputSchema).min(1).max(30)
});

export const updateTopicInputSchema = topicInputSchema.extend({
  id: nonEmptyIdSchema,
  status: topicStatusSchema.optional()
});

export const topicIdInputSchema = z.object({ id: nonEmptyIdSchema });

export type TopicDifficulty = z.infer<typeof topicDifficultySchema>;
export type VisualMix = z.infer<typeof visualMixSchema>;
export type TopicInput = z.infer<typeof topicInputSchema>;

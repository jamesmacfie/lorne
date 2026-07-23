import { z } from "zod";
import { nonEmptyIdSchema, sortableIdSchema } from "./common";

export const reviewRatingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const reviewEventInputSchema = z.object({
  id: sortableIdSchema,
  cardId: nonEmptyIdSchema,
  rating: reviewRatingSchema,
  reviewedAt: z.string().datetime({ offset: true }),
  deviceId: z.string().min(8).max(80),
  elapsedSeconds: z.number().int().min(0).max(3_600).default(0)
});

export const reviewSyncInputSchema = z.object({
  events: z.array(reviewEventInputSchema).max(100)
});

export const studyQueueInputSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  topicIds: z.array(nonEmptyIdSchema).max(50).optional()
});

export type ReviewRating = z.infer<typeof reviewRatingSchema>;
export type ReviewEventInput = z.infer<typeof reviewEventInputSchema>;

export type StudyCard = {
  id: string;
  topicId: string;
  topicTitle: string;
  kind: "text" | "image";
  front: string;
  back: string;
  hint: string;
  explanation: string;
  assetId: string | null;
  version: number;
  dueAt: string | null;
  state: number | null;
};

export type ScheduleProjection = {
  cardId: string;
  dueAt: string;
  state: number;
  reps: number;
  lapses: number;
};

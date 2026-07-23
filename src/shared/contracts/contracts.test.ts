import { describe, expect, it } from "vitest";
import { generatedCardBatchSchema, reviewSyncInputSchema, topicInputSchema } from "./index";

describe("public boundary contracts", () => {
  it("caps review sync batches at 100", () => {
    const event = {
      id: "review_0000000001_abcdefghijklmnop",
      cardId: "card_1",
      rating: 3,
      reviewedAt: "2026-07-23T00:00:00.000Z",
      deviceId: "device_123",
      elapsedSeconds: 4
    };
    expect(
      reviewSyncInputSchema.safeParse({
        events: Array.from({ length: 100 }, (_, index) => ({ ...event, id: `review_0000000001_abcdefghijklmnop${index}` }))
      }).success
    ).toBe(true);
    expect(
      reviewSyncInputSchema.safeParse({
        events: Array.from({ length: 101 }, (_, index) => ({ ...event, id: `review_0000000001_abcdefghijklmnop${index}` }))
      }).success
    ).toBe(false);
  });

  it("enforces topic and generated-batch limits", () => {
    expect(
      topicInputSchema.safeParse({
        title: "x".repeat(121),
        context: "",
        difficulty: "beginner",
        visualMix: "balanced",
        parentTopicId: null
      }).success
    ).toBe(false);
    expect(generatedCardBatchSchema.safeParse({ cards: [] }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { replayReviews } from "./scheduling";

describe("FSRS event replay", () => {
  it("is deterministic regardless of input arrival order", () => {
    const events = [
      { id: "event_b", rating: 3 as const, reviewedAt: new Date("2026-07-20T10:00:00.000Z") },
      { id: "event_a", rating: 1 as const, reviewedAt: new Date("2026-07-19T10:00:00.000Z") },
      { id: "event_c", rating: 4 as const, reviewedAt: new Date("2026-07-21T11:00:00.000Z") }
    ];
    const forward = replayReviews("card_1", events);
    const reverse = replayReviews("card_1", [...events].reverse());
    expect(forward.projection).toEqual(reverse.projection);
    expect(forward.projection.reps).toBe(3);
  });

  it("uses the event id as a deterministic tie breaker", () => {
    const at = new Date("2026-07-20T10:00:00.000Z");
    const result = replayReviews("card_2", [
      { id: "review_z", rating: 4, reviewedAt: at },
      { id: "review_a", rating: 1, reviewedAt: at }
    ]);
    const ordered = replayReviews("card_2", [
      { id: "review_a", rating: 1, reviewedAt: at },
      { id: "review_z", rating: 4, reviewedAt: at }
    ]);
    expect(result.projection).toEqual(ordered.projection);
  });
});

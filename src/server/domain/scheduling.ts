import { createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";
import type { ReviewRating, ScheduleProjection } from "#/shared/contracts";

export type OrderedReview = { id: string; rating: ReviewRating; reviewedAt: Date };

const scheduler = fsrs({ enable_fuzz: false });

export function replayReviews(cardId: string, events: OrderedReview[]): { card: Card; projection: ScheduleProjection } {
  const ordered = [...events].sort((left, right) => {
    const timeDifference = left.reviewedAt.getTime() - right.reviewedAt.getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
  let card = createEmptyCard(ordered[0]?.reviewedAt ?? new Date());
  for (const event of ordered) {
    card = scheduler.next(card, event.reviewedAt, event.rating as Grade).card;
  }
  return {
    card,
    projection: {
      cardId,
      dueAt: card.due.toISOString(),
      state: card.state,
      reps: card.reps,
      lapses: card.lapses
    }
  };
}

export function optimisticReview(card: Card, rating: ReviewRating, reviewedAt = new Date()): Card {
  return scheduler.next(card, reviewedAt, rating as Grade).card;
}

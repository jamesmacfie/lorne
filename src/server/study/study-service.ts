import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { cardSchedules, cards, dailyProgress, reviewEvents, topics, userPreferences } from "#/server/db/schema";
import type { ReviewEventInput, ScheduleProjection, StudyCard } from "#/shared/contracts";
import { replayReviews } from "#/server/domain/scheduling";

function interleaveByTopic<T extends { topicId: string }>(items: T[], limit: number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.topicId, [...(groups.get(item.topicId) ?? []), item]);
  const output: T[] = [];
  while (output.length < limit && groups.size > 0) {
    for (const [topicId, group] of groups) {
      const item = group.shift();
      if (item) output.push(item);
      if (group.length === 0) groups.delete(topicId);
      if (output.length === limit) break;
    }
  }
  return output;
}

export async function getStudyQueue(userId: string, limit: number, topicIds?: string[]): Promise<StudyCard[]> {
  const db = getDb();
  const now = new Date();
  const ownerFilters = [eq(cards.userId, userId), eq(cards.status, "published"), eq(topics.status, "active")];
  if (topicIds?.length) ownerFilters.push(inArray(cards.topicId, topicIds));
  const rows = await db
    .select({
      id: cards.id,
      topicId: cards.topicId,
      topicTitle: topics.title,
      kind: cards.kind,
      front: cards.front,
      back: cards.back,
      hint: cards.hint,
      explanation: cards.explanation,
      assetId: cards.assetId,
      dueAt: cardSchedules.dueAt,
      state: cardSchedules.state
    })
    .from(cards)
    .innerJoin(topics, eq(cards.topicId, topics.id))
    .leftJoin(cardSchedules, and(eq(cardSchedules.cardId, cards.id), eq(cardSchedules.userId, userId)))
    .where(and(...ownerFilters, or(isNull(cardSchedules.cardId), lte(cardSchedules.dueAt, now))))
    .orderBy(sql`case when ${cardSchedules.cardId} is null then 1 else 0 end`, asc(cardSchedules.dueAt), sql`random()`)
    .limit(Math.min(limit * 5, 100));

  return interleaveByTopic(
    rows.map((row) => ({
      ...row,
      dueAt: row.dueAt?.toISOString() ?? null
    })),
    limit
  );
}

function localDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function syncReviewEvents(userId: string, inputs: ReviewEventInput[]) {
  if (inputs.length === 0) return { accepted: [], duplicates: [], rejected: [], schedules: [] as ScheduleProjection[] };
  const db = getDb();
  const uniqueCardIds = [...new Set(inputs.map((event) => event.cardId))];
  const ownedCards = await db
    .select({ id: cards.id })
    .from(cards)
    .where(and(eq(cards.userId, userId), inArray(cards.id, uniqueCardIds)));
  const ownedCardIds = new Set(ownedCards.map((card) => card.id));
  const existingEvents = await db
    .select({ id: reviewEvents.id })
    .from(reviewEvents)
    .where(
      and(
        eq(reviewEvents.userId, userId),
        inArray(
          reviewEvents.id,
          inputs.map((event) => event.id)
        )
      )
    );
  const duplicateIds = new Set(existingEvents.map((event) => event.id));
  const rejected = inputs.filter((event) => !ownedCardIds.has(event.cardId)).map((event) => event.id);
  const duplicates = inputs.filter((event) => duplicateIds.has(event.id)).map((event) => event.id);
  const acceptedInputs = inputs.filter((event) => ownedCardIds.has(event.cardId) && !duplicateIds.has(event.id));
  const now = new Date();

  const inserted = acceptedInputs.length
    ? await db
        .insert(reviewEvents)
        .values(
          acceptedInputs.map((event) => ({
            id: event.id,
            userId,
            cardId: event.cardId,
            rating: event.rating,
            reviewedAt: new Date(event.reviewedAt),
            deviceId: event.deviceId,
            syncedAt: now
          }))
        )
        .onConflictDoNothing()
        .returning({ id: reviewEvents.id })
    : [];
  const insertedIds = new Set(inserted.map((event) => event.id));
  const committedInputs = acceptedInputs.filter((event) => insertedIds.has(event.id));
  const racedDuplicates = acceptedInputs.filter((event) => !insertedIds.has(event.id)).map((event) => event.id);

  const affectedCards = [...new Set(committedInputs.map((event) => event.cardId))];
  const schedules: ScheduleProjection[] = [];
  for (const cardId of affectedCards) {
    const history = await db
      .select({ id: reviewEvents.id, rating: reviewEvents.rating, reviewedAt: reviewEvents.reviewedAt })
      .from(reviewEvents)
      .where(and(eq(reviewEvents.userId, userId), eq(reviewEvents.cardId, cardId)))
      .orderBy(reviewEvents.reviewedAt, reviewEvents.id);
    const replayed = replayReviews(
      cardId,
      history.map((event) => ({
        id: event.id,
        rating: event.rating as 1 | 2 | 3 | 4,
        reviewedAt: event.reviewedAt
      }))
    );
    schedules.push(replayed.projection);
    const schedule = replayed.card;
    await db
      .insert(cardSchedules)
      .values({
        userId,
        cardId,
        state: schedule.state,
        step: schedule.learning_steps,
        stability: schedule.stability,
        difficulty: schedule.difficulty,
        dueAt: schedule.due,
        lastReviewAt: schedule.last_review,
        scheduledDays: schedule.scheduled_days,
        elapsedDays: schedule.elapsed_days,
        reps: schedule.reps,
        lapses: schedule.lapses,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [cardSchedules.userId, cardSchedules.cardId],
        set: {
          state: schedule.state,
          step: schedule.learning_steps,
          stability: schedule.stability,
          difficulty: schedule.difficulty,
          dueAt: schedule.due,
          lastReviewAt: schedule.last_review,
          scheduledDays: schedule.scheduled_days,
          elapsedDays: schedule.elapsed_days,
          reps: schedule.reps,
          lapses: schedule.lapses,
          updatedAt: now
        }
      });
  }

  const preferences = await db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) });
  const timezone = preferences?.timezone ?? "UTC";
  const grouped = new Map<string, { reviews: number; correct: number; seconds: number }>();
  for (const event of committedInputs) {
    const date = localDate(new Date(event.reviewedAt), timezone);
    const value = grouped.get(date) ?? { reviews: 0, correct: 0, seconds: 0 };
    value.reviews += 1;
    value.correct += event.rating >= 3 ? 1 : 0;
    value.seconds += event.elapsedSeconds;
    grouped.set(date, value);
  }
  for (const [date, value] of grouped) {
    await db
      .insert(dailyProgress)
      .values({
        userId,
        localDate: date,
        reviewCount: value.reviews,
        correctCount: value.correct,
        elapsedSeconds: value.seconds,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [dailyProgress.userId, dailyProgress.localDate],
        set: {
          reviewCount: sql`${dailyProgress.reviewCount} + ${value.reviews}`,
          correctCount: sql`${dailyProgress.correctCount} + ${value.correct}`,
          elapsedSeconds: sql`${dailyProgress.elapsedSeconds} + ${value.seconds}`,
          updatedAt: now
        }
      });
  }

  return { accepted: committedInputs.map((event) => event.id), duplicates: [...duplicates, ...racedDuplicates], rejected, schedules };
}

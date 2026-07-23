import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { AppDatabase } from "#/server/db/client";
import { cardSchedules, cards } from "#/server/db/schema";

export function buildCardCountsQuery(db: AppDatabase, userId: string, now: Date, tomorrowEnd: Date) {
  return db
    .select({
      newCount: sql<number>`sum(case when ${cardSchedules.cardId} is null then 1 else 0 end)`,
      learningCount: sql<number>`sum(case when ${cardSchedules.state} in (1, 3) then 1 else 0 end)`,
      matureCount: sql<number>`sum(case when ${cardSchedules.state} = 2 and ${cardSchedules.stability} >= 21 then 1 else 0 end)`,
      dueTomorrow: sql<number>`sum(case when ${and(gt(cardSchedules.dueAt, now), lte(cardSchedules.dueAt, tomorrowEnd))} then 1 else 0 end)`
    })
    .from(cards)
    .leftJoin(cardSchedules, and(eq(cardSchedules.cardId, cards.id), eq(cardSchedules.userId, userId)))
    .where(and(eq(cards.userId, userId), eq(cards.status, "published")));
}

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { cards, dailyProgress, reviewEvents, topics, userPreferences } from "#/server/db/schema";
import { buildCardCountsQuery } from "./progress-query";

function formatLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function getProgress(userId: string) {
  const db = getDb();
  const now = new Date();
  const prefs = await db.query.userPreferences.findFirst({ where: eq(userPreferences.userId, userId) });
  const timezone = prefs?.timezone ?? "UTC";
  const today = formatLocalDate(now, timezone);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const tomorrowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1_000);

  const [todayRow] = await db
    .select()
    .from(dailyProgress)
    .where(and(eq(dailyProgress.userId, userId), eq(dailyProgress.localDate, today)))
    .limit(1);
  const recentDays = await db
    .select()
    .from(dailyProgress)
    .where(and(eq(dailyProgress.userId, userId), gte(dailyProgress.localDate, formatLocalDate(thirtyDaysAgo, timezone))))
    .orderBy(sql`${dailyProgress.localDate} desc`);
  let streak = 0;
  let cursor = new Date(now);
  const activeDates = new Set(recentDays.filter((day) => day.reviewCount > 0).map((day) => day.localDate));
  for (let offset = 0; offset < 31; offset += 1) {
    const date = formatLocalDate(cursor, timezone);
    if (!activeDates.has(date)) {
      if (offset === 0) {
        cursor = new Date(cursor.getTime() - 86_400_000);
        continue;
      }
      break;
    }
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  const [retention] = await db
    .select({
      total: sql<number>`count(*)`,
      correct: sql<number>`sum(case when ${reviewEvents.rating} >= 3 then 1 else 0 end)`
    })
    .from(reviewEvents)
    .where(and(eq(reviewEvents.userId, userId), gte(reviewEvents.reviewedAt, thirtyDaysAgo)));

  const [counts] = await buildCardCountsQuery(db, userId, now, tomorrowEnd);

  const byTopic = await db
    .select({
      topicId: topics.id,
      topicTitle: topics.title,
      reviews: sql<number>`count(${reviewEvents.id})`,
      correct: sql<number>`sum(case when ${reviewEvents.rating} >= 3 then 1 else 0 end)`
    })
    .from(topics)
    .leftJoin(cards, eq(cards.topicId, topics.id))
    .leftJoin(
      reviewEvents,
      and(eq(reviewEvents.cardId, cards.id), eq(reviewEvents.userId, userId), gte(reviewEvents.reviewedAt, thirtyDaysAgo))
    )
    .where(eq(topics.userId, userId))
    .groupBy(topics.id, topics.title);

  const total = Number(retention?.total ?? 0);
  return {
    streak,
    reviewsToday: todayRow?.reviewCount ?? 0,
    studySecondsToday: todayRow?.elapsedSeconds ?? 0,
    retentionEstimate: total ? Math.round((Number(retention?.correct ?? 0) / total) * 100) : null,
    dueTomorrow: Number(counts?.dueTomorrow ?? 0),
    newCount: Number(counts?.newCount ?? 0),
    learningCount: Number(counts?.learningCount ?? 0),
    matureCount: Number(counts?.matureCount ?? 0),
    dailyGoal: prefs?.dailyGoal ?? 10,
    recallByTopic: byTopic.map((topic) => ({
      ...topic,
      reviews: Number(topic.reviews),
      recall: Number(topic.reviews) ? Math.round((Number(topic.correct ?? 0) / Number(topic.reviews)) * 100) : null
    })),
    last30Days: recentDays
  };
}

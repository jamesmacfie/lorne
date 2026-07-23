import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";
import * as schema from "#/server/db/schema";
import { buildCardCountsQuery } from "./progress-query";

describe("progress query compilation", () => {
  it("encodes due-date bounds as D1-compatible timestamp parameters", () => {
    const db = drizzle({} as D1Database, { schema, casing: "snake_case" });
    const now = new Date("2026-07-24T00:00:00.000Z");
    const tomorrowEnd = new Date("2026-07-26T00:00:00.000Z");

    const query = buildCardCountsQuery(db, "user_123", now, tomorrowEnd).toSQL();

    expect(query.params).toContain(now.getTime());
    expect(query.params).toContain(tomorrowEnd.getTime());
    expect(query.params.some((parameter) => parameter instanceof Date)).toBe(false);
  });
});

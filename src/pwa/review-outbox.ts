import { openDB, type DBSchema } from "idb";
import type { ReviewEventInput, StudyCard } from "#/shared/contracts";
import { createSortableId } from "#/shared/ids";

type StoredReview = ReviewEventInput & { userId: string };
type StoredQueue = { key: string; userId: string; cachedAt: string; position: number; card: StudyCard };

interface LorneDb extends DBSchema {
  reviews: {
    key: string;
    value: StoredReview;
    indexes: { byUser: string };
  };
  queues: {
    key: string;
    value: StoredQueue;
    indexes: { byUser: string };
  };
}

const database = () =>
  openDB<LorneDb>("lorne-user-data-v1", 1, {
    upgrade(db) {
      const reviews = db.createObjectStore("reviews", { keyPath: "id" });
      reviews.createIndex("byUser", "userId");
      const queues = db.createObjectStore("queues", { keyPath: "key" });
      queues.createIndex("byUser", "userId");
    }
  });

export function getOrCreateDeviceId(): string {
  const key = "lorne-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = createSortableId("device");
  window.localStorage.setItem(key, created);
  return created;
}

export async function enqueueReview(userId: string, input: Omit<ReviewEventInput, "id" | "deviceId">): Promise<StoredReview> {
  const review: StoredReview = { ...input, id: createSortableId("review"), deviceId: getOrCreateDeviceId(), userId };
  await (await database()).put("reviews", review);
  return review;
}

export async function cacheStudyQueue(userId: string, cards: StudyCard[]): Promise<void> {
  const db = await database();
  const transaction = db.transaction("queues", "readwrite");
  const existingKeys = await transaction.store.index("byUser").getAllKeys(userId);
  await Promise.all(existingKeys.map((key) => transaction.store.delete(key)));
  const cachedAt = new Date().toISOString();
  await Promise.all(
    cards.slice(0, 50).map((card, position) => transaction.store.put({ key: `${userId}:${card.id}`, userId, cachedAt, position, card }))
  );
  await transaction.done;
}

export async function getCachedStudyQueue(userId: string): Promise<StudyCard[]> {
  const db = await database();
  const rows = await db.getAllFromIndex("queues", "byUser", userId);
  return rows.sort((left, right) => left.position - right.position).map((row) => row.card);
}

export async function syncReviewOutbox(userId: string): Promise<{ pending: number; accepted: number }> {
  if (!navigator.onLine) {
    const pending = (await (await database()).getAllFromIndex("reviews", "byUser", userId)).length;
    return { pending, accepted: 0 };
  }
  const db = await database();
  const pending = (await db.getAllFromIndex("reviews", "byUser", userId)).slice(0, 100);
  if (pending.length === 0) return { pending: 0, accepted: 0 };
  const events = pending.map(({ userId: _userId, ...event }) => event);
  const response = await fetch("/api/reviews/sync", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events })
  });
  if (!response.ok) throw new Error("Review synchronization failed.");
  const payload = (await response.json()) as { data: { accepted: string[]; duplicates: string[] } };
  const acknowledged = [...payload.data.accepted, ...payload.data.duplicates];
  const transaction = db.transaction("reviews", "readwrite");
  await Promise.all(acknowledged.map((id) => transaction.store.delete(id)));
  await transaction.done;
  const remaining = (await db.getAllFromIndex("reviews", "byUser", userId)).length;
  return { pending: remaining, accepted: payload.data.accepted.length };
}

export async function clearPrivateOfflineData(): Promise<void> {
  const db = await database();
  await Promise.all([db.clear("reviews"), db.clear("queues")]);
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("lorne-private-")).map((key) => caches.delete(key)));
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
}

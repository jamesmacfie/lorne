import { cardChatContextSnapshotSchema, type CardChatContextSnapshot } from "#/shared/contracts";

export type CardChatSnapshotSource = {
  id: string;
  version: number;
  kind: "text" | "image";
  front: string;
  back: string;
  hint: string;
  explanation: string;
  tagsJson: string;
  assetId: string | null;
  topicId: string;
};

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function makeCardChatSnapshot(
  card: CardChatSnapshotSource,
  topic: {
    path: string[];
    notes: string;
    difficulty: "beginner" | "intermediate" | "advanced";
  }
): CardChatContextSnapshot {
  return cardChatContextSnapshotSchema.parse({
    cardId: card.id,
    version: card.version,
    kind: card.kind,
    question: card.front,
    answer: card.back,
    hint: card.hint,
    explanation: card.explanation,
    tags: parseTags(card.tagsJson),
    visualAssetId: card.assetId,
    topicId: card.topicId,
    topicPath: topic.path,
    topicNotes: topic.notes,
    difficulty: topic.difficulty
  });
}

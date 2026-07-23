import type { GeneratedCard } from "#/shared/contracts";

export const MAX_VISUAL_CARDS_PER_GENERATION = 6;

export function limitVisualCards(
  cards: GeneratedCard[],
  maximum = MAX_VISUAL_CARDS_PER_GENERATION
): { cards: GeneratedCard[]; rejectedVisualCount: number } {
  const accepted: GeneratedCard[] = [];
  let visualCount = 0;
  let rejectedVisualCount = 0;

  for (const card of cards) {
    if (card.kind !== "text") {
      if (visualCount >= maximum) {
        rejectedVisualCount += 1;
        continue;
      }
      visualCount += 1;
    }
    accepted.push(card);
  }

  return { cards: accepted, rejectedVisualCount };
}

export function bytesToWorkflowStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const copy = bytes.slice();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    }
  });
}

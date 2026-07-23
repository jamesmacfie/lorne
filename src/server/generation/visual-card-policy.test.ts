import { describe, expect, it } from "vitest";
import type { GeneratedCard } from "#/shared/contracts";
import { bytesToWorkflowStream, limitVisualCards } from "./visual-card-policy";

function card(candidateId: string, kind: GeneratedCard["kind"]): GeneratedCard {
  return {
    candidateId,
    kind,
    question: `Question ${candidateId}`,
    answer: `Answer ${candidateId}`,
    hint: "",
    explanation: "",
    tags: [],
    illustrationPrompt: kind === "illustration" ? `Illustrate ${candidateId}` : null,
    guitarDiagram:
      kind === "diagram"
        ? { title: candidateId, startFret: 1, positions: [], openStrings: [], mutedStrings: [], highlightedNotes: [] }
        : null
  };
}

describe("visual card policy", () => {
  it("retains text cards while limiting visual cards in source order", () => {
    const input = [card("c1", "illustration"), card("c2", "text"), card("c3", "diagram"), card("c4", "illustration"), card("c5", "text")];

    expect(limitVisualCards(input, 2)).toEqual({
      cards: [input[0], input[1], input[2], input[4]],
      rejectedVisualCount: 1
    });
  });

  it("streams image payloads larger than the non-stream Workflow result limit", async () => {
    const bytes = new Uint8Array(1_500_000);
    bytes[0] = 137;
    bytes[bytes.length - 1] = 42;

    const result = new Uint8Array(await new Response(bytesToWorkflowStream(bytes)).arrayBuffer());

    expect(result.byteLength).toBe(bytes.byteLength);
    expect(result[0]).toBe(137);
    expect(result[result.length - 1]).toBe(42);
  });
});

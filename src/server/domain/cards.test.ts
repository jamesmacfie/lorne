import { describe, expect, it } from "vitest";
import { cardFingerprint, containsAnswerLeak, validateGeneratedCard } from "./cards";

describe("generated card validation", () => {
  it("normalizes fingerprints and detects direct answer leakage", async () => {
    await expect(cardFingerprint("  What is   C Major? ", "C–E–G")).resolves.toBe(await cardFingerprint("what is c major?", "C–E–G"));
    expect(containsAnswerLeak("Is photosynthesis the answer?", "photosynthesis")).toBe(true);
    expect(containsAnswerLeak("Which process turns light into chemical energy?", "photosynthesis")).toBe(false);
  });

  it("requires the matching typed visual specification", () => {
    const base = {
      candidateId: "c1",
      question: "Question",
      answer: "Answer",
      hint: "",
      explanation: "",
      tags: [],
      illustrationPrompt: null,
      guitarDiagram: null
    };
    expect(validateGeneratedCard({ ...base, kind: "diagram" })).toContain("missing_diagram");
    expect(validateGeneratedCard({ ...base, kind: "illustration" })).toContain("missing_illustration_prompt");
    expect(validateGeneratedCard({ ...base, kind: "text" })).toEqual([]);
  });
});

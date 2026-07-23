import type { GeneratedCard } from "#/shared/contracts";
import { sha256Hex } from "#/shared/ids";

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export async function cardFingerprint(question: string, answer: string): Promise<string> {
  return sha256Hex(`${normalize(question)}\u001f${normalize(answer)}`);
}

export function containsAnswerLeak(question: string, answer: string): boolean {
  const normalizedQuestion = normalize(question);
  const normalizedAnswer = normalize(answer);
  if (normalizedAnswer.length < 4) return false;
  return normalizedQuestion.includes(normalizedAnswer);
}

export function validateGeneratedCard(card: GeneratedCard): string[] {
  const failures: string[] = [];
  if (containsAnswerLeak(card.question, card.answer)) failures.push("answer_leak");
  if (card.kind === "diagram" && !card.guitarDiagram) failures.push("missing_diagram");
  if (card.kind === "illustration" && !card.illustrationPrompt) failures.push("missing_illustration_prompt");
  if (card.kind === "text" && (card.guitarDiagram || card.illustrationPrompt)) failures.push("unexpected_visual");
  return failures;
}

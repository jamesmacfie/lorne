import type { GeneratedCardBatch, TopicDifficulty, VerificationBatch, VisualMix } from "#/shared/contracts";

export type TopicPromptContext = {
  path: string[];
  difficulty: TopicDifficulty;
  context: string;
  visualMix: VisualMix;
  count: number;
};

export function buildCardGenerationPrompt(topic: TopicPromptContext): string {
  return [
    "Create a rigorous, varied flashcard set for short spaced-repetition study sessions.",
    `Topic path: ${topic.path.join(" → ")}.`,
    `Learner level: ${topic.difficulty}.`,
    `Requested cards: ${topic.count}. Visual mix: ${topic.visualMix}.`,
    topic.context ? `Author context: ${topic.context}` : "No additional author context was supplied.",
    "Use durable knowledge. Reject date-sensitive facts rather than guessing current information.",
    "Questions must be independently understandable, concise, and have one defensible answer.",
    "Do not place the answer, a close synonym, or answer text in the question or image prompt.",
    "For exact guitar fretboard or chord visuals use kind=diagram and the typed guitarDiagram fields.",
    "For a useful illustrative mnemonic use kind=illustration and a prompt with no words or labels.",
    "Use no more than 6 diagram or illustration cards in total; all remaining cards must use kind=text.",
    "Use kind=text when an image would add decoration rather than learning value.",
    "candidateId must be stable within this response (c1, c2, ...). Every nullable field must be present."
  ].join("\n");
}

export function buildVerificationPrompt(topicPath: string[], batch: GeneratedCardBatch): string {
  return [
    "Act as a careful educational editor. Verify each candidate for correctness, ambiguity, answer leakage, duplicates, time sensitivity, and fit for the stated topic.",
    `Topic path: ${topicPath.join(" → ")}.`,
    "Return exactly one result for every candidateId. Use pass for sound cards, revise only when a small correction is sufficient, and reject otherwise.",
    "For pass or reject, revised fields must be null. For revise, supply complete corrected question, answer, and explanation.",
    JSON.stringify(batch)
  ].join("\n");
}

export function applyVerification(batch: GeneratedCardBatch, verification: VerificationBatch): GeneratedCardBatch {
  const byId = new Map(verification.results.map((result) => [result.candidateId, result]));
  return {
    cards: batch.cards.flatMap((card) => {
      const result = byId.get(card.candidateId);
      if (!result || result.verdict === "reject") return [];
      if (result.verdict === "pass") return [card];
      if (!result.revisedQuestion || !result.revisedAnswer || !result.revisedExplanation) return [];
      return [
        {
          ...card,
          question: result.revisedQuestion,
          answer: result.revisedAnswer,
          explanation: result.revisedExplanation
        }
      ];
    })
  };
}

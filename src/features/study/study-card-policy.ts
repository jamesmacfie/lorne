import type { StudyCard } from "#/shared/contracts";

export function filterStudyableCards(cards: StudyCard[]): StudyCard[] {
  return cards.filter((card) => card.kind === "text" || Boolean(card.assetId));
}

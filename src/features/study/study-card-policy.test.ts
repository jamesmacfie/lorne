import { describe, expect, it } from "vitest";
import type { StudyCard } from "#/shared/contracts";
import { filterStudyableCards } from "./study-card-policy";

function card(id: string, kind: StudyCard["kind"], assetId: string | null): StudyCard {
  return {
    id,
    topicId: "topic_1",
    topicTitle: "Music",
    kind,
    front: "Question",
    back: "Answer",
    hint: "",
    explanation: "",
    assetId,
    version: 1,
    dueAt: null,
    state: null
  };
}

describe("study card policy", () => {
  it("removes visual cards without assets from online and cached queues", () => {
    const text = card("text", "text", null);
    const visual = card("visual", "image", "asset_1");
    const brokenVisual = card("broken", "image", null);

    expect(filterStudyableCards([text, visual, brokenVisual])).toEqual([text, visual]);
  });
});

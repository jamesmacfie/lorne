import { describe, expect, it } from "vitest";
import { buildTopicPath } from "./topic-path";

describe("topic path", () => {
  it("reuses the complete owner-scoped ancestry order", () => {
    expect(
      buildTopicPath(
        [
          { id: "root", parentTopicId: null, title: "Music" },
          { id: "child", parentTopicId: "root", title: "Harmony" },
          { id: "leaf", parentTopicId: "child", title: "Cadences" }
        ],
        "leaf"
      )
    ).toEqual(["Music", "Harmony", "Cadences"]);
  });

  it("stops safely when malformed ancestry cycles", () => {
    expect(
      buildTopicPath(
        [
          { id: "a", parentTopicId: "b", title: "A" },
          { id: "b", parentTopicId: "a", title: "B" }
        ],
        "a"
      )
    ).toEqual(["B", "A"]);
  });
});

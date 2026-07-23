import { describe, expect, it } from "vitest";
import { CARD_CHAT_DISCLOSURE_VERSION, cardChatStreamRequestSchema, type CardChatContextSnapshot } from "#/shared/contracts";
import { buildCardChatModelMessages, buildCardChatSystemPrompt } from "./chat-prompt";
import { makeCardChatSnapshot } from "./chat-snapshot";
import { mapCardChatProviderError } from "./chat-errors";

const snapshot: CardChatContextSnapshot = {
  cardId: "card_1",
  version: 3,
  kind: "image",
  question: "What does this show?",
  answer: "A cadence",
  hint: "Listen for resolution",
  explanation: "The final chord resolves the phrase.",
  tags: ["music"],
  visualAssetId: "asset_1",
  topicId: "topic_1",
  topicPath: ["Music", "Harmony"],
  topicNotes: "Use beginner-friendly language.",
  difficulty: "beginner"
};

describe("card chat policy", () => {
  it("constructs a complete immutable snapshot and sanitizes malformed tags", () => {
    expect(
      makeCardChatSnapshot(
        {
          id: "card_1",
          version: 3,
          kind: "text",
          front: "Question",
          back: "Answer",
          hint: "",
          explanation: "Why",
          tagsJson: '["one",2,"two"]',
          assetId: null,
          topicId: "topic_1"
        },
        { path: ["Parent", "Child"], notes: "Notes", difficulty: "advanced" }
      )
    ).toMatchObject({ version: 3, tags: ["one", "two"], topicPath: ["Parent", "Child"], topicNotes: "Notes" });
  });

  it("delimits study material as untrusted and excludes unrelated context", () => {
    const prompt = buildCardChatSystemPrompt(snapshot);
    expect(prompt).toContain("<untrusted_study_material>");
    expect(prompt).toContain('"topicPath"');
    expect(prompt).toContain('"answer": "A cadence"');
    expect(prompt).not.toContain("reviewHistory");
    expect(prompt).not.toContain("otherCards");
  });

  it("includes an image once at low detail and preserves only transcript roles", () => {
    const messages = buildCardChatModelMessages(
      [
        {
          id: "msg_1",
          threadId: "chat_1",
          role: "user",
          text: "Explain it",
          replyToMessageId: null,
          status: "completed",
          model: null,
          safeErrorCode: null,
          createdAt: "2026-07-24T00:00:00.000Z",
          completedAt: "2026-07-24T00:00:00.000Z"
        },
        {
          id: "reply_1",
          threadId: "chat_1",
          role: "assistant",
          text: "It resolves.",
          replyToMessageId: "msg_1",
          status: "completed",
          model: "gpt-5.6-luna",
          safeErrorCode: null,
          createdAt: "2026-07-24T00:00:01.000Z",
          completedAt: "2026-07-24T00:00:02.000Z"
        }
      ],
      { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/png" }
    );
    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "file", providerOptions: { openai: { imageDetail: "low" } } })])
    );
  });

  it("enforces question length and disclosure version", () => {
    const valid = { message: { id: "msg_1", text: "Why?" }, contextDisclosureVersion: CARD_CHAT_DISCLOSURE_VERSION };
    expect(cardChatStreamRequestSchema.safeParse(valid).success).toBe(true);
    expect(cardChatStreamRequestSchema.safeParse({ ...valid, message: { ...valid.message, text: "x".repeat(2_001) } }).success).toBe(false);
    expect(cardChatStreamRequestSchema.safeParse({ ...valid, contextDisclosureVersion: 2 }).success).toBe(false);
  });

  it("maps provider outcomes without leaking provider payloads", () => {
    expect(mapCardChatProviderError({ status: 429, message: "secret body" }).code).toBe("PROVIDER_RATE_LIMITED");
    expect(mapCardChatProviderError({ name: "TimeoutError" }).code).toBe("CHAT_TIMEOUT");
    expect(mapCardChatProviderError(new Error("socket closed")).code).toBe("PROVIDER_AMBIGUOUS");
  });
});

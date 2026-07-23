import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { env, waitUntil } from "cloudflare:workers";
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { cardChatStreamRequestSchema, nonEmptyIdSchema, type SafeErrorCode } from "#/shared/contracts";
import { requireSession } from "#/server/auth/authorization";
import {
  CardChatError,
  completeCardChatResponse,
  failCardChatResponse,
  loadSnapshotImage,
  prepareCardChatSend
} from "#/server/chat/chat-service";
import { mapCardChatProviderError } from "#/server/chat/chat-errors";
import { buildCardChatModelMessages, buildCardChatSystemPrompt } from "#/server/chat/chat-prompt";
import { CredentialUnavailableError, loadPlaintextCredential } from "#/server/crypto/credential-service";
import { logEvent } from "#/server/observability/log";
import { isTrustedMutationOrigin, jsonError } from "#/server/security/http";
import { sha256Hex } from "#/shared/ids";

const noStoreHeaders = { "Cache-Control": "no-store", "X-Accel-Buffering": "no" };

function errorResponse(status: number, code: SafeErrorCode, message: string): Response {
  const response = jsonError(status, code, message);
  for (const [name, value] of Object.entries(noStoreHeaders)) response.headers.set(name, value);
  return response;
}

function duplicateResponse(messageId: string, text: string): Response {
  return createUIMessageStreamResponse({
    headers: noStoreHeaders,
    stream: createUIMessageStream({
      execute({ writer }) {
        const textId = `${messageId}_text`;
        writer.write({ type: "start", messageId });
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: text });
        writer.write({ type: "text-end", id: textId });
        writer.write({ type: "finish" });
      }
    })
  });
}

export const Route = createFileRoute("/api/card-chats/$threadId/stream")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const startedAt = Date.now();
        if (!nonEmptyIdSchema.safeParse(params.threadId).success) return errorResponse(400, "INVALID_INPUT", "Chat thread ID is invalid.");
        if (!isTrustedMutationOrigin(request, env.BETTER_AUTH_URL)) return errorResponse(403, "FORBIDDEN", "Request origin rejected.");
        const authenticated = await requireSession(request);
        if (!authenticated) return errorResponse(401, "AUTH_REQUIRED", "Sign in to ask about this card.");
        if (Number(request.headers.get("content-length") ?? 0) > 12_000)
          return errorResponse(413, "INVALID_INPUT", "Chat request is too large.");
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return errorResponse(400, "INVALID_INPUT", "Chat request is not valid JSON.");
        }
        const parsed = cardChatStreamRequestSchema.safeParse(payload);
        if (!parsed.success) return errorResponse(400, "INVALID_INPUT", "Chat request is invalid.");

        const rate = await env.CHAT_RATE_LIMITER.limit({ key: authenticated.user.id });
        if (!rate.success) return errorResponse(429, "RATE_LIMITED", "You have sent 10 questions this minute. Take a short pause.");

        let apiKey: string;
        try {
          apiKey = await loadPlaintextCredential(authenticated.user.id);
        } catch (error) {
          if (error instanceof CredentialUnavailableError) {
            const code = error.reason === "limited" ? "CREDENTIAL_LIMITED" : "CREDENTIAL_REQUIRED";
            return errorResponse(
              409,
              code,
              error.reason === "limited" ? "Your saved OpenAI key cannot use the chat model." : "Add an OpenAI key in Settings first."
            );
          }
          return errorResponse(500, "INTERNAL_ERROR", "The saved OpenAI key could not be opened.");
        }

        let prepared: Awaited<ReturnType<typeof prepareCardChatSend>>;
        try {
          prepared = await prepareCardChatSend(authenticated.user.id, params.threadId, parsed.data, env.OPENAI_CHAT_MODEL);
        } catch (error) {
          if (error instanceof CardChatError) {
            const status = error.code === "NOT_FOUND" ? 404 : error.code === "CHAT_ACTIVE_RESPONSE" ? 409 : 400;
            return errorResponse(status, error.code, error.message);
          }
          return errorResponse(500, "INTERNAL_ERROR", "Chat could not be prepared.");
        }
        if (prepared.duplicateAssistant) {
          return duplicateResponse(prepared.duplicateAssistant.id, prepared.duplicateAssistant.text);
        }

        const userHash = (await sha256Hex(`lorne:${authenticated.user.id}`)).slice(0, 64);
        let image: Awaited<ReturnType<typeof loadSnapshotImage>>;
        try {
          image = await loadSnapshotImage(authenticated.user.id, prepared.snapshot);
        } catch {
          await failCardChatResponse(authenticated.user.id, prepared.assistantMessageId, "", "failed", "IMAGE_UNAVAILABLE");
          return errorResponse(409, "IMAGE_UNAVAILABLE", "The saved card image is unavailable.");
        }
        if (prepared.snapshot.kind === "image" && !image) {
          await failCardChatResponse(authenticated.user.id, prepared.assistantMessageId, "", "failed", "IMAGE_UNAVAILABLE");
          return errorResponse(409, "IMAGE_UNAVAILABLE", "The saved card image is unavailable.");
        }
        const openai = createOpenAI({ apiKey });
        let partialText = "";
        let providerError: unknown;
        const result = streamText({
          model: openai(env.OPENAI_CHAT_MODEL),
          system: buildCardChatSystemPrompt(prepared.snapshot),
          messages: buildCardChatModelMessages(prepared.messages, image),
          maxOutputTokens: 800,
          maxRetries: 0,
          timeout: 60_000,
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              store: false,
              reasoningEffort: "none",
              textVerbosity: "low",
              safetyIdentifier: userHash
            }
          },
          onChunk: ({ chunk }) => {
            if (chunk.type === "text-delta") partialText += chunk.text;
          },
          onError: async ({ error }) => {
            providerError = error;
            const mapped = mapCardChatProviderError(error);
            if (mapped.code === "CHAT_TIMEOUT") return;
            await failCardChatResponse(authenticated.user.id, prepared.assistantMessageId, partialText, "failed", mapped.code);
            logEvent("card_chat.failed", {
              userHash,
              state: "failed",
              model: env.OPENAI_CHAT_MODEL,
              durationMs: Date.now() - startedAt,
              code: mapped.code
            });
          },
          onAbort: async () => {
            await failCardChatResponse(authenticated.user.id, prepared.assistantMessageId, partialText, "aborted", "CHAT_TIMEOUT");
            logEvent("card_chat.aborted", {
              userHash,
              state: "aborted",
              model: env.OPENAI_CHAT_MODEL,
              durationMs: Date.now() - startedAt,
              code: "CHAT_TIMEOUT"
            });
          },
          onEnd: async ({ text, usage, response, finishReason }) => {
            if (finishReason === "content-filter" || finishReason === "error") {
              const mapped =
                finishReason === "content-filter"
                  ? { code: "PROVIDER_REFUSED" as const, message: "OpenAI declined to answer this question." }
                  : mapCardChatProviderError(providerError);
              await failCardChatResponse(authenticated.user.id, prepared.assistantMessageId, text || partialText, "failed", mapped.code);
              return;
            }
            await completeCardChatResponse(authenticated.user.id, prepared.assistantMessageId, text, usage, response.id ?? null);
            logEvent("card_chat.completed", {
              userHash,
              state: "completed",
              model: env.OPENAI_CHAT_MODEL,
              durationMs: Date.now() - startedAt,
              usage: {
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                totalTokens: usage.totalTokens ?? 0
              }
            });
          }
        });

        waitUntil(Promise.resolve(result.consumeStream()));
        return result.toUIMessageStreamResponse({
          headers: noStoreHeaders,
          generateMessageId: () => prepared.assistantMessageId,
          onError: (error) => mapCardChatProviderError(error).message
        });
      }
    }
  }
});

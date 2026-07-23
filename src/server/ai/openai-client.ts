import { env } from "cloudflare:workers";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { generatedCardBatchSchema, verificationBatchSchema, type GeneratedCardBatch, type VerificationBatch } from "#/shared/contracts";
import { sha256Hex } from "#/shared/ids";
import { loadPlaintextCredential } from "#/server/crypto/credential-service";
import { beginProviderCall, completeProviderCall } from "./provider-ledger";
import { buildCardGenerationPrompt, buildVerificationPrompt, type TopicPromptContext } from "./prompts";

export class ProviderResponseError extends Error {
  constructor(public readonly code: "rate_limited" | "refused" | "schema" | "permission" | "unavailable") {
    super(`Provider response failed: ${code}`);
  }
}

async function withRateLimitRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof OpenAI.APIError) || error.status !== 429 || attempt === 2) {
        if (error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          throw new ProviderResponseError("permission");
        }
        if (error instanceof OpenAI.APIError && error.status === 429) throw new ProviderResponseError("rate_limited");
        throw error;
      }
      const retryAfter = Number(error.headers?.get("retry-after") ?? 1);
      await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(retryAfter, 1), 10) * 1_000));
    }
  }
  throw new ProviderResponseError("rate_limited");
}

async function openAiForUser(userId: string): Promise<OpenAI> {
  const apiKey = await loadPlaintextCredential(userId);
  return new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000 });
}

export async function generateCardCandidates(jobId: string, userId: string, topic: TopicPromptContext): Promise<GeneratedCardBatch> {
  const callId = await beginProviderCall(jobId, "generate-candidates", "generate_cards");
  const client = await openAiForUser(userId);
  const safetyIdentifier = (await sha256Hex(`lorne:${userId}`)).slice(0, 64);
  const response = await withRateLimitRetry(() =>
    client.responses.parse({
      model: env.OPENAI_TEXT_MODEL,
      store: false,
      reasoning: { effort: env.OPENAI_TEXT_REASONING_EFFORT as "low" },
      safety_identifier: safetyIdentifier,
      input: buildCardGenerationPrompt(topic),
      text: { format: zodTextFormat(generatedCardBatchSchema, "flashcard_candidates") }
    })
  );
  if (!response.output_parsed) throw new ProviderResponseError("refused");
  const parsed = generatedCardBatchSchema.safeParse(response.output_parsed);
  if (!parsed.success) throw new ProviderResponseError("schema");
  await completeProviderCall(callId, response._request_id ?? null, response.usage);
  return parsed.data;
}

export async function verifyCardCandidates(
  jobId: string,
  userId: string,
  topicPath: string[],
  batch: GeneratedCardBatch
): Promise<VerificationBatch> {
  const callId = await beginProviderCall(jobId, "verify-candidates", "verify_cards");
  const client = await openAiForUser(userId);
  const safetyIdentifier = (await sha256Hex(`lorne:${userId}`)).slice(0, 64);
  const response = await withRateLimitRetry(() =>
    client.responses.parse({
      model: env.OPENAI_TEXT_MODEL,
      store: false,
      reasoning: { effort: env.OPENAI_TEXT_REASONING_EFFORT as "low" },
      safety_identifier: safetyIdentifier,
      input: buildVerificationPrompt(topicPath, batch),
      text: { format: zodTextFormat(verificationBatchSchema, "flashcard_verification") }
    })
  );
  if (!response.output_parsed) throw new ProviderResponseError("refused");
  const parsed = verificationBatchSchema.safeParse(response.output_parsed);
  if (!parsed.success) throw new ProviderResponseError("schema");
  await completeProviderCall(callId, response._request_id ?? null, response.usage);
  return parsed.data;
}

export async function generateIllustration(jobId: string, stepKey: string, userId: string, prompt: string): Promise<Uint8Array> {
  const callId = await beginProviderCall(jobId, stepKey, "generate_image");
  const client = await openAiForUser(userId);
  const safetyUser = (await sha256Hex(`lorne:${userId}`)).slice(0, 64);
  const response = await withRateLimitRetry(() =>
    client.images.generate({
      model: env.OPENAI_IMAGE_MODEL,
      prompt: `${prompt}\nSquare educational illustration on a warm paper background. No words, letters, numbers, labels, captions, watermarks, or answer text.`,
      n: 1,
      quality: "medium",
      size: "1024x1024",
      output_format: "png",
      moderation: "auto",
      user: safetyUser
    })
  );
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new ProviderResponseError("unavailable");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytes.byteLength > 15 * 1024 * 1024 || !isSquarePng(bytes)) throw new ProviderResponseError("schema");
  await completeProviderCall(callId, response._request_id ?? null, null);
  return bytes;
}

function isSquarePng(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.byteLength < 24 || !signature.every((value, index) => bytes[index] === value)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width === 1024 && height === 1024;
}

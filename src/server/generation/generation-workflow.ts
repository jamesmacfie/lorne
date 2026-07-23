import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { cardAssets, cards, generationJobs } from "#/server/db/schema";
import { cardFingerprint, validateGeneratedCard } from "#/server/domain/cards";
import { createId, sha256Hex } from "#/shared/ids";
import type { GeneratedCard, TopicDifficulty, VisualMix } from "#/shared/contracts";
import { AmbiguousProviderCallError, isAmbiguousProviderCallError } from "#/server/ai/provider-ledger";
import { applyVerification } from "#/server/ai/prompts";
import { generateCardCandidates, generateIllustration, ProviderResponseError, verifyCardCandidates } from "#/server/ai/openai-client";
import { renderGuitarDiagram } from "#/server/ai/guitar-diagram";
import { CredentialUnavailableError } from "#/server/crypto/credential-service";
import { logEvent } from "#/server/observability/log";
import { getOwnedTopicContext } from "#/server/topics/topic-context";
import { bytesToWorkflowStream, limitVisualCards } from "./visual-card-policy";

export type CardGenerationParams = { jobId: string; userId: string; topicId: string };

function safeFailure(error: unknown): { status: "failed" | "action_required"; code: string } {
  if (error instanceof AmbiguousProviderCallError) return { status: "action_required", code: "PROVIDER_AMBIGUOUS" };
  if (error instanceof CredentialUnavailableError) {
    return { status: "action_required", code: error.reason === "limited" ? "CREDENTIAL_LIMITED" : "CREDENTIAL_REQUIRED" };
  }
  if (error instanceof ProviderResponseError) {
    const codes = {
      rate_limited: "PROVIDER_RATE_LIMITED",
      refused: "PROVIDER_REFUSED",
      schema: "PROVIDER_SCHEMA_ERROR",
      permission: "CREDENTIAL_LIMITED",
      unavailable: "INTERNAL_ERROR"
    } as const;
    return { status: error.code === "permission" ? "action_required" : "failed", code: codes[error.code] };
  }
  return { status: "failed", code: "INTERNAL_ERROR" };
}

export class CardGenerationWorkflow extends WorkflowEntrypoint<Env, CardGenerationParams> {
  async run(event: WorkflowEvent<CardGenerationParams>, step: WorkflowStep) {
    const { jobId, userId, topicId } = event.payload;
    const db = getDb();
    try {
      const context = await step.do("load-topic", async () => {
        const topicContext = await getOwnedTopicContext(userId, topicId);
        if (!topicContext) throw new Error("Topic not found.");
        const { topic, path } = topicContext;
        const [job] = await db
          .select()
          .from(generationJobs)
          .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)))
          .limit(1);
        if (!job) throw new Error("Job not found.");
        await db
          .update(generationJobs)
          .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
          .where(eq(generationJobs.id, jobId));
        return {
          path,
          difficulty: topic.difficulty as TopicDifficulty,
          context: topic.context,
          visualMix: topic.visualMix as VisualMix,
          count: job.requestedCount
        };
      });

      const generated = await step.do("generate-candidates", async () => generateCardCandidates(jobId, userId, context));
      const verification = await step.do("verify-candidates", async () => verifyCardCandidates(jobId, userId, context.path, generated));
      const verified = applyVerification(generated, verification);

      const persisted = await step.do("validate-and-persist", async () => {
        const limited = limitVisualCards(verified.cards);
        const candidates = await Promise.all(
          limited.cards.map(async (card) => ({ card, fingerprint: await cardFingerprint(card.question, card.answer) }))
        );
        const existing = candidates.length
          ? await db
              .select({ fingerprint: cards.fingerprint })
              .from(cards)
              .where(
                and(
                  eq(cards.topicId, topicId),
                  inArray(
                    cards.fingerprint,
                    candidates.map((candidate) => candidate.fingerprint)
                  )
                )
              )
          : [];
        const existingSet = new Set(existing.map((card) => card.fingerprint));
        const now = new Date();
        const accepted: Array<{ id: string; card: GeneratedCard }> = [];
        let rejected = generated.cards.length - verified.cards.length + limited.rejectedVisualCount;
        for (const { card, fingerprint } of candidates) {
          if (existingSet.has(fingerprint) || validateGeneratedCard(card).length > 0) {
            rejected += 1;
            continue;
          }
          existingSet.add(fingerprint);
          const id = createId("card");
          const [inserted] = await db
            .insert(cards)
            .values({
              id,
              userId,
              topicId,
              generationJobId: jobId,
              kind: card.kind === "text" ? "text" : "image",
              front: card.question,
              back: card.answer,
              hint: card.hint,
              explanation: card.explanation,
              tagsJson: JSON.stringify(card.tags),
              fingerprint,
              source: "generated",
              status: card.kind === "text" ? "published" : "flagged",
              version: 1,
              createdAt: now,
              updatedAt: now
            })
            .onConflictDoNothing()
            .returning({ id: cards.id });
          if (inserted) accepted.push({ id, card });
        }
        await db
          .update(generationJobs)
          .set({ acceptedCount: accepted.length, rejectedCount: rejected, updatedAt: now })
          .where(eq(generationJobs.id, jobId));
        return { accepted, rejected };
      });

      let imageCount = 0;
      let imageFailures = 0;
      const visualCards = persisted.accepted.filter((item) => item.card.kind !== "text");
      for (const item of visualCards) {
        try {
          const illustrationPrompt = item.card.illustrationPrompt;
          const illustrationStream =
            item.card.kind === "illustration" && illustrationPrompt
              ? await step.do(
                  `generate-image-${item.card.candidateId}`,
                  { retries: { limit: 0, delay: "1 second" }, timeout: "10 minutes" },
                  async () => {
                    const bytes = await generateIllustration(jobId, `image-${item.card.candidateId}`, userId, illustrationPrompt);
                    return bytesToWorkflowStream(bytes);
                  }
                )
              : null;
          const illustrationBytes = illustrationStream ? new Uint8Array(await new Response(illustrationStream).arrayBuffer()) : null;
          const asset = await step.do(`store-asset-${item.card.candidateId}`, async () => {
            const assetId = `asset_${(await sha256Hex(`${jobId}:${item.id}`)).slice(0, 32)}`;
            const key = `${userId}/${topicId}/${assetId}`;
            let body: Uint8Array | string;
            let mimeType: string;
            let width: number;
            let height: number;
            let source: "diagram" | "generated";
            if (item.card.kind === "diagram" && item.card.guitarDiagram) {
              body = renderGuitarDiagram(item.card.guitarDiagram);
              mimeType = "image/svg+xml";
              width = 800;
              height = 800;
              source = "diagram";
            } else if (illustrationBytes) {
              body = illustrationBytes;
              mimeType = "image/png";
              width = 1024;
              height = 1024;
              source = "generated";
            } else {
              throw new Error("Visual specification missing.");
            }
            const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
            const contentHash = await sha256Hex(bytes);
            await this.env.CARD_IMAGES.put(key, body, { httpMetadata: { contentType: mimeType }, customMetadata: { hash: contentHash } });
            await db
              .insert(cardAssets)
              .values({
                id: assetId,
                userId,
                r2Key: key,
                source,
                mimeType,
                width,
                height,
                byteSize: bytes.byteLength,
                contentHash,
                status: "ready",
                createdAt: new Date()
              })
              .onConflictDoUpdate({
                target: cardAssets.id,
                set: { source, mimeType, width, height, byteSize: bytes.byteLength, contentHash, status: "ready" }
              });
            await db
              .update(cards)
              .set({ assetId, status: "published", updatedAt: new Date() })
              .where(and(eq(cards.id, item.id), eq(cards.userId, userId)));
            return assetId;
          });
          if (asset) imageCount += 1;
        } catch (error) {
          if (isAmbiguousProviderCallError(error)) throw new AmbiguousProviderCallError();
          imageFailures += 1;
        }
      }

      const status = imageFailures > 0 ? "partial" : "completed";
      await step.do("complete-job", async () => {
        await db
          .update(generationJobs)
          .set({
            status,
            imageCount,
            safeErrorCode: imageFailures ? "IMAGE_UNAVAILABLE" : null,
            completedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(generationJobs.id, jobId));
      });
      logEvent("generation.completed", { jobId, state: status });
      return { jobId, status, accepted: persisted.accepted.length, rejected: persisted.rejected, imageCount };
    } catch (error) {
      const failed = safeFailure(error);
      await step.do("record-failure", async () => {
        await db
          .update(generationJobs)
          .set({ status: failed.status, safeErrorCode: failed.code, completedAt: new Date(), updatedAt: new Date() })
          .where(eq(generationJobs.id, jobId));
      });
      logEvent("generation.failed", { jobId, state: failed.status, code: failed.code });
      return { jobId, ...failed };
    }
  }
}

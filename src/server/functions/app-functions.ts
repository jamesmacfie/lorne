import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  bulkTopicInputSchema,
  failure,
  nonEmptyIdSchema,
  saveCredentialInputSchema,
  startGenerationInputSchema,
  studyQueueInputSchema,
  success,
  topicIdInputSchema,
  updatePreferencesInputSchema,
  updateTopicInputSchema
} from "#/shared/contracts";
import { getSession } from "#/server/auth/auth";
import { getRequest } from "@tanstack/react-start/server";
import { serverUser } from "./authenticated";
import {
  archiveTopic,
  createTopics,
  deleteTopic,
  listTopicCards,
  listTopics,
  updateCard,
  updateTopic
} from "#/server/topics/topic-service";
import { getStudyQueue } from "#/server/study/study-service";
import { getProgress } from "#/server/progress/progress-service";
import { credentialSummary, deleteCredential, saveCredential } from "#/server/crypto/credential-service";
import { getDb } from "#/server/db/client";
import { userPreferences } from "#/server/db/schema";
import { GenerationStartError, listGenerationJobs, startGeneration } from "#/server/generation/generation-service";

export const getViewerFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSession(getRequest());
  return session?.user
    ? { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null }
    : null;
});

export const getStudyDataFn = createServerFn({ method: "GET" })
  .validator(studyQueueInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser();
    const [queue, topicRows] = await Promise.all([getStudyQueue(user.id, data.limit, data.topicIds), listTopics(user.id)]);
    return { queue, topics: topicRows.filter((topic) => topic.status === "active") };
  });

export const getTopicsDataFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await serverUser();
  const [topicRows, jobs] = await Promise.all([listTopics(user.id), listGenerationJobs(user.id)]);
  return { topics: topicRows, jobs };
});

export const getTopicCardsFn = createServerFn({ method: "GET" })
  .validator(topicIdInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser();
    return listTopicCards(user.id, data.id);
  });

export const createTopicsFn = createServerFn({ method: "POST" })
  .validator(bulkTopicInputSchema)
  .handler(async ({ data }) => {
    try {
      const user = await serverUser({ mutation: true });
      return success(await createTopics(user.id, data.topics));
    } catch {
      return failure("INVALID_INPUT", "Those topics could not be created. Check the names and parent topic.");
    }
  });

export const updateTopicFn = createServerFn({ method: "POST" })
  .validator(updateTopicInputSchema)
  .handler(async ({ data }) => {
    try {
      const user = await serverUser({ mutation: true });
      return success(await updateTopic(user.id, data.id, data));
    } catch {
      return failure("INVALID_INPUT", "That topic change could not be saved.");
    }
  });

export const archiveTopicFn = createServerFn({ method: "POST" })
  .validator(topicIdInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    return success(await archiveTopic(user.id, data.id));
  });

export const deleteTopicFn = createServerFn({ method: "POST" })
  .validator(topicIdInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    await deleteTopic(user.id, data.id);
    return success({ id: data.id });
  });

const cardUpdateSchema = z.object({
  id: nonEmptyIdSchema,
  front: z.string().trim().min(1).max(500),
  back: z.string().trim().min(1).max(1_000),
  hint: z.string().trim().max(300),
  explanation: z.string().trim().max(1_500),
  status: z.enum(["published", "archived", "flagged"])
});

export const updateCardFn = createServerFn({ method: "POST" })
  .validator(cardUpdateSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    return success(await updateCard(user.id, data));
  });

export const startGenerationFn = createServerFn({ method: "POST" })
  .validator(startGenerationInputSchema)
  .handler(async ({ data }) => {
    try {
      const user = await serverUser({ mutation: true });
      return success(await startGeneration(user.id, data));
    } catch (error) {
      if (error instanceof GenerationStartError) {
        const messages = {
          NOT_FOUND: "That topic is unavailable.",
          CREDENTIAL_REQUIRED: "Add an OpenAI key in Settings first.",
          CREDENTIAL_INVALID: "Replace the invalid OpenAI key in Settings.",
          CREDENTIAL_LIMITED: "The OpenAI key does not have the required permissions.",
          RATE_LIMITED: "You have started two generations this minute. Take a short pause.",
          ACTIVE_JOB_LIMIT: "Two generations are already in progress.",
          TOPIC_JOB_ACTIVE: "This topic already has a generation in progress."
        } as const;
        return failure(error.code, messages[error.code]);
      }
      return failure("INTERNAL_ERROR", "Generation could not be started.");
    }
  });

export const getProgressFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await serverUser();
  return getProgress(user.id);
});

export const getSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await serverUser();
  const preferences = await getDb().query.userPreferences.findFirst({ where: eq(userPreferences.userId, user.id) });
  return { credential: await credentialSummary(user.id), preferences };
});

export const saveCredentialFn = createServerFn({ method: "POST" })
  .validator(saveCredentialInputSchema)
  .handler(async ({ data }) => {
    try {
      const user = await serverUser({ mutation: true });
      const rate = await env.CREDENTIAL_RATE_LIMITER.limit({ key: user.id });
      if (!rate.success) return failure("RATE_LIMITED", "Too many credential checks. Try again in a minute.");
      const result = await saveCredential(user.id, data.apiKey);
      if (!result.saved) return failure("CREDENTIAL_INVALID", "OpenAI rejected this key.");
      return success(result);
    } catch {
      return failure("INTERNAL_ERROR", "The key could not be validated right now.");
    }
  });

export const deleteCredentialFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await serverUser({ mutation: true });
  await deleteCredential(user.id);
  return success({ deleted: true });
});

export const updatePreferencesFn = createServerFn({ method: "POST" })
  .validator(updatePreferencesInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    await getDb()
      .insert(userPreferences)
      .values({ userId: user.id, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...data, updatedAt: new Date() }
      });
    return success(data);
  });

import { createServerFn } from "@tanstack/react-start";
import { cardChatCardInputSchema, cardChatCardIdInputSchema, cardChatThreadInputSchema, failure, success } from "#/shared/contracts";
import { serverUser } from "./authenticated";
import { deleteCardChat, getCardChatDetail, getLatestCardChat, hasOlderCardChats, listCardChatThreads } from "#/server/chat/chat-service";
import { buildCardChatSnapshot } from "#/server/chat/chat-context";

export const listCardChatsFn = createServerFn({ method: "POST" }).handler(async () => {
  const user = await serverUser({ mutation: true });
  return listCardChatThreads(user.id);
});

export const getCardChatFn = createServerFn({ method: "POST" })
  .validator(cardChatThreadInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    return getCardChatDetail(user.id, data.threadId);
  });

export const getCardChatPanelFn = createServerFn({ method: "POST" })
  .validator(cardChatCardInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    const [latest, hasOlderVersions] = await Promise.all([
      getLatestCardChat(user.id, data.cardId, data.cardVersion),
      hasOlderCardChats(user.id, data.cardId, data.cardVersion)
    ]);
    return { latest, hasOlderVersions };
  });

export const getCardChatNewThreadFn = createServerFn({ method: "POST" })
  .validator(cardChatCardIdInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    return buildCardChatSnapshot(user.id, data.cardId);
  });

export const deleteCardChatFn = createServerFn({ method: "POST" })
  .validator(cardChatThreadInputSchema)
  .handler(async ({ data }) => {
    const user = await serverUser({ mutation: true });
    const deleted = await deleteCardChat(user.id, data.threadId);
    return deleted ? success({ threadId: data.threadId }) : failure("NOT_FOUND", "That chat no longer exists.");
  });

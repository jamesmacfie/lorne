import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ChatIndexScreen } from "#/features/chat/chat-index-screen";

export const Route = createFileRoute("/chats/")({ component: ChatsRoute });
const rootRoute = getRouteApi("__root__");

function ChatsRoute() {
  return rootRoute.useLoaderData() ? <ChatIndexScreen /> : null;
}

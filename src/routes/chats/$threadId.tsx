import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ChatDetailScreen } from "#/features/chat/chat-detail-screen";

export const Route = createFileRoute("/chats/$threadId")({ component: ChatDetailRoute });
const rootRoute = getRouteApi("__root__");

function ChatDetailRoute() {
  const viewer = rootRoute.useLoaderData();
  const { threadId } = Route.useParams();
  return viewer ? <ChatDetailScreen threadId={threadId} /> : null;
}

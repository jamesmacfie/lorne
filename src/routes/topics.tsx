import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { TopicsScreen } from "#/features/topics/topics-screen";

export const Route = createFileRoute("/topics")({ component: TopicsRoute });
const rootRoute = getRouteApi("__root__");
function TopicsRoute() {
  return rootRoute.useLoaderData() ? <TopicsScreen /> : null;
}

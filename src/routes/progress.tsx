import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ProgressScreen } from "#/features/progress/progress-screen";

export const Route = createFileRoute("/progress")({ component: ProgressRoute });
const rootRoute = getRouteApi("__root__");
function ProgressRoute() {
  return rootRoute.useLoaderData() ? <ProgressScreen /> : null;
}

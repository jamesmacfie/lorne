import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { StudyScreen } from "#/features/study/study-screen";

export const Route = createFileRoute("/")({ component: StudyRoute });
const rootRoute = getRouteApi("__root__");

function StudyRoute() {
  const viewer = rootRoute.useLoaderData();
  return viewer ? <StudyScreen userId={viewer.id} /> : null;
}

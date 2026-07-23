import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { SettingsScreen } from "#/features/settings/settings-screen";

export const Route = createFileRoute("/settings")({ component: SettingsRoute });
const rootRoute = getRouteApi("__root__");
function SettingsRoute() {
  return rootRoute.useLoaderData() ? <SettingsScreen /> : null;
}

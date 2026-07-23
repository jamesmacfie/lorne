import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import bricolageCss from "@fontsource-variable/bricolage-grotesque/index.css?url";
import geistCss from "@fontsource-variable/geist/index.css?url";
import tokensCss from "../../tokens.css?url";
import appCss from "../styles/app.css?url";
import { getViewerFn } from "#/server/functions/app-functions";
import { AppShell } from "#/features/app/app-shell";
import { SignInScreen } from "#/features/auth/sign-in-screen";
import { registerLorneServiceWorker } from "#/pwa/register";

export const Route = createRootRoute({
  loader: () => getViewerFn(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#f5f1e8" },
      { name: "description", content: "Learn useful things in little moments with a focused flashcard companion." },
      { title: "Lorne — learn in little moments" }
    ],
    links: [
      { rel: "stylesheet", href: bricolageCss },
      { rel: "stylesheet", href: geistCss },
      { rel: "stylesheet", href: tokensCss },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" }
    ]
  }),
  component: RootComponent,
  shellComponent: RootDocument,
  errorComponent: () => (
    <main className="fatal-error">
      <p className="eyebrow">Something wandered off</p>
      <h1>Lorne could not open this page.</h1>
      <a className="button button--primary" href="/">
        Return to study
      </a>
    </main>
  ),
  notFoundComponent: () => (
    <main className="fatal-error">
      <p className="eyebrow">404</p>
      <h1>There’s no card tucked here.</h1>
      <a className="button button--primary" href="/">
        Return to study
      </a>
    </main>
  )
});

function RootComponent() {
  const viewer = Route.useLoaderData();
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => registerLorneServiceWorker(() => setUpdateReady(true)), []);
  return viewer ? (
    <AppShell viewer={viewer} updateReady={updateReady}>
      <Outlet />
    </AppShell>
  ) : (
    <>
      {updateReady && (
        <button type="button" className="update-banner" onClick={() => window.location.reload()}>
          A fresh Lorne is ready. Reload
        </button>
      )}
      <SignInScreen />
    </>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request, url }) => request.method === "GET" && url.pathname.startsWith("/api/assets/"),
  new CacheFirst({
    cacheName: "lorne-private-assets-v1",
    plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 7 * 24 * 60 * 60 })]
  })
);

registerRoute(
  ({ request, url }) => request.mode === "navigate" && url.origin === self.location.origin,
  new NetworkFirst({
    cacheName: "lorne-private-pages-v1",
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 24 * 60 * 60 })]
  })
);

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_PRIVATE_CACHES") return;
  event.waitUntil(Promise.all([caches.delete("lorne-private-assets-v1"), caches.delete("lorne-private-pages-v1")]));
});

self.addEventListener("sync", (event) => {
  const syncEvent = event as ExtendableEvent & { tag?: string };
  if (syncEvent.tag === "lorne-reviews") {
    syncEvent.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        for (const client of clients) client.postMessage({ type: "SYNC_REVIEWS" });
      })
    );
  }
});

import { Workbox } from "workbox-window";

const developmentPwaEnabled = import.meta.env.VITE_ENABLE_PWA_DEV === "true";
const developmentResetMarker = "lorne-development-pwa-reset";

async function clearDevelopmentPwaState(): Promise<void> {
  const controlled = Boolean(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith("lorne-") || cacheName.startsWith("workbox-precache"))
      .map((cacheName) => caches.delete(cacheName))
  );

  if (controlled && window.sessionStorage.getItem(developmentResetMarker) !== "complete") {
    window.sessionStorage.setItem(developmentResetMarker, "complete");
    window.location.reload();
    return;
  }
  window.sessionStorage.removeItem(developmentResetMarker);
}

if (typeof window !== "undefined" && import.meta.env.DEV && !developmentPwaEnabled && "serviceWorker" in navigator) {
  void clearDevelopmentPwaState();
}

export function registerLorneServiceWorker(onUpdate: () => void): (() => void) | undefined {
  if (!("serviceWorker" in navigator)) return;
  const development = import.meta.env.DEV;
  if (development && !developmentPwaEnabled) return;
  const workbox = new Workbox(development ? "/dev-sw.js?dev-sw" : "/service-worker.js", {
    type: development ? "module" : "classic"
  });
  workbox.addEventListener("waiting", onUpdate);
  void workbox.register();
  return () => workbox.removeEventListener("waiting", onUpdate);
}

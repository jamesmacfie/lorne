import { Workbox } from "workbox-window";

export function registerLorneServiceWorker(onUpdate: () => void): (() => void) | undefined {
  if (!("serviceWorker" in navigator)) return;
  const development = import.meta.env.DEV;
  const workbox = new Workbox(development ? "/dev-sw.js?dev-sw" : "/service-worker.js", {
    type: development ? "module" : "classic"
  });
  workbox.addEventListener("waiting", onUpdate);
  void workbox.register();
  return () => workbox.removeEventListener("waiting", onUpdate);
}

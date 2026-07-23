import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const applyToClient: NonNullable<Plugin["applyToEnvironment"]> = (environment) => environment.name === "client";
const developmentPwaEnabled = process.env.VITE_ENABLE_PWA_DEV === "true";

const pwaPlugins = VitePWA({
  strategies: "injectManifest",
  srcDir: "src/pwa",
  filename: "service-worker.ts",
  registerType: "prompt",
  injectRegister: false,
  manifest: {
    name: "Lorne — learn in little moments",
    short_name: "Lorne",
    description: "A fast, focused flashcard companion for spare moments.",
    theme_color: "#f5f1e8",
    background_color: "#f5f1e8",
    display: "standalone",
    start_url: "/",
    scope: "/",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
  },
  injectManifest: {
    globPatterns: ["**/*.{js,css,html,svg,woff2}"]
  },
  devOptions: { enabled: developmentPwaEnabled, type: "module" }
}).map((plugin) => ({
  ...plugin,
  // Vite's Environment API otherwise shares the PWA plugin state with the SSR build,
  // whose `build.ssr` flag intentionally suppresses service-worker emission.
  applyToEnvironment: applyToClient
}));

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react(), ...pwaPlugins]
});

import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build as viteBuild } from "vite";
import { injectManifest } from "workbox-build";

const root = process.cwd();
const clientDirectory = resolve(root, "dist/client");
const temporaryDirectory = resolve(root, "dist/pwa-source");
const sourceWorker = resolve(temporaryDirectory, "service-worker.js");
const outputWorker = resolve(clientDirectory, "service-worker.js");

try {
  await viteBuild({
    configFile: false,
    publicDir: false,
    logLevel: "warn",
    build: {
      outDir: temporaryDirectory,
      emptyOutDir: true,
      target: "es2022",
      minify: true,
      rollupOptions: {
        input: resolve(root, "src/pwa/service-worker.ts"),
        output: {
          entryFileNames: "service-worker.js",
          format: "es",
          codeSplitting: false
        }
      }
    }
  });

  const result = await injectManifest({
    swSrc: sourceWorker,
    swDest: outputWorker,
    globDirectory: clientDirectory,
    globPatterns: ["**/*.{js,css,html,svg,woff2,webmanifest}"],
    maximumFileSizeToCacheInBytes: 2 * 1024 * 1024
  });
  const output = await readFile(outputWorker, "utf8");
  if (result.count === 0 || output.includes("self.__WB_MANIFEST")) {
    throw new Error("The service-worker precache manifest was not injected.");
  }
  console.log(`PWA service worker emitted with ${result.count} precached assets (${result.size} bytes).`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

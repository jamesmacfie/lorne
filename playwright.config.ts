import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.PLAYWRIGHT_PORT ?? 4174);
const e2eOrigin = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: e2eOrigin,
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"]
  },
  webServer: {
    command: `pnpm exec vite dev --port ${e2ePort}`,
    url: e2eOrigin,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      BETTER_AUTH_URL: e2eOrigin,
      BETTER_AUTH_SECRET: "e2e-placeholder-auth-secret-with-at-least-32-bytes",
      OPENAI_CREDENTIAL_ENCRYPTION_KEY_V1: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
      VITE_ENABLE_PWA_DEV: "true"
    }
  }
});

# Lorne

Lorne is a private, mobile-first flashcard PWA for learning in spare moments. It turns a topic into a verified stack of text, diagram, and illustration cards; schedules them with FSRS; and keeps offline reviews safe until they can synchronize.

## What is implemented

- TanStack Start SSR and typed server functions on one Cloudflare Worker.
- Better Auth username/password sessions with one-time invite-code enforcement before first account creation.
- D1 and Drizzle for auth, topic/card management, immutable review events, FSRS projections, progress rollups, generation jobs, and provider-call ledgers.
- User-owned OpenAI keys encrypted with AES-256-GCM and bound AAD; no application-wide OpenAI key.
- Resumable first-login onboarding that requires a topic, study rhythm, and verified encrypted OpenAI key before opening the app shell.
- Cloudflare Workflow card generation using `gpt-5.6-sol`, strict Zod Structured Outputs, a second verification pass, deterministic retry protection, and safe job states.
- Typed local guitar diagram rendering plus `gpt-image-2` illustrations in private R2.
- Reveal-only, card-aware chat using `gpt-5.6-luna`, Vercel AI SDK streaming, immutable D1 card snapshots, explicit OpenAI context disclosure, and a saved Chats index/detail experience.
- Offline study queue, IndexedDB outbox, idempotent synchronization, and explicit private-cache clearing on sign-out or account change.
- Mobile bottom navigation, desktop workbench rail, keyboard ratings, reduced-motion support, and complete loading/empty/error/offline states.

The system boundaries and invariants are described in [ARCHITECTURE.md](./ARCHITECTURE.md). Production setup and exact Cloudflare permissions are in [DEPLOYMENT.md](./DEPLOYMENT.md). Security operations are in [SECURITY.md](./SECURITY.md).

## Local development

Requirements: Node 22 or newer and pnpm 11.13.1. A Cloudflare account is only needed for deployed resources.

```bash
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm run db:migrate:local
pnpm run cf-typegen
pnpm run dev
```

Development mode unregisters old service workers and clears Lorne Cache Storage so Vite never mixes stale PWA assets with a new React module graph. Production builds still include the complete offline worker. The browser suite explicitly opts into the development worker to exercise offline behavior.

Generate local secret values without placing them in shell history:

```bash
openssl rand -base64 48
openssl rand -base64 32
```

Paste the first result into `BETTER_AUTH_SECRET` and the second into `OPENAI_CREDENTIAL_ENCRYPTION_KEY_V1` in `.dev.vars`.

The beta gate requires an invited email and a one-time code when an account is created. Generate a local invite:

```bash
pnpm run invite:create -- you@example.com
```

The command prints the code once. Open Lorne, choose **Create account**, enter the invited email and code, and choose a username and a password of at least 12 characters. Future sign-ins use only the username and password. Signed-in users can change their password in Settings.

Do not place an OpenAI key in `.dev.vars`. Each signed-in user adds their own restricted project key in Settings. Password recovery email is deliberately not configured in v1, so a lost password requires operator intervention; configure a transactional-email reset flow before a broader public launch.

## Verification

```bash
pnpm run validate
pnpm audit --prod
pnpm run test:e2e
```

The local browser suite uses an installed Chrome; CI installs Playwright Chromium. No live OpenAI request runs in CI. A live credential, text
generation, and image generation check is a deliberate staging-only release step.

## Useful references

- [Cloudflare TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Better Auth installation](https://better-auth.com/docs/installation)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)

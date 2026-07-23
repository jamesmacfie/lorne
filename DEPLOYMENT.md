# Deployment

## 1. Cloudflare resources

Use separate resources for staging and production:

```bash
pnpm exec wrangler d1 create lorne-staging
pnpm exec wrangler d1 create lorne-production
pnpm exec wrangler r2 bucket create lorne-card-images-staging
pnpm exec wrangler r2 bucket create lorne-card-images-production
```

D1 bindings are declared by `database_name` only; Wrangler resolves the ID against your account at deploy time. Do not add `database_id` values (or any other account-specific identifiers) to `wrangler.jsonc` — the repository is public and its config must stay account-agnostic. The Workflow and rate-limit bindings are deployed with the Worker; R2 remains private. `CHAT_RATE_LIMITER` is configured independently in every environment for 10 sends per minute. Keep its namespace IDs distinct from generation and credential limiters.

The staging/production URLs in `wrangler.jsonc` are placeholders and must stay that way. The real origin is injected at deploy time: the `deploy:staging` and `deploy:production` scripts require a `BETTER_AUTH_URL` environment variable and pass it via `wrangler deploy --var`, refusing to run when it is unset. `BETTER_AUTH_URL` must exactly match the deployed origin (e.g. `https://<worker-name>.<account-subdomain>.workers.dev`, or the custom domain). Username/password authentication requires no OAuth client or external identity-provider configuration.

## 2. Secrets

Generate values locally, then paste them into Wrangler's interactive prompt. Do not put values in commands, CI logs, workflow YAML, or committed files.

```bash
openssl rand -base64 48
openssl rand -base64 32
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env staging
pnpm exec wrangler secret put OPENAI_CREDENTIAL_ENCRYPTION_KEY_V1 --env staging
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env production
pnpm exec wrangler secret put OPENAI_CREDENTIAL_ENCRYPTION_KEY_V1 --env production
```

Use independent secret values for staging and production. The encryption secret must decode to exactly 32 bytes.

## 3. Cloudflare API token permissions

Developers should use `wrangler login`; do not keep a long-lived account token on a workstation.

For CI, create one custom token restricted to the exact Cloudflare account and only the relevant zone. A pipeline that applies D1 migrations, deploys the Worker/Workflow, and manages R2 needs:

- Account — Workers Scripts: Write (the dashboard may label this Edit).
- Account — D1: Write/Edit.
- Account — Workers R2 Storage: Write/Edit.
- Zone — Workers Routes: Write/Edit only when Wrangler manages a custom-domain route.

Workflow deployment/lifecycle is covered by Workers Scripts Write. Do not grant Account Settings, Memberships, DNS Write, Access administration, Pages, KV, or unrelated storage scopes. Add read scopes only if an observed Wrangler operation requires one. The [Cloudflare API token permissions reference](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) is the source of truth for current dashboard labels.

GitHub Actions stores `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and the per-environment `BETTER_AUTH_URL` as repository secrets/variables — never in committed workflow YAML, since the repository is public and the deployed origin identifies the account. The running Worker receives no Cloudflare credentials; it uses scoped resource bindings.

## 4. Migrate and seed invites

Run migrations in order and back up/verify D1 Time Travel before any future destructive change:

```bash
pnpm exec wrangler d1 migrations apply lorne-staging --remote --env staging
pnpm exec wrangler d1 migrations apply lorne-production --remote --env production
```

Create invites with the repository helper:

```bash
pnpm run invite:create -- learner@example.com --env staging
pnpm run invite:create -- learner@example.com --env production
```

It creates a cryptographically random 192-bit code, stores only its SHA-256 digest, and displays the plaintext code once. Deliver the code separately and securely to the intended user. Reissuing an invite replaces the prior code. Never put invite codes or invite lists in committed files, tickets, or logs.

## 5. Release sequence

1. `pnpm install --frozen-lockfile`.
2. Run Gitleaks, route generation, binding type generation, format/lint (when configured), TypeScript, tests, build, and Wrangler dry run.
3. Verify `OPENAI_CHAT_MODEL=gpt-5.6-luna` and the environment-specific `CHAT_RATE_LIMITER`, then apply the additive/backward-compatible chat migration in staging before deploying the UI.
4. Deploy staging: `BETTER_AUTH_URL=https://<staging-origin> pnpm run deploy:staging`.
5. Smoke test invite-code account creation, resumable first-login onboarding and shell gating, username/password sign-in, reused/invalid invite rejection, credential validation, 30-card text generation, diagram/image generation, partial image failure, private assets, offline reload/review/reconnect, logout cache clearing, progress, reveal-only card chat, disclosure, Stop/Retry, saved chat index/detail/version behavior, and two-user IDOR cases. Use a restricted, spend-capped OpenAI project key.
6. Require approval through the protected GitHub `production` environment.
7. Verify D1 recovery readiness, apply production migrations, and run `BETTER_AUTH_URL=https://<production-origin> pnpm run deploy:production`.
8. Repeat the critical smoke checks and watch structured Workflow failures and ambiguous-provider-call counts.

Cloudflare deployment rollback can restore a prior Worker version. Database migrations are not rolled back by Worker rollback; keep schema changes additive until old and new Worker versions are both compatible. Use D1 Time Travel/recovery for data incidents, not as a routine down-migration mechanism.

## 6. Observability and alerts

Workers observability is enabled with source maps, full structured logs, and sampled traces. Configure dashboard alerts for:

- Workflow failures or `action_required` spikes.
- Any `provider_calls.status = 'ambiguous'` record.
- OpenAI 401/403/429 rates and image partial-completion rate.
- Card-chat failed/aborted/ambiguous rates, latency, aggregate input/output tokens, and stale-stream recovery.
- D1/R2 errors and review-sync rejection rate.
- Worker 5xx rate and latency.

Logs must remain metadata-only. Prompts, provider output, card bodies, authorization headers, and credential material are prohibited.

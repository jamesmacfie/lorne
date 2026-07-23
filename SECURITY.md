# Security operations

## Secrets and key material

Never commit `.dev.vars`, `.env*`, secret JSON, PEM/key files, Wrangler state, logs, database files, or provider responses. The ignore rules explicitly allow only the placeholder examples. CI runs Gitleaks before the build.

Worker secrets:

- `BETTER_AUTH_SECRET`
- `OPENAI_CREDENTIAL_ENCRYPTION_KEY_V1`

CI-only secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

There is deliberately no application-wide `OPENAI_API_KEY`.

## Credential rotation

1. Generate a new base64-encoded 32-byte key.
2. Add `OPENAI_CREDENTIAL_ENCRYPTION_KEY_V2` as a Worker secret and declaration.
3. Set `CREDENTIAL_KEY_ACTIVE_VERSION=2` and deploy.
4. Existing credentials are lazily decrypted with V1 and re-encrypted with V2 during use.
5. Query D1 until no row has `key_version=1`.
6. Remove V1 only after that count is zero and any rollback window has closed.

Never change the bytes behind an existing version number.

## OpenAI keys

Ask users to create a dedicated OpenAI project, set its spend and rate limits, and issue a restricted key with the equivalent of Models Read, Responses Write, and Images Write. Dashboard labels can change, so verify the endpoint permissions before beta rollout. Inputs used to make cards are sent through the user's OpenAI account with `store: false`. OpenAI API data is not used for training by default unless the account opts in; abuse-monitoring retention may still apply.

Plaintext key material may exist only inside the credential validation request and a billable Worker step. It must not appear in logs, exception messages, analytics, workflow input/result metadata, Cache Storage, IndexedDB, or client responses. Structured logs accept only pseudonymous IDs, state, safe code, duration, and aggregate usage.

## Web controls

- Hosted session cookies are HttpOnly, Secure, SameSite=Lax, expire after 30 days, and rotate at least daily.
- Better Auth hashes passwords and performs origin checks; Lorne also requires the canonical origin on every custom mutation.
- Sign-up requires both the invited email and a 192-bit one-time code. Only its SHA-256 digest is stored; accepted and revoked codes cannot create accounts.
- Username/password failures and invite failures use generic client messages to limit account and invite enumeration.
- Signed-in users can rotate their password and revoke their other sessions. V1 has no self-service forgotten-password email flow; this must be added before a public launch.
- CSP blocks third-party scripts, framing, arbitrary connections, and unexpected image/font sources.
- HSTS is enabled only for the production environment after the domain is expected to be valid.
- Every topic, card, job, review, credential, and asset query is scoped by the authenticated owner.
- Review bodies and server-function inputs have explicit Zod length/count limits.
- Cloudflare rate-limit bindings bound generation starts and credential changes; D1 constrains active jobs.
- Cached pages/assets and IndexedDB stores are cleared before sign-out and whenever the authenticated account changes. Shared devices remain a beta risk if a browser is force-closed without signing out; users should use OS/browser profiles on shared hardware.

## Release security checks

- Exercise topic/card/job/asset IDOR attempts with two real staging users.
- Reject missing or hostile `Origin` headers on review sync and server mutations.
- Confirm a captured log set contains no credential, authorization header, prompt, full card body, or provider response.
- Test malformed JSON, oversized batches, repeated event IDs, repeated generation idempotency keys, and both rate limits.
- Test invalid/reused invite codes, duplicate usernames, short passwords, and generic sign-in failures.
- Test OpenAI 401, 403, 404, 429, 5xx, timeout, refusal, malformed structured output, and partial image failure with mocks.
- Run `pnpm audit`, Gitleaks, automated dependency review, accessibility checks, and staging smoke tests before production approval.

Report a vulnerability privately to the repository owner; do not put credentials or exploit details in a public issue.

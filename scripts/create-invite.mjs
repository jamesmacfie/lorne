import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const email = args[0]?.trim().toLowerCase();
const envIndex = args.indexOf("--env");
const targetEnv = envIndex >= 0 ? args[envIndex + 1] : undefined;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  console.error("Usage: pnpm run invite:create -- learner@example.com [--env staging|production]");
  process.exit(1);
}

if (targetEnv && targetEnv !== "staging" && targetEnv !== "production") {
  console.error("The optional environment must be staging or production.");
  process.exit(1);
}

const inviteCode = randomBytes(24).toString("base64url");
const codeHash = createHash("sha256").update(inviteCode).digest("hex");
const inviteId = `invite_${randomUUID().replaceAll("-", "")}`;
const sql = [
  "INSERT INTO beta_invites (id,email,code_hash,status,created_at)",
  `VALUES ('${inviteId}','${email}','${codeHash}','pending',unixepoch()*1000)`,
  "ON CONFLICT(email) DO UPDATE SET",
  `code_hash='${codeHash}',status='pending',accepted_at=NULL,created_at=unixepoch()*1000`
].join(" ");

const wranglerArgs = ["exec", "wrangler", "d1", "execute", targetEnv ? `lorne-${targetEnv}` : "lorne-local"];
if (targetEnv) wranglerArgs.push("--remote", "--env", targetEnv);
else wranglerArgs.push("--local");
wranglerArgs.push("--command", sql);

const result = spawnSync("pnpm", wranglerArgs, { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`\nInvite created for ${email}`);
console.log(`One-time code: ${inviteCode}`);
console.log("Share this code securely. It is not stored and cannot be shown again.");

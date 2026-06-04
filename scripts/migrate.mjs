/**
 * Runs `prisma migrate deploy` using the direct (non-pooled) Neon connection.
 *
 * Neon's default DATABASE_URL goes through pgBouncer in transaction-pooling
 * mode, which drops session-level advisory locks between statements. Prisma's
 * migration advisory lock therefore never succeeds through the pooled URL.
 *
 * Fix: derive the direct URL by removing the "-pooler" suffix from the host,
 * then pass it as DATABASE_URL for the migration subprocess only. The app
 * continues to use the pooled URL at runtime.
 */
import { execSync } from "child_process";

const pooledUrl = process.env.DATABASE_URL ?? "";
if (!pooledUrl) {
  console.error("[migrate] DATABASE_URL is not set.");
  process.exit(1);
}

// Neon pooled URLs contain "-pooler" in the hostname, e.g.:
//   ep-xxx-pooler.us-east-2.aws.neon.tech  →  ep-xxx.us-east-2.aws.neon.tech
const directUrl = pooledUrl.replace(/-pooler\./, ".");
if (directUrl === pooledUrl) {
  console.log("[migrate] URL has no -pooler suffix — using as-is.");
} else {
  console.log("[migrate] Using direct (non-pooled) connection for migrations.");
}

try {
  execSync("prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: directUrl },
  });
} catch {
  console.error("[migrate] prisma migrate deploy failed.");
  process.exit(1);
}

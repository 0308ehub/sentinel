/**
 * Runs `prisma migrate deploy` with retries to handle Neon serverless
 * cold-start delays. Neon can take >10s to wake from cold, which causes
 * Prisma's advisory lock acquisition to time out. Retrying solves it.
 */
import { execSync } from "child_process";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 8000;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    execSync("prisma migrate deploy", { stdio: "inherit" });
    process.exit(0);
  } catch {
    console.error(`\n[migrate] Attempt ${attempt}/${MAX_ATTEMPTS} failed.`);
    if (attempt < MAX_ATTEMPTS) {
      console.error(`[migrate] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } else {
      console.error("[migrate] All attempts exhausted. Failing build.");
      process.exit(1);
    }
  }
}

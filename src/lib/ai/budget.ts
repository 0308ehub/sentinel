import "server-only";

import { headers } from "next/headers";
import postgres from "postgres";
import { autopilotConfigured, db } from "@/lib/autopilot/db";
import { currentUserId } from "@/lib/connections/current";
import { tryAutopilotUser } from "@/lib/autopilot/scope";
import {
  adjustCents,
  commitCharge,
  dayBucket,
  estimateCents,
  minuteBucket,
  releaseCharge,
  reserveCents,
  SPEND_GLOBAL_DAY,
  SPEND_MINUTE,
  SPEND_USER_DAY,
  spendLimits,
  type Ledger,
  type SpendLimits,
} from "@/lib/ai/budget-math";

type Sql = postgres.Sql;

export { commitCharge, estimateCents, releaseCharge, reserveCents, spendLimits } from "@/lib/ai/budget-math";
export type { Ledger, SpendLimits } from "@/lib/ai/budget-math";

export class BudgetError extends Error {
  constructor(
    message: string,
    readonly status = 429,
  ) {
    super(message);
  }
}

const PAUSED = "Model requests are paused until usage can be recorded.";

export interface AiHold {
  finish(outputChars: number): Promise<void>;
  cancel(): Promise<void>;
}

export async function beginAiCall(inputChars: number): Promise<AiHold> {
  const cents = reserveCents(inputChars);
  const user = await subject();
  const now = new Date();
  const day = dayBucket(now);
  const minute = minuteBucket(now);
  const limits = spendLimits();
  if (!autopilotConfigured()) return holdMemory({ user, day, minute, cents }, inputChars, limits);
  try {
    return await holdDatabase({ user, day, minute, cents }, inputChars, limits);
  } catch (error) {
    if (error instanceof BudgetError) throw error;
    if (process.env.NODE_ENV === "production") throw new BudgetError(PAUSED, 503);
    return holdMemory({ user, day, minute, cents }, inputChars, limits);
  }
}

const memory = new Map<string, Ledger>();
let tableReady: Promise<void> | null = null;

function holdMemory(
  input: { user: string; day: string; minute: string; cents: number },
  inputChars: number,
  limits: SpendLimits,
): AiHold {
  if (memory.size > 5000) memory.clear();
  const reason = commitCharge(memory, input, limits);
  if (reason) throw new BudgetError(reason, 429);
  let open = true;
  return {
    async finish(outputChars: number) {
      if (!open) return;
      open = false;
      const delta = estimateCents(inputChars, outputChars) - input.cents;
      if (delta === 0) return;
      adjustCents(memory, { user: input.user, day: input.day, cents: delta });
    },
    async cancel() {
      if (!open) return;
      open = false;
      releaseCharge(memory, input);
    },
  };
}

async function holdDatabase(
  input: { user: string; day: string; minute: string; cents: number },
  inputChars: number,
  limits: SpendLimits,
): Promise<AiHold> {
  const sql = await db();
  await ensureTable(sql);
  const userDay = await add(sql, input.day, input.user, input.cents, 1);
  const globalDay = await add(sql, input.day, "global", input.cents, 0);
  const minuteRow = await add(sql, input.minute, input.user, 0, 1);
  const reason =
    minuteRow.hits > limits.perMinute ? SPEND_MINUTE : userDay.cents > limits.userDaily ? SPEND_USER_DAY : globalDay.cents > limits.globalDaily ? SPEND_GLOBAL_DAY : null;
  if (reason) {
    await refund(sql, input);
    throw new BudgetError(reason, 429);
  }
  let open = true;
  return {
    async finish(outputChars: number) {
      if (!open) return;
      open = false;
      const delta = estimateCents(inputChars, outputChars) - input.cents;
      if (delta === 0) return;
      await adjust(sql, input.day, input.user, delta);
      await adjust(sql, input.day, "global", delta);
    },
    async cancel() {
      if (!open) return;
      open = false;
      await refund(sql, input);
    },
  };
}

async function subject(): Promise<string> {
  const scoped = tryAutopilotUser();
  if (scoped) return `user:${scoped}`.slice(0, 120);
  try {
    const id = await currentUserId();
    if (id) return `user:${id}`.slice(0, 120);
  } catch {
    // A background call with no request still has to be counted.
  }
  try {
    const header = await headers();
    const ip = header.get("x-forwarded-for")?.split(",")[0]?.trim() || header.get("x-real-ip")?.trim() || "";
    if (ip) return `ip:${ip.replace(/[^\w.:-]/g, "").slice(0, 64)}`;
  } catch {
    // No request headers, so this is a local job.
  }
  if (process.env.NODE_ENV === "production") throw new BudgetError("Sign in required.", 401);
  return "user:local";
}

async function ensureTable(sql: Sql) {
  tableReady ??= sql`
    create table if not exists kismet.ai_spend (
      bucket text not null,
      subject text not null,
      cents integer not null default 0,
      hits integer not null default 0,
      primary key (bucket, subject)
    )
  `.then(() => undefined);
  await tableReady;
}

async function add(sql: Sql, bucket: string, who: string, cents: number, hits: number): Promise<Ledger> {
  const rows = await sql<Ledger[]>`
    insert into kismet.ai_spend (bucket, subject, cents, hits)
    values (${bucket}, ${who}, ${cents}, ${hits})
    on conflict (bucket, subject) do update
    set cents = kismet.ai_spend.cents + ${cents},
        hits = kismet.ai_spend.hits + ${hits}
    returning cents, hits
  `;
  return rows[0] ?? { cents, hits };
}

async function refund(sql: Sql, input: { user: string; day: string; minute: string; cents: number }) {
  await adjust(sql, input.day, input.user, -input.cents, -1);
  await adjust(sql, input.day, "global", -input.cents, 0);
  await adjust(sql, input.minute, input.user, 0, -1);
}

async function adjust(sql: Sql, bucket: string, who: string, cents: number, hits = 0) {
  await sql`
    update kismet.ai_spend
    set cents = greatest(0, cents + ${cents}),
        hits = greatest(0, hits + ${hits})
    where bucket = ${bucket} and subject = ${who}
  `;
}

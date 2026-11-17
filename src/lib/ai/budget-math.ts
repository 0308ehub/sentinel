export interface SpendLimits {
  perMinute: number;
  userDaily: number;
  globalDaily: number;
}

export interface Ledger {
  cents: number;
  hits: number;
}

const INPUT_CENTS_PER_MILLION_TOKENS = 1000;
const OUTPUT_CENTS_PER_MILLION_TOKENS = 3000;
const OUTPUT_RESERVE_CHARS = 8_000;

export const SPEND_MINUTE = "Too many model requests. Wait a minute and try again.";
export const SPEND_USER_DAY = "This account hit its daily model budget. It resets tomorrow.";
export const SPEND_GLOBAL_DAY = "Kismet hit its daily model budget. It resets tomorrow.";

export function estimateCents(inputChars: number, outputChars: number): number {
  const inputTokens = Math.max(0, Math.ceil(inputChars / 4));
  const outputTokens = Math.max(0, Math.ceil(outputChars / 4));
  const cents =
    (inputTokens * INPUT_CENTS_PER_MILLION_TOKENS) / 1_000_000 +
    (outputTokens * OUTPUT_CENTS_PER_MILLION_TOKENS) / 1_000_000;
  return Math.max(1, Math.ceil(cents));
}

export function reserveCents(inputChars: number): number {
  return estimateCents(inputChars, OUTPUT_RESERVE_CHARS);
}

export function dayBucket(now = new Date()): string {
  return `day:${now.toISOString().slice(0, 10)}`;
}

export function minuteBucket(now = new Date()): string {
  return `min:${now.toISOString().slice(0, 16)}`;
}

export function spendLimits(env: NodeJS.ProcessEnv = process.env): SpendLimits {
  return {
    perMinute: positiveEnv(env, "KISMET_AI_PER_MINUTE", 20),
    userDaily: positiveEnv(env, "KISMET_AI_USER_DAILY_CENTS", 1000),
    globalDaily: positiveEnv(env, "KISMET_AI_DAILY_CENTS", 5000),
  };
}

/** Returns why the charge is refused, or null when the ledger accepted it. */
export function commitCharge(
  ledger: Map<string, Ledger>,
  input: { user: string; day: string; minute: string; cents: number },
  limits: SpendLimits,
): string | null {
  const userDay = read(ledger, input.day, input.user);
  const globalDay = read(ledger, input.day, "global");
  const minute = read(ledger, input.minute, input.user);
  if (minute.hits + 1 > limits.perMinute) return SPEND_MINUTE;
  if (userDay.cents + input.cents > limits.userDaily) return SPEND_USER_DAY;
  if (globalDay.cents + input.cents > limits.globalDaily) return SPEND_GLOBAL_DAY;
  write(ledger, input.day, input.user, { cents: userDay.cents + input.cents, hits: userDay.hits + 1 });
  write(ledger, input.day, "global", { cents: globalDay.cents + input.cents, hits: globalDay.hits });
  write(ledger, input.minute, input.user, { cents: minute.cents, hits: minute.hits + 1 });
  return null;
}

export function releaseCharge(
  ledger: Map<string, Ledger>,
  input: { user: string; day: string; minute: string; cents: number },
): void {
  const userDay = read(ledger, input.day, input.user);
  const globalDay = read(ledger, input.day, "global");
  const minute = read(ledger, input.minute, input.user);
  write(ledger, input.day, input.user, { cents: Math.max(0, userDay.cents - input.cents), hits: Math.max(0, userDay.hits - 1) });
  write(ledger, input.day, "global", { cents: Math.max(0, globalDay.cents - input.cents), hits: globalDay.hits });
  write(ledger, input.minute, input.user, { cents: minute.cents, hits: Math.max(0, minute.hits - 1) });
}

export function adjustCents(
  ledger: Map<string, Ledger>,
  input: { user: string; day: string; cents: number },
): void {
  const userDay = read(ledger, input.day, input.user);
  const globalDay = read(ledger, input.day, "global");
  write(ledger, input.day, input.user, { ...userDay, cents: Math.max(0, userDay.cents + input.cents) });
  write(ledger, input.day, "global", { ...globalDay, cents: Math.max(0, globalDay.cents + input.cents) });
}

function read(ledger: Map<string, Ledger>, bucket: string, subject: string): Ledger {
  return ledger.get(`${bucket}\n${subject}`) ?? { cents: 0, hits: 0 };
}

function write(ledger: Map<string, Ledger>, bucket: string, subject: string, row: Ledger): void {
  ledger.set(`${bucket}\n${subject}`, row);
}

function positiveEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const parsed = Number(env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

import "server-only";

import { db } from "@/lib/autopilot/db";
import { autopilotUser } from "@/lib/autopilot/scope";

export interface SampleDataRemoved {
  evidence: number;
  signals: number;
  experiments: number;
}

/** How much synthetic evidence the current account still holds. */
export async function sampleEvidenceCount(): Promise<number> {
  const sql = await db();
  const [row] = await sql`select count(*)::int as n from kismet.evidence where user_id = ${autopilotUser()} and synthetic`;
  return Number(row?.n ?? 0);
}

/**
 * Removes the current account's synthetic evidence and events, the problems no real evidence supports,
 * and experiments on those problems that never opened a pull request. Anything that reached GitHub stays.
 */
export async function removeSampleData(): Promise<SampleDataRemoved> {
  const sql = await db();
  const userId = autopilotUser();
  return sql.begin(async (tx) => {
    const unsupported = tx`
      select s.id from kismet.signals s
      where s.user_id = ${userId}
        and not exists (
          select 1 from kismet.evidence e where e.user_id = ${userId} and e.signal_id = s.id and not e.synthetic
        )
    `;
    const experiments = await tx`
      delete from kismet.experiments
      where user_id = ${userId} and pr_number is null and signal_id in (${unsupported})
      returning flag
    `;
    const flags = experiments.map((row) => String(row.flag));
    if (flags.length > 0) await tx`delete from kismet.flags where user_id = ${userId} and key in ${tx(flags)}`;
    const signals = await tx`
      delete from kismet.signals
      where user_id = ${userId} and id in (${unsupported})
        and not exists (select 1 from kismet.experiments x where x.user_id = ${userId} and x.signal_id = kismet.signals.id)
      returning id
    `;
    const evidence = await tx`delete from kismet.evidence where user_id = ${userId} and synthetic returning id`;
    await tx`delete from kismet.events where user_id = ${userId} and synthetic`;
    return { evidence: evidence.length, signals: signals.length, experiments: experiments.length };
  });
}

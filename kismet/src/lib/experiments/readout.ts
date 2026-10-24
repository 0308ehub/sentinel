import "server-only";

import { whereForSegment } from "@/lib/analytics/explore";
import { runDatabricksQuery } from "@/lib/databricks/client";
import {
  bucketRanges,
  shares,
  type ArmMeasure,
  type ExperimentAllocation,
  type ExperimentMetric,
  type ExperimentReadout,
} from "@/lib/experiments/allocation";
import { compareArms, decide, sampleMismatch } from "@/lib/experiments/stats";

const TRANSACTIONS = "samples.bakehouse.sales_transactions";

interface ArmRow {
  arm?: string | null;
  users?: string | null;
  converted?: string | null;
  orders?: string | null;
  revenue?: string | null;
  orders_sq?: string | null;
  revenue_sq?: string | null;
  aov_sum?: string | null;
  aov_sq?: string | null;
}

export async function runExperimentReadout(plan: ExperimentAllocation, names: { control: string }): Promise<ExperimentReadout> {
  const wheres = await Promise.all(plan.cohorts.map((cohort) => whereForSegment(cohort.filter)));
  const where = wheres.filter((clause) => clause && clause !== "1 = 1").join(" AND ") || "1 = 1";
  const ranges = bucketRanges(plan.rollout, plan.arms).filter((range) => range.end > range.start);
  const armCase =
    ranges.length === 0
      ? "'control'"
      : `CASE ${ranges
          .map((range) => `WHEN pmod(crc32(id), 10000) >= ${range.start} AND pmod(crc32(id), 10000) < ${range.end} THEN '${range.id}'`)
          .join(" ")} ELSE 'control' END`;

  const [bounds, grouped] = await Promise.all([
    runDatabricksQuery(`
      SELECT MIN(CAST(dateTime AS DATE)) AS start_day, MAX(CAST(dateTime AS DATE)) AS end_day
      FROM ${TRANSACTIONS}
      WHERE ${where}
    `),
    runDatabricksQuery(`
      WITH people AS (
        SELECT CAST(customerID AS STRING) AS id,
               COUNT(*) AS orders,
               COALESCE(SUM(totalPrice), 0) AS revenue
        FROM ${TRANSACTIONS}
        WHERE ${where}
        GROUP BY CAST(customerID AS STRING)
      ),
      labeled AS (
        SELECT *, ${armCase} AS arm FROM people
      )
      SELECT arm,
             COUNT(*) AS users,
             SUM(CASE WHEN orders >= 10 THEN 1 ELSE 0 END) AS converted,
             SUM(orders) AS orders,
             SUM(revenue) AS revenue,
             SUM(orders * orders) AS orders_sq,
             SUM(revenue * revenue) AS revenue_sq,
             SUM(revenue / orders) AS aov_sum,
             SUM(POWER(revenue / orders, 2)) AS aov_sq
      FROM labeled
      GROUP BY arm
    `),
  ]);

  const byId = new Map(grouped.rows.map((row) => [String((row as ArmRow).arm || ""), row as ArmRow]));
  const audience = [...byId.values()].reduce((sum, row) => sum + num(row.users), 0);
  const split = shares(plan.rollout, plan.arms);
  const control = measure("control", names.control || "Control", split, byId.get("control"), audience);
  const treatments = plan.arms.map((arm) => measure(arm.id, arm.name, split, byId.get(arm.id), audience));
  const arms = treatments.map((arm) => {
    const compared = compareArms(control, arm, plan.metric);
    return { ...arm, lift: compared.lift, pValue: compared.pValue, ciLow: compared.ciLow, ciHigh: compared.ciHigh };
  });
  const measured = [control, ...arms];
  const expected = new Map<string, number>();
  for (const range of ranges) expected.set(range.id, ((range.end - range.start) / 10000) * audience);
  const assigned = ranges.reduce((sum, range) => sum + (range.end - range.start), 0);
  expected.set("control", ((10000 - assigned) / 10000) * audience);
  const mismatch = sampleMismatch(measured.map((arm) => ({ users: arm.users, expected: expected.get(arm.id) ?? 0 })));
  const metrics: ExperimentMetric[] = ["conversion", "orders", "revenue", "aov"];
  const checks = metrics.map((metric) => {
    const decision = decide({ metric, audience, rollout: plan.rollout, control, treatments: arms, mismatch });
    return { metric, state: decision.state, summary: decision.summary, needed: decision.needed };
  });
  const decision = checks.find((check) => check.metric === plan.metric) ?? checks[0];

  return {
    startDay: day(bounds.rows[0]?.start_day),
    endDay: day(bounds.rows[0]?.end_day),
    audience,
    metric: plan.metric,
    arms: measured,
    checks: checks.map(({ metric, state }) => ({ metric, state })),
    state: decision.state,
    summary: decision.summary,
    needed: decision.needed,
  };
}

function measure(
  id: string,
  name: string,
  split: { id: string; percent: number }[],
  row: ArmRow | undefined,
  audience: number
): ArmMeasure {
  const users = num(row?.users);
  const orders = num(row?.orders);
  const revenue = num(row?.revenue);
  const percent = split.find((item) => item.id === id)?.percent ?? 0;
  return {
    id,
    name,
    percent,
    estimated: Math.round((audience * percent) / 100),
    users,
    converted: num(row?.converted),
    conversion: users > 0 ? num(row?.converted) / users : null,
    orders,
    revenue,
    ordersPerUser: users > 0 ? orders / users : null,
    revenuePerUser: users > 0 ? revenue / users : null,
    aov: users > 0 ? num(row?.aov_sum) / users : null,
    ordersSq: num(row?.orders_sq),
    revenueSq: num(row?.revenue_sq),
    aovSum: num(row?.aov_sum),
    aovSq: num(row?.aov_sq),
    lift: null,
    pValue: null,
    ciLow: null,
    ciHigh: null,
  };
}

function num(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function day(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

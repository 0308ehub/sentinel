import "server-only";

import { runDatabricksQuery } from "@/lib/databricks/client";
import { customerColumns } from "@/lib/analytics/audience";
import type {
  ExploreBar,
  ExploreFunnelStep,
  ExploreKind,
  ExploreMeasure,
  ExploreOptions,
  ExplorePoint,
  ExploreResult,
  ExploreSpec,
  FunnelStepInput,
  SegmentFilter,
} from "@/lib/analytics/explore-types";

const TRANSACTIONS = "samples.bakehouse.sales_transactions";
const NAME = /^[A-Za-z0-9][A-Za-z0-9 .'-]{0,80}$/;

const CUSTOMERS = "samples.bakehouse.sales_customers";

const MEASURE_SQL: Record<ExploreMeasure, string> = {
  uniques: "COUNT(DISTINCT customerID)",
  totals: "COUNT(*)",
  revenue: "COALESCE(SUM(totalPrice), 0)",
  aov: "CASE WHEN COUNT(*) = 0 THEN 0 ELSE SUM(totalPrice) / COUNT(*) END",
  frequency: "CASE WHEN COUNT(DISTINCT customerID) = 0 THEN 0 ELSE COUNT(*) * 1.0 / COUNT(DISTINCT customerID) END",
};

export async function loadExploreOptions(): Promise<ExploreOptions> {
  const [products, payments] = await Promise.all([
    runDatabricksQuery(`
      SELECT product AS name, MIN(CAST(dateTime AS DATE)) AS start_day, MAX(CAST(dateTime AS DATE)) AS end_day
      FROM ${TRANSACTIONS}
      GROUP BY product
      ORDER BY product
    `),
    runDatabricksQuery(`
      SELECT DISTINCT paymentMethod AS name
      FROM ${TRANSACTIONS}
      WHERE paymentMethod IS NOT NULL
      ORDER BY name
    `),
  ]);

  const startDay = products.rows.reduce((min, row) => {
    const day = dayOf(row.start_day);
    return day && (!min || day < min) ? day : min;
  }, "");
  const endDay = products.rows.reduce((max, row) => {
    const day = dayOf(row.end_day);
    return day && day > max ? day : max;
  }, "");

  return {
    products: products.rows.map((row) => row.name).filter((name): name is string => Boolean(name)),
    payments: payments.rows.map((row) => row.name).filter((name): name is string => Boolean(name)),
    startDay,
    endDay,
  };
}

export async function runExplore(spec: ExploreSpec, options: ExploreOptions): Promise<ExploreResult> {
  const clean = normalizeSpec(spec, options);
  if (clean.kind === "funnel") return runFunnel(clean);
  if (clean.kind === "bar") return runBar(clean);
  if (clean.kind === "metric") return runMetric(clean);
  return runLine(clean);
}

function normalizeSpec(spec: ExploreSpec, options: ExploreOptions): ExploreSpec {
  const products = new Set(options.products);
  const events = unique(spec.events.filter((event) => event === "*" || products.has(event))).slice(0, 8);
  const steps = (spec.steps ?? [])
    .map((step) => cleanStep(step, products))
    .filter((step): step is FunnelStepInput => Boolean(step))
    .slice(0, 6);
  return {
    kind: cleanKind(spec.kind),
    measure: cleanMeasure(spec.measure),
    events,
    lastDays: spec.lastDays === 3 || spec.lastDays === 7 ? spec.lastDays : null,
    breakdown: spec.breakdown === "payment" ? "payment" : "product",
    steps: steps.length >= 2 ? steps : [{ kind: "any" }, { kind: "any" }],
    withinDays: spec.withinDays === 1 || spec.withinDays === 7 ? spec.withinDays : null,
    segment: cleanSegment(spec.segment, options),
  };
}

async function runLine(spec: ExploreSpec): Promise<ExploreResult> {
  const named = spec.events.filter((event) => event !== "*");
  const allOrders = spec.events.length === 0 || spec.events.includes("*");
  const where = [
    dateSql(spec),
    named.length > 0 && !allOrders ? `product IN (${named.map(quoteLiteral).join(", ")})` : "",
    await segmentSql(spec.segment),
  ]
    .filter(Boolean)
    .join(" AND ");
  const eventSql = allOrders ? `'All orders'` : "product";
  const group = allOrders ? "1" : "1, 2";
  const result = await runDatabricksQuery(`
    SELECT CAST(dateTime AS DATE) AS day, ${eventSql} AS event, ${MEASURE_SQL[spec.measure]} AS value
    FROM ${TRANSACTIONS}
    WHERE ${where}
    GROUP BY ${group}
    ORDER BY day
  `);

  const seriesNames = allOrders ? ["All orders"] : named;
  const byDay = new Map<string, Record<string, number>>();
  for (const row of result.rows) {
    const day = dayOf(row.day);
    const name = row.event || "All orders";
    if (!day) continue;
    const values = byDay.get(day) ?? {};
    values[name] = num(row.value);
    byDay.set(day, values);
  }
  const points: ExplorePoint[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => {
      const filled: Record<string, number> = {};
      for (const name of seriesNames) filled[name] = values[name] ?? 0;
      return { day, values: filled };
    });

  return emptyResult(spec, points, [], [], seriesNames.map((name) => ({ name })));
}

async function runBar(spec: ExploreSpec): Promise<ExploreResult> {
  const named = spec.events.filter((event) => event !== "*");
  const column = spec.breakdown === "payment" ? "paymentMethod" : "product";
  const where = [
    dateSql(spec),
    named.length > 0 ? `product IN (${named.map(quoteLiteral).join(", ")})` : "",
    await segmentSql(spec.segment),
  ]
    .filter(Boolean)
    .join(" AND ");
  const result = await runDatabricksQuery(`
    SELECT ${column} AS label, ${MEASURE_SQL[spec.measure]} AS value
    FROM ${TRANSACTIONS}
    WHERE ${where} AND ${column} IS NOT NULL
    GROUP BY ${column}
    ORDER BY value DESC
    LIMIT 12
  `);
  const bars: ExploreBar[] = result.rows
    .filter((row) => row.label)
    .map((row) => ({ label: row.label as string, value: num(row.value) }));
  return emptyResult(
    spec,
    [],
    bars,
    [],
    bars.map((bar) => ({ name: bar.label }))
  );
}

async function runFunnel(spec: ExploreSpec): Promise<ExploreResult> {
  const steps = spec.steps;
  const ctes = [
    `tx AS (
      SELECT customerID, product, CAST(dateTime AS TIMESTAMP) AS ts
      FROM ${TRANSACTIONS}
      WHERE ${dateSql(spec)} AND ${await segmentSql(spec.segment)}
    )`,
  ];
  steps.forEach((step, index) => {
    if (index === 0) {
      ctes.push(`s0 AS (
        SELECT customerID, MIN(ts) AS ts
        FROM tx
        WHERE ${stepPredicate(step, "tx")}
        GROUP BY customerID
      )`);
      return;
    }
    const window =
      spec.withinDays == null ? "" : `AND t.ts <= p.ts + INTERVAL ${spec.withinDays} DAY`;
    ctes.push(`s${index} AS (
      SELECT t.customerID, MIN(t.ts) AS ts
      FROM tx t
      INNER JOIN s${index - 1} p ON t.customerID = p.customerID AND t.ts > p.ts ${window}
      WHERE ${stepPredicate(step, "t")}
      GROUP BY t.customerID
    )`);
  });
  const selects = steps.map((_, index) => `(SELECT COUNT(*) FROM s${index}) AS users_${index}`);
  for (let index = 1; index < steps.length; index++) {
    selects.push(`(
      SELECT percentile_approx(unix_timestamp(n.ts) - unix_timestamp(p.ts), 0.5)
      FROM s${index} n
      INNER JOIN s${index - 1} p ON n.customerID = p.customerID
    ) AS gap_${index}`);
  }
  const result = await runDatabricksQuery(`WITH ${ctes.join(",\n")} SELECT ${selects.join(", ")}`);
  const row = result.rows[0] ?? {};
  const first = num(row.users_0);
  const funnel: ExploreFunnelStep[] = steps.map((step, index) => {
    const users = num(row[`users_${index}`]);
    const previous = index === 0 ? users : num(row[`users_${index - 1}`]);
    return {
      name: step.kind === "any" ? "Any order" : step.product || "Product",
      users,
      conversion: first > 0 ? users / first : 0,
      fromPrior: index === 0 ? 1 : previous > 0 ? users / previous : 0,
      medianSeconds: index === 0 ? null : numOrNull(row[`gap_${index}`]),
    };
  });
  const last = funnel[funnel.length - 1];
  return emptyResult(
    spec,
    [],
    [],
    funnel,
    funnel.map((step) => ({ name: step.name })),
    first > 0 && last ? last.users / first : null
  );
}

function emptyResult(
  spec: ExploreSpec,
  points: ExplorePoint[],
  bars: ExploreBar[],
  steps: ExploreFunnelStep[],
  series: { name: string }[],
  totalConversion: number | null = null,
  metricValue: number | null = null,
  metricPrevious: number | null = null
): ExploreResult {
  const days = points.map((point) => point.day);
  return {
    kind: spec.kind,
    measure: spec.measure,
    startDay: days[0] ?? "",
    endDay: days[days.length - 1] ?? "",
    series,
    points,
    bars,
    steps,
    totalConversion,
    metricValue,
    metricPrevious,
  };
}

async function runMetric(spec: ExploreSpec): Promise<ExploreResult> {
  const named = spec.events.filter((event) => event !== "*");
  const eventSql = named.length > 0 ? `product IN (${named.map(quoteLiteral).join(", ")})` : "1 = 1";
  const segment = await segmentSql(spec.segment);
  const current = await runDatabricksQuery(`
    SELECT ${MEASURE_SQL[spec.measure]} AS value
    FROM ${TRANSACTIONS}
    WHERE ${dateSql(spec)} AND ${eventSql} AND ${segment}
  `);
  let previous: number | null = null;
  if (spec.lastDays != null) {
    const prior = await runDatabricksQuery(`
      WITH bounds AS (
        SELECT MAX(CAST(dateTime AS DATE)) AS last_day FROM ${TRANSACTIONS}
      )
      SELECT ${MEASURE_SQL[spec.measure]} AS value
      FROM ${TRANSACTIONS}
      CROSS JOIN bounds
      WHERE ${eventSql}
        AND ${segment}
        AND CAST(dateTime AS DATE) >= date_add(bounds.last_day, -${spec.lastDays * 2 - 1})
        AND CAST(dateTime AS DATE) < date_add(bounds.last_day, -${spec.lastDays - 1})
    `);
    previous = num(prior.rows[0]?.value);
  }
  return emptyResult(spec, [], [], [], [{ name: "Value" }], null, num(current.rows[0]?.value), previous);
}

const KINDS = new Set<ExploreKind>(["line", "area", "bar", "metric", "table", "funnel"]);
const MEASURES = new Set<ExploreMeasure>(["uniques", "totals", "revenue", "aov", "frequency"]);

function cleanKind(kind: ExploreKind): ExploreKind {
  return KINDS.has(kind) ? kind : "line";
}

function cleanMeasure(measure: ExploreMeasure): ExploreMeasure {
  return MEASURES.has(measure) ? measure : "uniques";
}

function cleanSegment(segment: SegmentFilter | null | undefined, options: ExploreOptions): SegmentFilter | null {
  if (!segment) return null;
  const product = segment.product && options.products.includes(segment.product) ? segment.product : null;
  const payment = segment.payment && options.payments.includes(segment.payment) ? segment.payment : null;
  const minOrders = Math.min(30, Math.max(1, Math.floor(Number(segment.minOrders) || 1)));
  const customerId = segment.customerId && NAME.test(segment.customerId) ? segment.customerId : null;
  const city = segment.city && NAME.test(segment.city) ? segment.city : null;
  const state = segment.state && NAME.test(segment.state) ? segment.state : null;
  if (!product && !payment && minOrders <= 1 && !customerId && !city && !state) return null;
  return { product, payment, minOrders, customerId, city, state };
}

export async function whereForSegment(filter: SegmentFilter | null | undefined): Promise<string> {
  const options = await loadExploreOptions();
  return segmentSql(cleanSegment(filter ?? null, options));
}

async function segmentSql(segment: SegmentFilter | null | undefined): Promise<string> {
  if (!segment) return "1 = 1";
  const clauses: string[] = [];
  if (segment.customerId) clauses.push(`CAST(customerID AS STRING) = ${quoteLiteral(segment.customerId)}`);
  if (segment.product || segment.payment || segment.minOrders > 1) {
    const filters = [
      segment.product ? `product = ${quoteLiteral(segment.product)}` : "",
      segment.payment ? `paymentMethod = ${quoteLiteral(segment.payment)}` : "",
    ].filter(Boolean);
    const having = segment.minOrders > 1 ? ` HAVING COUNT(*) >= ${segment.minOrders}` : "";
    clauses.push(
      `CAST(customerID AS STRING) IN (SELECT CAST(customerID AS STRING) FROM ${TRANSACTIONS}${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""} GROUP BY customerID${having})`
    );
  }
  const columns = await customerColumns();
  if (segment.city && columns.city) {
    clauses.push(
      `CAST(customerID AS STRING) IN (SELECT CAST(customerID AS STRING) FROM ${CUSTOMERS} WHERE ${columns.city} = ${quoteLiteral(segment.city)})`
    );
  }
  if (segment.state && columns.state) {
    clauses.push(
      `CAST(customerID AS STRING) IN (SELECT CAST(customerID AS STRING) FROM ${CUSTOMERS} WHERE ${columns.state} = ${quoteLiteral(segment.state)})`
    );
  }
  return clauses.length ? clauses.join(" AND ") : "1 = 1";
}

function dateSql(spec: ExploreSpec): string {
  return applyDateWindow(spec);
}

function stepPredicate(step: FunnelStepInput, alias: string): string {
  if (step.kind === "any") return "1 = 1";
  return `${alias}.product = ${quoteLiteral(step.product || "")}`;
}

function quoteLiteral(value: string): string {
  if (!NAME.test(value)) throw new Error(`Unexpected name: ${value}`);
  return `'${value.replace(/'/g, "''")}'`;
}

function cleanStep(step: FunnelStepInput, products: Set<string>): FunnelStepInput | null {
  if (step?.kind === "any") return { kind: "any" };
  if (step?.kind === "product" && step.product && products.has(step.product)) {
    return { kind: "product", product: step.product };
  }
  return null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function dayOf(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

function num(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function applyDateWindow(spec: ExploreSpec): string {
  if (spec.lastDays == null) return "1 = 1";
  const offset = spec.lastDays - 1;
  return `CAST(dateTime AS DATE) >= date_add((SELECT MAX(CAST(dateTime AS DATE)) FROM ${TRANSACTIONS}), -${offset})`;
}

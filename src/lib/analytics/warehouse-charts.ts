import "server-only";

import { runDatabricksQuery } from "@/lib/databricks/client";
import type { BarPoint, ChartPoint, FunnelStep, WarehouseCharts } from "@/lib/analytics/chart-types";

const TRANSACTIONS = "samples.bakehouse.sales_transactions";
const CUSTOMERS = "samples.bakehouse.sales_customers";

export type { WarehouseCharts };

export async function loadWarehouseCharts(): Promise<WarehouseCharts> {
  const [summary, growth, trend, bars, funnel] = await Promise.all([
    runDatabricksQuery(`
      SELECT
        COUNT(*) AS transactions,
        COUNT(DISTINCT customerID) AS customers,
        COUNT(DISTINCT product) AS products,
        SUM(totalPrice) AS revenue,
        MIN(CAST(dateTime AS DATE)) AS start_day,
        MAX(CAST(dateTime AS DATE)) AS end_day
      FROM ${TRANSACTIONS}
    `),
    runDatabricksQuery(`
      WITH bounds AS (
        SELECT MAX(CAST(dateTime AS DATE)) AS last_day
        FROM ${TRANSACTIONS}
      ),
      tagged AS (
        SELECT
          customerID,
          totalPrice,
          CASE
            WHEN CAST(dateTime AS DATE) > date_add(bounds.last_day, -7) THEN 'current'
            WHEN CAST(dateTime AS DATE) > date_add(bounds.last_day, -14) THEN 'previous'
          END AS bucket
        FROM ${TRANSACTIONS}
        CROSS JOIN bounds
      )
      SELECT
        COUNT(DISTINCT CASE WHEN bucket = 'current' THEN customerID END) AS customers_now,
        COUNT(DISTINCT CASE WHEN bucket = 'previous' THEN customerID END) AS customers_prev,
        COALESCE(SUM(CASE WHEN bucket = 'current' THEN totalPrice END), 0) AS revenue_now,
        COALESCE(SUM(CASE WHEN bucket = 'previous' THEN totalPrice END), 0) AS revenue_prev
      FROM tagged
    `),
    runDatabricksQuery(`
      SELECT
        CAST(dateTime AS DATE) AS day,
        COUNT(DISTINCT customerID) AS customers,
        SUM(totalPrice) AS revenue,
        COUNT(*) AS orders
      FROM ${TRANSACTIONS}
      GROUP BY CAST(dateTime AS DATE)
      ORDER BY day
    `),
    runDatabricksQuery(`
      SELECT product AS label, SUM(totalPrice) AS revenue, COUNT(*) AS orders
      FROM ${TRANSACTIONS}
      GROUP BY product
      ORDER BY revenue DESC
      LIMIT 8
    `),
    runDatabricksQuery(`
      WITH buyers AS (
        SELECT customerID, COUNT(*) AS orders
        FROM ${TRANSACTIONS}
        GROUP BY customerID
      )
      SELECT 'Customers' AS step, COUNT(*) AS users, 1 AS ord FROM ${CUSTOMERS}
      UNION ALL
      SELECT 'Ordered 5+ times', COUNT(*), 2 FROM buyers WHERE orders >= 5
      UNION ALL
      SELECT 'Ordered 10+ times', COUNT(*), 3 FROM buyers WHERE orders >= 10
      UNION ALL
      SELECT 'Ordered 15+ times', COUNT(*), 4 FROM buyers WHERE orders >= 15
      ORDER BY ord
    `),
  ]);

  const summaryRow = summary.rows[0] ?? {};
  const growthRow = growth.rows[0] ?? {};
  const startDay = dayOf(summaryRow.start_day);
  const endDay = dayOf(summaryRow.end_day);
  const sameMonth = startDay.slice(0, 7) !== "" && startDay.slice(0, 7) === endDay.slice(0, 7);
  const funnelRows = funnel.rows.map((row) => ({ step: row.step ?? "Step", users: num(row.users) }));
  const first = funnelRows[0]?.users ?? 0;

  return {
    source: TRANSACTIONS,
    startDay,
    endDay,
    customers: num(summaryRow.customers),
    transactions: num(summaryRow.transactions),
    revenue: num(summaryRow.revenue),
    products: num(summaryRow.products),
    growthLabel: "Last 7 days vs the 7 days before",
    momAvailable: !sameMonth,
    customersNow: num(growthRow.customers_now),
    customersPrev: num(growthRow.customers_prev),
    revenueNow: num(growthRow.revenue_now),
    revenuePrev: num(growthRow.revenue_prev),
    trend: trend.rows.map((row) => ({
      day: dayOf(row.day),
      customers: num(row.customers),
      revenue: num(row.revenue),
      orders: num(row.orders),
    })),
    bars: bars.rows.map((row) => ({
      label: row.label ?? "Unknown",
      revenue: num(row.revenue),
      orders: num(row.orders),
    })),
    funnel: funnelRows.map((step) => ({
      ...step,
      conversion: first > 0 ? step.users / first : 0,
    })),
  };
}

function num(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayOf(value: string | null | undefined): string {
  return (value ?? "").slice(0, 10);
}

import "server-only";

import type { Audience, AudienceCustomer } from "@/lib/analytics/library";
import { runDatabricksQuery } from "@/lib/databricks/client";

const CUSTOMERS = "samples.bakehouse.sales_customers";
const TRANSACTIONS = "samples.bakehouse.sales_transactions";
const SAFE = /^[A-Za-z0-9][A-Za-z0-9 .'_-]{0,80}$/;

export interface CustomerColumnMap {
  city: string | null;
  state: string | null;
  firstName: string | null;
  lastName: string | null;
}

const EMPTY_COLUMNS: CustomerColumnMap = { city: null, state: null, firstName: null, lastName: null };
let columnsCache: CustomerColumnMap | null = null;

function field(row: Record<string, string | null>, key: string): string {
  const found = Object.keys(row).find((item) => item.toLowerCase() === key);
  return found ? String(row[found] ?? "").trim() : "";
}

function ident(name: string): string | null {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : null;
}

export async function customerColumns(): Promise<CustomerColumnMap> {
  if (columnsCache) return columnsCache;
  try {
    const described = await runDatabricksQuery(`DESCRIBE TABLE ${CUSTOMERS}`);
    const names = described.rows.map((row) => field(row, "col_name")).filter((name) => name && !name.startsWith("#"));
    const find = (...candidates: string[]) => {
      const match = names.find((name) => candidates.includes(name.toLowerCase()));
      return match ? ident(match) : null;
    };
    columnsCache = {
      city: find("city"),
      state: find("state", "statecode", "state_code"),
      firstName: find("firstname", "first_name"),
      lastName: find("lastname", "last_name"),
    };
  } catch {
    columnsCache = EMPTY_COLUMNS;
  }
  return columnsCache;
}

export async function loadAudience(): Promise<Audience> {
  const columns = await customerColumns();
  const ranked = await runDatabricksQuery(`
    SELECT CAST(customerID AS STRING) AS id, COUNT(*) AS orders
    FROM ${TRANSACTIONS}
    GROUP BY customerID
    ORDER BY orders DESC
    LIMIT 60
  `);
  const customers: AudienceCustomer[] = ranked.rows
    .map((row) => ({
      id: String(row.id ?? ""),
      label: String(row.id ?? ""),
      orders: Number(row.orders ?? 0) || 0,
    }))
    .filter((customer) => SAFE.test(customer.id));

  if (columns.firstName && columns.lastName && customers.length > 0) {
    const ids = customers.map((customer) => `'${customer.id.replace(/'/g, "''")}'`).join(", ");
    try {
      const names = await runDatabricksQuery(`
        SELECT CAST(customerID AS STRING) AS id, ${columns.firstName} AS first_name, ${columns.lastName} AS last_name
        FROM ${CUSTOMERS}
        WHERE CAST(customerID AS STRING) IN (${ids})
      `);
      const byId = new Map(
        names.rows.map((row) => [String(row.id ?? ""), `${row.first_name ?? ""} ${row.last_name ?? ""}`.replace(/\s+/g, " ").trim()])
      );
      for (const customer of customers) {
        const name = byId.get(customer.id);
        if (name) customer.label = name;
      }
    } catch {
      // The customer id is enough to segment one person when names cannot be read.
    }
  }

  return {
    customers,
    cities: columns.city ? await distinctValues(columns.city) : [],
    states: columns.state ? await distinctValues(columns.state) : [],
  };
}

async function distinctValues(column: string): Promise<string[]> {
  const result = await runDatabricksQuery(`
    SELECT ${column} AS name, COUNT(*) AS n
    FROM ${CUSTOMERS}
    WHERE ${column} IS NOT NULL AND CAST(${column} AS STRING) <> ''
    GROUP BY ${column}
    ORDER BY n DESC
    LIMIT 40
  `);
  return result.rows.map((row) => String(row.name ?? "").trim()).filter((name) => SAFE.test(name));
}

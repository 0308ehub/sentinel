import { loadAudience } from "@/lib/analytics/audience";
import { loadExploreOptions } from "@/lib/analytics/explore";
import type { ExploreKind, ExploreMeasure, SegmentFilter } from "@/lib/analytics/explore-types";
import { askForJson, readJson } from "@/lib/ai/respond";
import { databricksErrorResponse } from "@/lib/databricks/client";

export const maxDuration = 60;

const MEASURES = new Set<ExploreMeasure>(["uniques", "totals", "revenue", "aov", "frequency"]);
const CHARTS = new Set<ExploreKind>(["line", "area", "bar", "metric", "table", "funnel"]);

interface DraftBody {
  name?: string;
  description?: string;
  product?: string | null;
  payment?: string | null;
  city?: string | null;
  state?: string | null;
  minOrders?: number;
  measure?: string;
  chart?: string;
}

export async function POST(request: Request) {
  let note = "";
  try {
    const body = (await request.json()) as { note?: string };
    note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  } catch {
    return Response.json({ error: "Send a short description." }, { status: 400 });
  }
  if (!note) return Response.json({ error: "Describe the segment or metric." }, { status: 400 });

  try {
    const [options, audience] = await Promise.all([loadExploreOptions(), loadAudience().catch(() => null)]);
    const products = options.products;
    const payments = options.payments;
    const cities = audience?.cities ?? [];
    const states = audience?.states ?? [];
    let parsed: DraftBody;
    try {
      const text = await askForJson(
        [
          "Turn one sentence into a product-analytics definition for the bakehouse sales table.",
          `Products: ${products.join(", ") || "none"}.`,
          `Payment methods: ${payments.join(", ") || "none"}.`,
          `Cities: ${cities.join(", ") || "none"}.`,
          `States: ${states.join(", ") || "none"}.`,
          "Return JSON only with keys name, description, product, payment, city, state, minOrders, measure, chart.",
          "product, payment, city, and state must be one of the listed values or null. Do not invent any of them.",
          "minOrders is an integer from 1 to 30. Use 1 when the sentence does not ask for a minimum.",
          "measure is one of uniques, totals, revenue, aov, frequency.",
          "chart is one of line, area, bar, metric, table.",
          "name is a short label. description is one sentence about what it counts.",
        ].join(" "),
        note,
        false,
        undefined,
        "feature-draft"
      );
      parsed = readJson<DraftBody>(text);
    } catch {
      parsed = heuristic(note, products, payments, cities, states);
    }
    const name = parsed.name?.trim().slice(0, 80);
    if (!name) return Response.json({ error: "The draft had no name." }, { status: 502 });
    const measure = MEASURES.has(parsed.measure as ExploreMeasure) ? (parsed.measure as ExploreMeasure) : guessMeasure(note);
    const chart = CHARTS.has(parsed.chart as ExploreKind) ? (parsed.chart as ExploreKind) : "line";
    const filter: SegmentFilter = {
      product: listed(parsed.product, products),
      payment: listed(parsed.payment, payments),
      minOrders: Math.min(30, Math.max(1, Math.floor(Number(parsed.minOrders) || guessMin(note)))),
      customerId: null,
      city: listed(parsed.city, cities),
      state: listed(parsed.state, states),
    };
    return Response.json({
      name,
      description: parsed.description?.trim().slice(0, 240) || note.slice(0, 240),
      filter,
      measure,
      chart: chart === "funnel" ? "line" : chart,
    });
  } catch (error) {
    return databricksErrorResponse(error);
  }
}

function listed(value: unknown, options: string[]): string | null {
  if (typeof value !== "string") return null;
  return options.find((option) => option.toLowerCase() === value.trim().toLowerCase()) ?? null;
}

function guessMeasure(note: string): ExploreMeasure {
  const text = note.toLowerCase();
  if (text.includes("average order") || text.includes("aov")) return "aov";
  if (text.includes("per customer") || text.includes("frequency")) return "frequency";
  if (text.includes("revenue") || text.includes("sales")) return "revenue";
  if (text.includes("order") || text.includes("event") || text.includes("total")) return "totals";
  return "uniques";
}

function guessMin(note: string): number {
  const match = note.match(/at least\s+(\d+)/i) ?? note.match(/(\d+)\s*\+/);
  const value = match ? Number(match[1]) : 1;
  return Number.isFinite(value) ? value : 1;
}

function heuristic(
  note: string,
  products: string[],
  payments: string[],
  cities: string[],
  states: string[]
): DraftBody {
  const text = note.toLowerCase();
  return {
    name: note.slice(0, 48),
    description: note.slice(0, 240),
    product: products.find((product) => text.includes(product.toLowerCase())) ?? null,
    payment: payments.find((payment) => text.includes(payment.toLowerCase())) ?? null,
    city: cities.find((city) => text.includes(city.toLowerCase())) ?? null,
    state: states.find((state) => text.includes(state.toLowerCase())) ?? null,
    minOrders: guessMin(note),
    measure: guessMeasure(note),
    chart: text.includes("bar") || text.includes("breakdown") ? "bar" : text.includes("number") ? "metric" : "line",
  };
}

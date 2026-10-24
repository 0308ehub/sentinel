import type { ExploreKind, ExploreMeasure, ExploreSpec, SegmentFilter } from "@/lib/analytics/explore-types";

export interface AudienceCustomer {
  id: string;
  label: string;
  orders: number;
}

export interface Audience {
  customers: AudienceCustomer[];
  cities: string[];
  states: string[];
}

export interface SavedSegment {
  id: string;
  name: string;
  description: string;
  filter: SegmentFilter;
}

export interface SavedMetric {
  id: string;
  name: string;
  description: string;
  measure: ExploreMeasure;
  events: string[];
  segmentId: string | null;
  filter: SegmentFilter | null;
  kind: ExploreKind;
}

export interface BoardCard {
  id: string;
  title: string;
  spec: ExploreSpec;
}

export interface SavedDashboard {
  id: string;
  name: string;
  shareToken: string | null;
  cards: BoardCard[];
}

export interface ShareBoard {
  v: 1;
  name: string;
  cards: { title: string; spec: ExploreSpec }[];
}

export function blankFilter(): SegmentFilter {
  return { product: null, payment: null, minOrders: 1, customerId: null, city: null, state: null };
}

export function filterLabel(filter: SegmentFilter | null | undefined): string {
  if (!filter) return "Everyone";
  const parts: string[] = [];
  if (filter.customerId) parts.push(`customer ${filter.customerId}`);
  if (filter.product) parts.push(`bought ${filter.product}`);
  if (filter.payment) parts.push(`paid with ${filter.payment}`);
  if (filter.minOrders > 1) parts.push(`at least ${filter.minOrders} orders`);
  if (filter.city) parts.push(filter.city);
  if (filter.state) parts.push(filter.state);
  return parts.length ? parts.join(" · ") : "Everyone";
}

export function specFromMetric(metric: SavedMetric, segments: SavedSegment[]): ExploreSpec {
  const linked = metric.segmentId ? segments.find((segment) => segment.id === metric.segmentId)?.filter : null;
  return {
    kind: metric.kind === "funnel" ? "line" : metric.kind,
    measure: metric.measure,
    events: metric.events,
    lastDays: null,
    breakdown: "product",
    steps: [{ kind: "any" }, { kind: "any" }],
    withinDays: null,
    segment: linked ?? metric.filter,
  };
}

export function encodeBoard(board: ShareBoard): string {
  const json = JSON.stringify(board);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeBoard(token: string): ShareBoard | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as ShareBoard;
    if (parsed?.v !== 1 || typeof parsed.name !== "string" || !Array.isArray(parsed.cards)) return null;
    const cards = parsed.cards
      .filter((card) => card && typeof card.title === "string" && card.spec && typeof card.spec === "object")
      .slice(0, 8)
      .map((card) => ({ title: card.title.slice(0, 80), spec: card.spec }));
    return { v: 1, name: parsed.name.slice(0, 80) || "Shared board", cards };
  } catch {
    return null;
  }
}

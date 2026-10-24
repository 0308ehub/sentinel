import type { ExploreKind, ExploreMeasure, ExploreSpec } from "@/lib/analytics/explore-types";

export function chartTitle(spec: ExploreSpec): string {
  if (spec.kind === "funnel") {
    return spec.steps.map((step) => (step.kind === "any" ? "Any order" : step.product)).join(" → ");
  }
  const measure = measureLabel(spec.measure);
  if (spec.kind === "bar") return `${measure} by ${spec.breakdown === "payment" ? "payment method" : "product"}`;
  if (spec.kind === "metric") return measure;
  if (spec.kind === "table") return `${measure} table`;
  return `${measure} over time`;
}

export function measureLabel(measure: ExploreMeasure): string {
  if (measure === "totals") return "Event totals";
  if (measure === "revenue") return "Revenue";
  if (measure === "aov") return "Average order value";
  if (measure === "frequency") return "Orders per customer";
  return "Uniques";
}

export function kindLabel(kind: ExploreKind): string {
  if (kind === "area") return "Area";
  if (kind === "bar") return "Bar";
  if (kind === "metric") return "Number";
  if (kind === "table") return "Table";
  if (kind === "funnel") return "Funnel";
  return "Line";
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export function formatValue(measure: ExploreMeasure, value: number): string {
  if (measure === "revenue" || measure === "aov") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: measure === "aov" ? 2 : 0,
    }).format(value);
  }
  if (measure === "frequency") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return formatCount(value);
}

export function formatAxis(measure: ExploreMeasure, value: number): string {
  if (measure === "revenue" || measure === "aov") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: measure === "aov" ? 1 : 0,
    }).format(value);
  }
  if (measure === "frequency") return value.toFixed(1);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value);
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function changeLabel(current: number, previous: number | null): string | null {
  if (previous == null) return null;
  if (previous === 0) return "No volume in the previous window";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}% vs the previous window`;
}

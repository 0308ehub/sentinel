export interface JourneyEvent {
  visitor: string;
  name: "view" | "click";
  page: string;
  element: string;
  at: string;
  firstAt: string;
  windowStart: string;
  visits: number;
}

/** Formats ordered event rows into compact, anonymized journey lines for an AI prompt. */
export function formatJourneys(events: JourneyEvent[], maxSteps = 25): string[] {
  const grouped = new Map<string, JourneyEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.visitor) ?? [];
    list.push(event);
    grouped.set(event.visitor, list);
  }
  return [...grouped.values()].map((rows, index) => {
    rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const first = rows[0];
    const isNew = Date.parse(first.firstAt) >= Date.parse(first.windowStart);
    const steps = rows.slice(0, maxSteps).map((event) =>
      event.name === "click" ? `clicked "${event.element || "unknown"}"` : event.page || "/",
    );
    return `visitor ${index + 1} (${isNew ? "new" : "returning"}, ${first.visits} ${first.visits === 1 ? "visit" : "visits"}): ${steps.join(" → ")}`;
  });
}

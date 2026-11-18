export interface PreferenceRating {
  rating: "good" | "not_useful";
  title: string;
  reason: string | null;
}

export function formatPreferences(ratings: PreferenceRating[]): string {
  return [
    ...(ratings.length ? ratings.map((item) => item.rating === "good"
      ? `liked: ${item.title}`
      : `not useful: ${item.title}${item.reason ? ` — ${item.reason}` : ""}`) : ["No preferences yet."]),
    "Lean toward what the person liked and away from what they marked not useful.",
  ].join("\n");
}

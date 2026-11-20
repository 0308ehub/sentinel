export interface PreferenceRating {
  rating: "good" | "not_useful";
  title: string;
  reason: string | null;
}

export function formatPreferences(ratings: PreferenceRating[]): string {
  const grouped: Array<PreferenceRating & { count: number }> = [];
  for (const item of ratings) {
    const found = grouped.find((row) => row.rating === item.rating && row.title === item.title);
    if (found) found.count += 1;
    else grouped.push({ ...item, count: 1 });
  }
  const lines = grouped.length
    ? grouped.map((item) => {
        const count = item.count > 1 ? ` (${item.count})` : "";
        return item.rating === "good"
          ? `liked: ${item.title}${count}`
          : `not useful: ${item.title}${count}${item.reason ? ` — ${item.reason}` : ""}`;
      })
    : ["No preferences yet."];
  return [...lines, "Lean toward what the team liked and away from what they marked not useful."].join("\n");
}

export function voteTally(
  ratings: Array<{ rating: "good" | "not_useful"; voterId: string }>,
  voterId: string,
): { good: number; notUseful: number; mine: "good" | "not_useful" | null } {
  let good = 0;
  let notUseful = 0;
  let mine: "good" | "not_useful" | null = null;
  for (const rating of ratings) {
    if (rating.rating === "good") good += 1;
    else notUseful += 1;
    if (rating.voterId === voterId) mine = rating.rating;
  }
  return { good, notUseful, mine };
}

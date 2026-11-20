export type PreviewSource = "account" | "sample";

export function previewSources({
  ready,
  isLive,
  hasLiveOrigin,
  hasRoutePage,
  when,
  kind,
  chosen,
}: {
  ready: boolean;
  isLive: boolean;
  hasLiveOrigin: boolean;
  hasRoutePage: boolean;
  when: string;
  kind: "test" | "change" | "fix";
  chosen: PreviewSource | null;
}) {
  const accountAvailable = isLive && hasLiveOrigin && hasRoutePage;
  const sampleAvailable = ready;
  const offerToggle = accountAvailable && sampleAvailable;
  const accountMode: "compare" | "single" = kind === "fix" && isLive ? "single" : "compare";

  if (chosen === "account" && accountAvailable) {
    return { accountAvailable, offerToggle, shown: "account" as const, accountMode };
  }
  if (chosen === "sample" && sampleAvailable) {
    return { accountAvailable, offerToggle, shown: "sample" as const, accountMode };
  }
  if (accountAvailable && !when.trim()) {
    return { accountAvailable, offerToggle, shown: "account" as const, accountMode };
  }
  if (sampleAvailable) {
    return { accountAvailable, offerToggle, shown: "sample" as const, accountMode };
  }
  if (accountAvailable) {
    return { accountAvailable, offerToggle, shown: "account" as const, accountMode };
  }
  return { accountAvailable, offerToggle, shown: "none" as const, accountMode };
}

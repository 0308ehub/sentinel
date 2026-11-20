export type PreviewVersion = "control" | "treatment";

export function previewSources({ ready }: { ready: boolean }) {
  return { shown: ready ? "sample" as const : "none" as const };
}

/** Sample frames only. Once a change is live, the shipped version is Current and the one it replaced is Old. */
export function previewVersions(isLive: boolean): { value: PreviewVersion; label: string }[] {
  if (isLive) {
    return [
      { value: "treatment", label: "Current" },
      { value: "control", label: "Old" },
    ];
  }
  return [
    { value: "control", label: "Current" },
    { value: "treatment", label: "New version" },
  ];
}

import "server-only";

/** The GitHub repository Autopilot ships experiments to. Kismet itself by default. */
export function autopilotRepo(): string {
  return process.env.AUTOPILOT_REPO?.trim() || "0308ehub/sentinel";
}

/** Dry run: Autopilot writes the change but never pushes, merges or closes anything on GitHub. */
export function autopilotDryRun(): boolean {
  return process.env.AUTOPILOT_DRY_RUN?.trim() === "1";
}

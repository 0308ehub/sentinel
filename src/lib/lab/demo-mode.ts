/**
 * The experiment-loop demo runs on a made-up company and simulated traffic, so it must never reach real users.
 * It appears in local development, or anywhere KISMET_DEMO=1 is set on purpose.
 */
export function labDemoEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.KISMET_DEMO === "1";
}

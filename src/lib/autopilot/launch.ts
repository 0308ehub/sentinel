export interface LaunchCheck {
  ok: boolean;
  label: string;
}

export function launchChecks(input: {
  kind: "experiment" | "test" | "change" | "fix";
  mode: "deterministic" | "stochastic";
  hypothesis: string;
  metric: string;
  guardrail: string;
  control: string;
  treatment: string;
  page: string;
  estimateDays: number | null;
  maxDays: number;
  evidenceCount: number;
  sourceCount: number;
}): LaunchCheck[] {
  if (input.kind === "fix") {
    return [{ ok: input.treatment.trim().length >= 8, label: "The correction is specific enough to ship to everyone." }];
  }
  if (input.kind === "change") {
    return [
      { ok: input.treatment.trim().length >= 8, label: "The change is specific enough to ship to everyone." },
      { ok: input.metric.trim().length >= 3, label: "There is an outcome to check before and after the change." },
      { ok: input.page.trim().startsWith("/"), label: "It names the page the change appears on." },
    ];
  }
  const personWroteIt = input.evidenceCount === 0;
  const days = input.estimateDays;
  const finishes = days != null && Number.isFinite(days) && days > 0 && days <= input.maxDays;
  const checks: LaunchCheck[] = [
    {
      ok: input.hypothesis.trim().length >= 24 && input.control.trim().length >= 8 && input.treatment.trim().length >= 8 && input.control.trim().toLowerCase() !== input.treatment.trim().toLowerCase(),
      label: "It says what changes, what stays the same, and why that would move the outcome.",
    },
    {
      ok: input.metric.trim().length >= 3,
      label: "The metric is something both versions can do, so the test is not rigged.",
    },
    {
      ok: input.guardrail.trim().length >= 8,
      label: "A guardrail says what would make Kismet stop the test.",
    },
    {
      ok: input.page.trim().startsWith("/"),
      label: "It names the page the change appears on.",
    },
    {
      ok: finishes,
      label: finishes
        ? `It can reach a result in about ${Math.ceil(days)} days, inside the ${input.maxDays}-day limit.`
        : `It cannot reach a result within ${input.maxDays} days on the traffic this metric has.`,
    },
    personWroteIt
      ? { ok: true, label: "You wrote this test. Kismet is not waiting on tickets or Slack." }
      : {
          ok: input.evidenceCount >= 5 && input.sourceCount >= 2,
          label: "At least five separate observations, from two sources, support the problem.",
        },
  ];
  if (input.mode === "stochastic") {
    checks.push({
      ok: input.metric.trim().length >= 3,
      label: "The output can differ on every request, so Kismet scores what visitors do and waits for twice the usual traffic.",
    });
  }
  return checks;
}

export function canLaunch(checks: LaunchCheck[]): boolean {
  return checks.every((check) => check.ok);
}

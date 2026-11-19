export interface SetupState {
  slack: boolean;
  repo: boolean;
  agent: boolean;
  firstRun: boolean;
}

export interface SetupStep {
  key: keyof SetupState;
  done: boolean;
}

export function setupSteps(setup: SetupState): SetupStep[] {
  return (["slack", "repo", "agent", "firstRun"] as const).map((key) => ({ key, done: setup[key] }));
}

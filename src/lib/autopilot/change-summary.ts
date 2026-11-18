export interface ChangeFile {
  filename: string;
  patch?: string;
}

export interface SummaryExperiment {
  control: string;
  treatment: string;
  page: string;
}

export interface ChangeSummary {
  kind: "ui" | "behavior";
  before: string;
  after: string;
  where: string;
  when: string;
  at: string;
}

export function patchDigest(files: ChangeFile[], limit: number): string {
  const max = Math.max(0, Math.floor(limit));
  let result = "";
  for (const file of files) {
    const part = `FILE: ${file.filename}\n${file.patch ?? "(patch unavailable)"}\n`;
    if (result.length + part.length <= max) result += part;
    else {
      result += part.slice(0, Math.max(0, max - result.length));
      break;
    }
  }
  return result;
}

export function fallbackSummary(experiment: SummaryExperiment, files: ChangeFile[]): ChangeSummary {
  const ui = files.some((file) => /\.(?:tsx|jsx|css|html)$/i.test(file.filename));
  return {
    kind: ui ? "ui" : "behavior",
    before: experiment.control,
    after: experiment.treatment,
    where: experiment.page,
    when: "",
    at: new Date().toISOString(),
  };
}

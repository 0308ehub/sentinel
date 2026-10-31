"use client";
import { useLabStore } from "@/lib/lab/store";
import { LabExperimentView } from "./experiment-detail";
import { ExperimentDetail } from "@/components/work/experiment-detail";
export function ExperimentRouter({ id }: { id: string }) {
  const state = useLabStore();
  return state.experiments.some((e) => e.id === id) ? <LabExperimentView id={id} /> : <ExperimentDetail />;
}

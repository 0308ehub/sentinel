"use client";

import { createContext, useContext } from "react";
import type { Arm } from "@/lib/autopilot/assign";

export interface ExperimentContextValue {
  visitor: string;
  arms: Record<string, Arm>;
}

export const ExperimentContext = createContext<ExperimentContextValue>({ visitor: "", arms: {} });

/**
 * Which version of an Autopilot experiment this visitor sees. Experiment code shipped by Autopilot
 * renders the new version only when this returns "treatment"; until the experiment starts, everyone
 * gets "control".
 */
export function useVariant(flag: string): Arm {
  return useContext(ExperimentContext).arms[flag] ?? "control";
}

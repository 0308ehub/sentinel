"use client";

import { createContext, useContext } from "react";
import type { Arm } from "@/lib/autopilot/assign";

export interface ExperimentContextValue {
  visitor: string;
  arms: Record<string, Arm>;
  track: (name: string) => void;
}

export const ExperimentContext = createContext<ExperimentContextValue>({ visitor: "", arms: {}, track: () => {} });

/** Reports a business event, such as a purchase or a sign-up, that an experiment can be measured by. */
export function useTrack(): (name: string) => void {
  return useContext(ExperimentContext).track;
}

/**
 * Which version of an Autopilot experiment this visitor sees. Experiment code shipped by Autopilot
 * renders the new version only when this returns "treatment"; until the experiment starts, everyone
 * gets "control".
 */
export function useVariant(flag: string): Arm {
  return useContext(ExperimentContext).arms[flag] ?? "control";
}

"use client";

import { useEffect } from "react";
import { startAgentMotion } from "@/lib/agents/fleet";

export function AgentRunner() {
  useEffect(() => startAgentMotion(), []);
  return null;
}

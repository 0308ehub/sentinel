"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface ProgressStep {
  text: string;
  done: boolean;
}

export function ProgressStream({
  steps,
  className,
}: {
  steps: ProgressStep[];
  className?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-2", className)}>
      {steps.map((step, i) => {
        const isActive = !step.done && i === steps.findLastIndex((s) => !s.done || i === steps.length - 1);
        const isLast = i === steps.length - 1;
        return (
          <div key={i} className="flex items-center gap-2.5 text-xs">
            {step.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : isLast ? (
              <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />
            )}
            <span className={cn(
              step.done ? "text-gray-400 line-through" : isLast ? "text-gray-700 font-medium" : "text-gray-400"
            )}>
              {step.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

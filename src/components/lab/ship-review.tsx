"use client";

import { useState } from "react";
import { Check, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { LabExperiment } from "@/lib/lab/advance";
import { approveShip, requestChanges } from "@/lib/lab/store";
import { CodeDiff } from "./code-diff";

export function ShipReview({ experiment }: { experiment: LabExperiment }) {
  const [note, setNote] = useState("");
  const ship = experiment.ship;
  if (!ship) return null;
  return (
    <div className="mt-6 min-w-0 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <GitMerge className="h-4 w-4 text-primary" />
        <b className="text-sm">{ship.diff.title}</b>
      </div>
      <p className="mt-1 break-words text-xs text-muted-foreground">
        kismet/{experiment.id} · {ship.diff.file} · Reviewer: You
      </p>
      <CodeDiff before={ship.diff.before} after={ship.diff.after} />
      <div className="mt-3 space-y-1">
        {ship.diff.checks.map((check) => (
          <p key={check} className="flex items-center gap-1 text-xs text-success">
            <Check className="h-3 w-3" />
            {check}
          </p>
        ))}
      </div>
      {ship.status === "merged" ? (
        <p className="mt-4 rounded-md bg-success/10 p-3 text-sm font-semibold text-success">
          Shipped to production on day {experiment.stopDay}. The winner is live and the flag is gone.
        </p>
      ) : (
        <>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-4"
            placeholder="What should change?"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => approveShip(experiment.id)}>
              Approve & merge
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!note.trim()}
              onClick={() => requestChanges(experiment.id, note)}
            >
              Request changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

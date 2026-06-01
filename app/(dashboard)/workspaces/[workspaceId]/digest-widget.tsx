"use client";

import { useState } from "react";
import { Bot, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface DigestAction {
  id: string;
  result: { digest?: string; generatedAt?: string } | null;
  createdAt: string | Date;
}

interface Props {
  workspaceId: string;
  lastDigestAction: DigestAction | null;
}

export function DigestWidget({ workspaceId, lastDigestAction }: Props) {
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [currentDigest, setCurrentDigest] = useState<DigestAction | null>(lastDigestAction);

  const digestText = currentDigest?.result?.digest;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sentinel/digest`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Digest queued — it will appear here shortly");

      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(`/api/workspaces/${workspaceId}/sentinel/digest`);
      if (poll.ok) {
        const data = await poll.json();
        if (data.data?.action?.result?.digest) {
          setCurrentDigest(data.data.action);
          setExpanded(true);
        }
      }
    } catch {
      toast.error("Failed to generate digest");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Weekly PM Digest</p>
            {currentDigest && (
              <p className="text-[10px] text-gray-400">
                Generated {formatDate(currentDigest.createdAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {digestText && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs gap-1.5 h-7"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {digestText ? "Regenerate" : "Generate Digest"}
          </Button>
        </div>
      </div>

      {digestText && expanded && (
        <div className="px-5 py-4">
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {digestText}
          </div>
        </div>
      )}

      {!digestText && !generating && (
        <div className="px-5 py-4 text-center">
          <p className="text-xs text-gray-400">No digest yet. Generate one to get a weekly PM summary of your workspace.</p>
        </div>
      )}

      {generating && (
        <div className="px-5 py-4 flex items-center gap-2 text-xs text-violet-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Sentinel is generating your digest…
        </div>
      )}
    </section>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Channel {
  id: string;
  name: string;
}

export function SlackChannelSetup({
  connectorId,
  workspaceId,
}: {
  connectorId: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/connectors/${connectorId}/channels`
        );
        const data = await res.json();
        if (!data.ok) throw new Error(data.error?.message ?? "Failed to load channels");
        setChannels(data.data.channels);
        // Pre-select any already-saved channels
        setSelectedIds(new Set(data.data.selectedIds as string[]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load channels");
      } finally {
        setLoading(false);
      }
    })();
  }, [connectorId, workspaceId]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (selectedIds.size === 0) {
      setError("Select at least one channel.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/connectors/${connectorId}/channels`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelIds: Array.from(selectedIds) }),
        }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Failed to save");
      setDone(true);
      // Auto-trigger first sync
      await fetch(`/api/workspaces/${workspaceId}/connectors/${connectorId}/sync`, {
        method: "POST",
      });
      setTimeout(() => {
        router.push(`/workspaces/${workspaceId}/integrations`);
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mb-8 bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Slack connected!</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Importing messages from {selectedIds.size} channel{selectedIds.size !== 1 ? "s" : ""}…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 bg-purple-50 border border-purple-200 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl leading-none mt-0.5">💬</span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Choose Slack channels to import</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Select the channels Sentinel should pull messages from. You can change this later.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading channels…
        </div>
      ) : error && channels.length === 0 ? (
        <p className="text-sm text-red-600 py-2">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1 mb-4">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => toggle(ch.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-left transition-all border ${
                  selectedIds.has(ch.id)
                    ? "bg-purple-100 border-purple-300 text-purple-800 font-medium"
                    : "bg-white border-gray-200 text-gray-600 hover:border-purple-200 hover:text-purple-700"
                }`}
              >
                <Hash className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || selectedIds.size === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4"
            >
              {saving ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Saving…</>
              ) : (
                `Confirm ${selectedIds.size > 0 ? `(${selectedIds.size} channel${selectedIds.size !== 1 ? "s" : ""})` : "selection"}`
              )}
            </Button>
            <button
              onClick={() => router.push(`/workspaces/${workspaceId}/integrations`)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </>
      )}
    </div>
  );
}

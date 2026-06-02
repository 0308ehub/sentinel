"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import {
  Bot, CheckCircle2, XCircle, Clock, Zap, RefreshCw, Loader2,
  Mail, Brain, Target, Ticket, ExternalLink, Settings, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type ActionStatus = "PENDING_REVIEW" | "APPROVED" | "EXECUTING" | "COMPLETED" | "REJECTED" | "FAILED";
type ActionType = "SCAN_CONNECTOR" | "IMPORT_DOCUMENTS" | "SYNTHESIZE_WORKSPACE" | "GENERATE_OPPORTUNITIES" | "GENERATE_TICKETS" | "PUSH_TO_LINEAR" | "SYNC_LINEAR_STATUS" | "GENERATE_DIGEST";

interface SentinelAction {
  id: string;
  type: ActionType;
  status: ActionStatus;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  triggeredBy: string;
  createdAt: Date;
  reviewedAt: Date | null;
}

interface WorkspaceSettings {
  autoSynthesizeOnIngest: boolean;
  autoImportHighScore: boolean;
  autoPushToLinear: boolean;
}

interface Props {
  workspaceId: string;
  initialActions: SentinelAction[];
  settings: WorkspaceSettings | null;
}

const TYPE_ICONS: Record<ActionType, React.ElementType> = {
  SCAN_CONNECTOR: RefreshCw,
  IMPORT_DOCUMENTS: Mail,
  SYNTHESIZE_WORKSPACE: Brain,
  GENERATE_OPPORTUNITIES: Target,
  GENERATE_TICKETS: Ticket,
  PUSH_TO_LINEAR: ExternalLink,
  SYNC_LINEAR_STATUS: RefreshCw,
  GENERATE_DIGEST: Bot,
};

const STATUS_CONFIG: Record<ActionStatus, { label: string; icon: React.ElementType; cls: string }> = {
  PENDING_REVIEW: { label: "Needs Review",  icon: Clock,         cls: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:       { label: "Approved",      icon: CheckCircle2,  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  EXECUTING:      { label: "Running",       icon: Loader2,       cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  COMPLETED:      { label: "Done",          icon: CheckCircle2,  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED:       { label: "Rejected",      icon: XCircle,       cls: "bg-gray-50 text-gray-400 border-gray-200" },
  FAILED:         { label: "Failed",        icon: XCircle,       cls: "bg-red-50 text-red-700 border-red-200" },
};

function ActionCard({
  action,
  onDecision,
}: {
  action: SentinelAction;
  onDecision: (id: string, decision: "approve" | "reject") => Promise<void>;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const Icon = TYPE_ICONS[action.type] ?? Bot;
  const { label, icon: StatusIcon, cls } = STATUS_CONFIG[action.status];
  const isPending = action.status === "PENDING_REVIEW";
  const preview = action.payload.preview as Array<{ subject: string; from: string; score: number }> | undefined;
  const result = action.result as Record<string, unknown> | null;

  async function handle(decision: "approve" | "reject") {
    setLoading(decision);
    try {
      await onDecision(action.id, decision);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={cn("bg-white border rounded-xl p-4 transition-all", isPending ? "border-amber-200 shadow-sm" : "border-gray-200")}>
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isPending ? "bg-indigo-50" : "bg-gray-50")}>
          <Icon className={cn("h-4 w-4", isPending ? "text-indigo-600" : "text-gray-400")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{action.title}</p>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1", cls)}>
              <StatusIcon className={cn("h-2.5 w-2.5", action.status === "EXECUTING" && "animate-spin")} />
              {label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>

          {/* Email preview */}
          {preview && preview.length > 0 && (
            <div className="mt-2 space-y-1">
              {preview.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", p.score >= 0.7 ? "bg-emerald-400" : p.score >= 0.5 ? "bg-amber-400" : "bg-gray-300")} />
                  <span className="truncate text-gray-700 font-medium">{p.subject}</span>
                  <span className="text-gray-400 shrink-0">{Math.round(p.score * 100)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {result && action.status === "COMPLETED" && (
            <p className="text-xs text-emerald-600 mt-1.5 font-medium">
              ✓ {Object.entries(result).map(([k, v]) => `${v} ${k}`).join(" · ")}
            </p>
          )}
          {result && action.status === "FAILED" && (
            <p className="text-xs text-red-500 mt-1.5">{String((result as Record<string, unknown>).error ?? "Unknown error")}</p>
          )}

          <p className="text-[10px] text-gray-400 mt-1.5">
            Triggered by {action.triggeredBy} · {formatDate(action.createdAt)}
          </p>
        </div>
      </div>

      {isPending && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 h-7"
            onClick={() => handle("approve")}
            disabled={!!loading}
          >
            {loading === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Approve & Run
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => handle("reject")}
            disabled={!!loading}
          >
            {loading === "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Dismiss"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ToggleSetting({
  label, description, value, onToggle,
}: {
  label: string; description: string; value: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <button onClick={onToggle} className="shrink-0">
        {value
          ? <ToggleRight className="h-6 w-6 text-indigo-600" />
          : <ToggleLeft className="h-6 w-6 text-gray-300" />}
      </button>
    </div>
  );
}

export function InboxClient({ workspaceId, initialActions, settings: initialSettings }: Props) {
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [settings, setSettings] = useState<WorkspaceSettings>(
    initialSettings ?? { autoSynthesizeOnIngest: false, autoImportHighScore: false, autoPushToLinear: false }
  );
  const [tab, setTab] = useState<"inbox" | "activity" | "settings">("inbox");

  const pendingActions = actions.filter((a) => a.status === "PENDING_REVIEW");
  const completedActions = actions.filter((a) => ["COMPLETED", "REJECTED", "FAILED"].includes(a.status));

  const handleDecision = useCallback(async (actionId: string, decision: "approve" | "reject") => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/sentinel/actions/${actionId}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) }
      );
      if (!res.ok) throw new Error();
      toast.success(decision === "approve" ? "Action approved — executing now" : "Dismissed");
      router.refresh();
      setActions((prev) => prev.map((a) =>
        a.id === actionId ? { ...a, status: decision === "approve" ? "EXECUTING" : "REJECTED" } : a
      ));
    } catch {
      toast.error("Failed to process decision");
    }
  }, [workspaceId, router]);

  const toggleSetting = useCallback(async (key: keyof WorkspaceSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    await fetch(`/api/workspaces/${workspaceId}/sentinel/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
  }, [settings, workspaceId]);

  const triggerScan = async () => {
    toast.loading("Scanning connectors…", { id: "scan" });
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sentinel/scan`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Scan complete — check inbox for new items", { id: "scan" });
      router.refresh();
    } catch {
      toast.error("Scan failed", { id: "scan" });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-0 shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Sentinel Inbox</h1>
              {pendingActions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {pendingActions.length} pending
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              Review and approve actions queued by your autonomous PM
            </p>
          </div>
          <Button onClick={triggerScan} variant="outline" size="sm" className="gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Scan Now
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {(["inbox", "activity", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px capitalize transition-colors",
                tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {t}
              {t === "inbox" && pendingActions.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                  {pendingActions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Inbox tab */}
        {tab === "inbox" && (
          <div className="space-y-3 max-w-2xl">
            {pendingActions.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-7 w-7 text-indigo-300" />
                </div>
                <p className="font-semibold text-gray-700">All caught up</p>
                <p className="text-sm text-gray-400 mt-1">Sentinel has no pending actions. Click "Scan Now" to check connectors.</p>
              </div>
            ) : (
              pendingActions.map((action) => (
                <ActionCard key={action.id} action={action} onDecision={handleDecision} />
              ))
            )}
          </div>
        )}

        {/* Activity tab */}
        {tab === "activity" && (
          <div className="space-y-3 max-w-2xl">
            {completedActions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">No activity yet.</p>
            ) : (
              completedActions.map((action) => (
                <ActionCard key={action.id} action={action} onDecision={handleDecision} />
              ))
            )}
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="max-w-lg">
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-gray-800">Automation Settings</h2>
              </div>
              <ToggleSetting
                label="Auto-synthesize after ingestion"
                description="Immediately re-synthesize insights when new documents finish processing"
                value={settings.autoSynthesizeOnIngest}
                onToggle={() => toggleSetting("autoSynthesizeOnIngest")}
              />
              <ToggleSetting
                label="Auto-import high-relevance emails"
                description="Automatically approve and import emails scored ≥70% relevance (skip review)"
                value={settings.autoImportHighScore}
                onToggle={() => toggleSetting("autoImportHighScore")}
              />
              <ToggleSetting
                label="Auto-push tickets to Linear"
                description="Automatically push generated tickets to Linear without approval"
                value={settings.autoPushToLinear}
                onToggle={() => toggleSetting("autoPushToLinear")}
              />
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-700 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5"><Zap className="h-3 w-3" /> How the autonomous loop works</p>
              <ol className="space-y-1 list-decimal list-inside text-indigo-600">
                <li>Hourly: Sentinel scans connected Gmail/Slack for new relevant content</li>
                <li>Found content appears here as "Import" action for your review</li>
                <li>Approve → content is imported and processed automatically</li>
                <li>Every 6h: Synthesis runs if new documents are available</li>
                <li>Synthesis queues ticket generation from top opportunities</li>
                <li>Every 30min: Ticket status syncs back from Linear</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

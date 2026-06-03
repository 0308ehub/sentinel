"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useWorkspace } from "./workspace-context";
import type { ToolCallState, ToolResult, AgentMessage } from "./workspace-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Bot,
  Send,
  Loader2,
  Search,
  Zap,
  FileText,
  Target,
  Lightbulb,
  Layers,
  ChevronRight,
  AlertCircle,
  Plus,
  X,
  MessageSquare,
} from "lucide-react";

const TOOL_ICONS: Record<string, React.ElementType> = {
  search_evidence: Search,
  get_pain_points: Lightbulb,
  get_opportunities: Target,
  get_insights: Layers,
  view_documents: FileText,
  synthesize_workspace: Zap,
  generate_prd: FileText,
  suggest_features: Lightbulb,
  create_workflow: Layers,
  analyze_segment: Target,
};

const TOOL_LABELS: Record<string, string> = {
  search_evidence: "Searching evidence",
  get_pain_points: "Loading pain points",
  get_opportunities: "Loading opportunities",
  get_insights: "Loading insights",
  view_documents: "Listing documents",
  synthesize_workspace: "Synthesizing workspace",
  generate_prd: "Generating PRD",
  suggest_features: "Suggesting features",
  create_workflow: "Creating workflow",
  analyze_segment: "Analyzing segment",
};

const SUGGESTED_PROMPTS = [
  "What are the top customer pain points?",
  "What should we build next?",
  "Which user segment is most frustrated?",
  "Synthesize all the customer evidence",
  "Generate a PRD for the top opportunity",
  "Suggest 5 features to address key pain points",
];

interface SSEEvent {
  type: string;
  content?: string;
  id?: string;
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: Record<string, any>;
  render?: ToolResult;
  message?: string;
  proposedContent?: string;
}

// ─── Tool card ────────────────────────────────────────────────────────────────

function ToolCard({ toolCall }: { toolCall: ToolCallState }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolCall.name] ?? Zap;
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const hasResult = !!toolCall.result;

  return (
    <div className="my-1">
      <button
        onClick={() => (hasResult ? setExpanded((e) => !e) : undefined)}
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground transition-colors",
          hasResult && "hover:text-foreground cursor-pointer",
          !hasResult && "cursor-default"
        )}
      >
        {toolCall.status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        ) : toolCall.status === "error" ? (
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        ) : (
          <Icon className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="font-medium">{label}</span>
        {hasResult && (
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform duration-150",
              expanded && "rotate-90"
            )}
          />
        )}
      </button>
      {expanded && toolCall.result && (
        <div className="mt-2 ml-5 pl-3 border-l-2 border-border/50">
          <ToolResultRenderer result={toolCall.result} />
        </div>
      )}
    </div>
  );
}

// ─── Tool result renderer ─────────────────────────────────────────────────────

function ToolResultRenderer({ result }: { result: ToolResult }) {
  const { type, data } = result;

  if (type === "search-results" && Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data
          .slice(0, 5)
          .map(
            (
              item: {
                id?: string;
                title?: string;
                content?: string;
                similarity?: number;
              },
              i: number
            ) => (
              <div key={item.id ?? i}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-medium text-foreground/80 text-xs">
                    {item.title}
                  </span>
                  {item.similarity != null && (
                    <span className="text-[10px] text-muted-foreground/60">
                      {(item.similarity * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground line-clamp-2 text-[11px]">
                  {item.content}
                </p>
              </div>
            )
          )}
        {data.length > 5 && (
          <p className="text-muted-foreground/60 text-[11px]">
            +{data.length - 5} more results
          </p>
        )}
      </div>
    );
  }

  if (type === "pain-points" && Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data
          .slice(0, 6)
          .map(
            (
              pp: {
                id?: string;
                title?: string;
                description?: string;
                severity?: number;
                urgency?: number;
              },
              i: number
            ) => (
              <div key={pp.id ?? i}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-medium text-foreground/80 text-xs">
                    {pp.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    S:{pp.severity} U:{pp.urgency}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-1 text-[11px]">
                  {pp.description}
                </p>
              </div>
            )
          )}
        {data.length > 6 && (
          <p className="text-muted-foreground/60 text-[11px]">
            +{data.length - 6} more
          </p>
        )}
      </div>
    );
  }

  if (type === "opportunities" && Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data
          .slice(0, 5)
          .map(
            (
              opp: {
                id?: string;
                title?: string;
                problemStatement?: string;
                totalScore?: number;
              },
              i: number
            ) => (
              <div key={opp.id ?? i}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-medium text-foreground/80 text-xs">
                    {opp.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    score {Number(opp.totalScore ?? 0).toFixed(0)}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-1 text-[11px]">
                  {opp.problemStatement}
                </p>
              </div>
            )
          )}
        {data.length > 5 && (
          <p className="text-muted-foreground/60 text-[11px]">
            +{data.length - 5} more
          </p>
        )}
      </div>
    );
  }

  if (type === "insights" && Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data
          .slice(0, 5)
          .map(
            (
              ins: {
                id?: string;
                title?: string;
                description?: string;
                type?: string;
              },
              i: number
            ) => (
              <div key={ins.id ?? i}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-medium text-foreground/80 text-xs">
                    {ins.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {ins.type}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-1 text-[11px]">
                  {ins.description}
                </p>
              </div>
            )
          )}
      </div>
    );
  }

  if (type === "documents" && Array.isArray(data)) {
    return (
      <div className="space-y-1.5">
        {data
          .slice(0, 6)
          .map(
            (
              doc: { id?: string; title?: string; status?: string },
              i: number
            ) => (
              <div key={doc.id ?? i} className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <span className="text-xs text-foreground/80 flex-1 truncate">
                  {doc.title}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {doc.status}
                </span>
              </div>
            )
          )}
        {data.length > 6 && (
          <p className="text-muted-foreground/60 text-[11px]">
            +{data.length - 6} more
          </p>
        )}
      </div>
    );
  }

  if (type === "prd" && data && typeof data === "object") {
    const prd = data as { title?: string; executiveSummary?: string };
    return (
      <div>
        <p className="font-semibold text-foreground/80 text-xs mb-1">
          {prd.title ?? "PRD Generated"}
        </p>
        <p className="text-[11px] text-muted-foreground line-clamp-3">
          {prd.executiveSummary}
        </p>
      </div>
    );
  }

  if (type === "features" && Array.isArray(data)) {
    return (
      <div className="space-y-2">
        {data.map(
          (
            f: { title?: string; description?: string; priority?: string },
            i: number
          ) => (
            <div key={i}>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-medium text-foreground/80 text-xs">
                  {f.title}
                </span>
                {f.priority && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {f.priority}
                  </span>
                )}
              </div>
              {f.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {f.description}
                </p>
              )}
            </div>
          )
        )}
      </div>
    );
  }

  if (type === "workflow" && Array.isArray(data)) {
    return (
      <div className="space-y-1.5">
        {data.map(
          (
            step: {
              step?: number;
              title?: string;
              description?: string;
              actor?: string;
            },
            i: number
          ) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="shrink-0 text-[10px] text-muted-foreground/60 font-medium w-4 text-right mt-0.5">
                {step.step ?? i + 1}.
              </span>
              <div>
                <span className="font-medium text-xs text-foreground/80">
                  {step.title}
                </span>
                {step.actor && (
                  <span className="text-[10px] text-muted-foreground/60 ml-1">
                    ({step.actor})
                  </span>
                )}
                {step.description && (
                  <p className="text-[11px] text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        )}
      </div>
    );
  }

  if (type === "synthesis" && data && typeof data === "object") {
    const s = data as {
      painPoints?: number;
      opportunities?: number;
      message?: string;
    };
    return (
      <div>
        <p className="text-xs text-foreground/80 font-medium">
          {s.message ?? "Synthesis complete"}
        </p>
        {s.painPoints != null && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Found {s.painPoints} pain points and {s.opportunities ?? 0} opportunities
          </p>
        )}
      </div>
    );
  }

  return (
    <pre className="text-[10px] text-muted-foreground overflow-auto max-h-32 whitespace-pre-wrap">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Session tab bar ──────────────────────────────────────────────────────────

function SessionTabs({ onClose }: { onClose: () => void }) {
  const { sessions, activeSessionId, setActiveSession, createSession, removeSession } =
    useWorkspace();

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      onClose();
    } else {
      removeSession(id);
    }
  };

  return (
    <div className="flex items-center border-b border-border bg-muted/40 overflow-hidden shrink-0 min-h-[34px]">
      <div
        className="flex items-stretch overflow-x-auto flex-1"
        style={{ scrollbarWidth: "none" }}
      >
        {sessions.map((session) => {
          const active = session.id === activeSessionId;
          const Icon = session.prdId ?? session.digestId ? FileText : Bot;
          return (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-1.5 px-3 min-w-0 max-w-[160px] border-r border-border cursor-pointer select-none shrink-0 h-[34px]",
                "text-xs font-medium transition-colors",
                active
                  ? "bg-card text-foreground border-t-2 border-t-indigo-600 -mt-px"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-t-2 border-t-transparent"
              )}
              onClick={() => setActiveSession(session.id)}
            >
              <Icon
                className={cn(
                  "h-3 w-3 shrink-0",
                  active ? "text-indigo-500" : "text-muted-foreground"
                )}
              />
              <span className="truncate flex-1">{session.label}</span>
              <button
                onClick={(e) => handleRemove(e, session.id)}
                className={cn(
                  "rounded p-0.5 transition-colors shrink-0",
                  active
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                    : "text-transparent group-hover:text-muted-foreground hover:!text-foreground hover:bg-muted"
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={createSession}
        className="h-[34px] px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 flex items-center border-l border-border"
        title="New chat"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Chat body ────────────────────────────────────────────────────────────────

function ChatBody({ workspaceId }: { workspaceId: string }) {
  const {
    sessions,
    activeSessionId,
    messages,
    addUserMessage,
    startAssistantMessage,
    appendAssistantText,
    addToolCall,
    updateToolCall,
    finishAssistantMessage,
    loadSessionHistory,
    getPRDWorkingContent,
    prdProposals,
    setPRDProposal,
    digestProposals,
    setDigestProposal,
  } = useWorkspace();

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const isPRDSession = !!activeSession?.prdId;
  const isDigestSession = !!activeSession?.digestId;
  const diffPending = isPRDSession
    ? prdProposals.has(activeSession.prdId!)
    : isDigestSession
    ? digestProposals.has(activeSession.digestId!)
    : false;

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textQueueRef = useRef<string[]>([]);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userScrolledUpRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Drain text queue char by char
  useEffect(() => {
    tickerRef.current = setInterval(() => {
      if (textQueueRef.current.length === 0) return;
      const char = textQueueRef.current.shift()!;
      appendAssistantText(char);
      if (!userScrolledUpRef.current) scrollToBottom();
    }, 8);
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [appendAssistantText, scrollToBottom]);

  // Track user-initiated scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let userGesturePending = false;
    const markGesture = () => {
      userGesturePending = true;
    };
    const onScroll = () => {
      if (!userGesturePending) return;
      userGesturePending = false;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      userScrolledUpRef.current = !nearBottom;
    };
    el.addEventListener("wheel", markGesture, { passive: true });
    el.addEventListener("touchmove", markGesture, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", markGesture);
      el.removeEventListener("touchmove", markGesture);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Load PRD conversation history on first render of a PRD session
  useEffect(() => {
    if (!activeSession?.prdId) return;
    if (activeSession.historyLoaded) return;

    const sessionId = activeSession.id;
    const prdId = activeSession.prdId;

    setHistoryError(null);

    fetch(`/api/prds/${prdId}/conversation`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "Failed to load conversation");

        const historyMessages: AgentMessage[] = json.data.messages.map(
          (m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role === "USER" ? "user" : "assistant",
            content: m.content,
            toolCalls: [],
            isStreaming: false,
          })
        );

        loadSessionHistory(sessionId, historyMessages, json.data.conversationId);
      })
      .catch((err) => {
        setHistoryError(err instanceof Error ? err.message : "Failed to load conversation");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  // Load digest conversation history on first render of a digest session
  useEffect(() => {
    if (!activeSession?.digestId) return;
    if (activeSession.historyLoaded) return;

    const sessionId = activeSession.id;
    const digestId = activeSession.digestId;

    setHistoryError(null);

    fetch(`/api/workspaces/${workspaceId}/digests/${digestId}/conversation`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "Failed to load conversation");

        const historyMessages: AgentMessage[] = json.data.messages.map(
          (m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role === "USER" ? "user" : "assistant",
            content: m.content,
            toolCalls: [],
            isStreaming: false,
          })
        );

        loadSessionHistory(sessionId, historyMessages, json.data.conversationId);
      })
      .catch((err) => {
        setHistoryError(err instanceof Error ? err.message : "Failed to load conversation");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || diffPending) return;
      setInput("");
      setIsLoading(true);

      addUserMessage(text.trim());

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      userScrolledUpRef.current = false;

      try {
        let res: Response;

        if (isPRDSession && activeSession?.prdId && activeSession.conversationId) {
          // PRD session: hit the PRD chat endpoint
          const currentContent =
            getPRDWorkingContent(activeSession.prdId) ?? "";
          res = await fetch(`/api/prds/${activeSession.prdId}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text.trim(),
              conversationId: activeSession.conversationId,
              currentContent,
            }),
            signal: ctrl.signal,
          });
        } else if (isDigestSession && activeSession?.digestId && activeSession.conversationId) {
          // Digest session: hit the digest chat endpoint
          res = await fetch(
            `/api/workspaces/${workspaceId}/digests/${activeSession.digestId}/chat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: text.trim(),
                conversationId: activeSession.conversationId,
                currentContent: "",
              }),
              signal: ctrl.signal,
            }
          );
        } else if (!isPRDSession && !isDigestSession) {
          // Regular agent session
          const history = messages.map((m) => ({
            role: m.role,
            content:
              m.content ||
              (m.toolCalls.length > 0
                ? `[Used tools: ${m.toolCalls.map((tc) => tc.name).join(", ")}]`
                : ""),
          }));
          history.push({ role: "user", content: text.trim() });

          res = await fetch(`/api/workspaces/${workspaceId}/agent`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: history }),
            signal: ctrl.signal,
          });
        } else {
          // Session but conversationId not yet loaded — guard
          setIsLoading(false);
          return;
        }

        if (!res.ok || !res.body) throw new Error("Failed to connect");

        startAssistantMessage();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const event = JSON.parse(raw) as SSEEvent;

              if (event.type === "text_delta" && event.content) {
                for (const ch of event.content) textQueueRef.current.push(ch);
              } else if (event.type === "prd_edit" && event.proposedContent && activeSession?.prdId) {
                setPRDProposal(activeSession.prdId, event.proposedContent);
              } else if (event.type === "digest_edit" && event.proposedContent && activeSession?.digestId) {
                setDigestProposal(activeSession.digestId, event.proposedContent);
              } else if (event.type === "tool_start" && event.id && event.name) {
                addToolCall({
                  id: event.id,
                  name: event.name,
                  input: event.input ?? {},
                  status: "running",
                });
              } else if (event.type === "tool_result" && event.id) {
                updateToolCall(event.id, { status: "done", result: event.render });
              } else if (event.type === "done") {
                const waitForDrain = () => {
                  if (textQueueRef.current.length === 0) {
                    finishAssistantMessage();
                    setIsLoading(false);
                    abortRef.current = null;
                  } else {
                    setTimeout(waitForDrain, 16);
                  }
                };
                waitForDrain();
                return;
              } else if (event.type === "error") {
                for (const ch of `\n\n⚠️ ${event.message}`) textQueueRef.current.push(ch);
                finishAssistantMessage();
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          textQueueRef.current = [];
          finishAssistantMessage();
        }
      } finally {
        if (isLoading) {
          setIsLoading(false);
          abortRef.current = null;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLoading,
      diffPending,
      isPRDSession,
      isDigestSession,
      activeSession,
      messages,
      workspaceId,
      addUserMessage,
      startAssistantMessage,
      appendAssistantText,
      addToolCall,
      updateToolCall,
      finishAssistantMessage,
      getPRDWorkingContent,
      setPRDProposal,
      setDigestProposal,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Loading skeleton while fetching PRD or digest conversation history
  if ((isPRDSession || isDigestSession) && !activeSession?.historyLoaded) {
    if (historyError) {
      return (
        <div className="flex flex-col flex-1 items-center justify-center p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">
            Failed to load conversation
          </p>
          <p className="text-xs text-muted-foreground mb-4">{historyError}</p>
          <button
            onClick={() => {
              setHistoryError(null);
              window.location.reload();
            }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col flex-1 p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-card">
      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            {isPRDSession ? (
              <>
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {activeSession?.prdTitle ?? "PRD"}
                </p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  {`I'm reviewing this PRD with you. Ask me to add sections, sharpen requirements, adjust scope, or clarify anything.`}
                </p>
              </>
            ) : isDigestSession ? (
              <>
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                  <FileText className="h-6 w-6 text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {activeSession?.digestTitle ?? "Digest"}
                </p>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Ask Sentinel to update this digest, add missing context, or rewrite any section.
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6 text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Sentinel Agent
                </p>
                <p className="text-xs text-muted-foreground mb-6 max-w-[240px]">
                  Ask me to analyze evidence, surface pain points, generate PRDs, or
                  suggest features.
                </p>
                <div className="space-y-1.5 w-full">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left text-xs text-muted-foreground bg-muted/50 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300 border border-border hover:border-indigo-200 rounded-lg px-3 py-2 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn(msg.role === "user" ? "flex justify-end" : "")}>
            {msg.role === "user" ? (
              <div className="max-w-[85%] bg-muted text-foreground rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="text-sm text-foreground leading-relaxed space-y-1">
                {msg.toolCalls.map((tc) => (
                  <ToolCard key={tc.id} toolCall={tc} />
                ))}
                {msg.content && (
                  <div className="whitespace-pre-wrap">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-0.5 h-[1em] bg-foreground/60 ml-0.5 animate-pulse align-text-bottom" />
                    )}
                  </div>
                )}
                {msg.isStreaming && !msg.content && msg.toolCalls.length === 0 && (
                  <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card p-3">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={diffPending}
            placeholder={
              diffPending
                ? "Resolve pending changes to continue"
                : isDigestSession
                ? "Ask Sentinel to update this digest… (↵ to send)"
                : "Ask Sentinel… (↵ to send, ⇧↵ for newline)"
            }
            className="resize-none text-sm min-h-[60px] max-h-[120px] flex-1"
            rows={2}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim() || diffPending}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 w-9 p-0 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        {diffPending ? (
          <p className="text-[10px] text-amber-600 mt-1.5 text-center">
            Resolve pending changes to continue
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 text-center">
            {isPRDSession
              ? "Changes will be proposed as a diff for your review"
              : isDigestSession
              ? "Proposed rewrites appear in the digest viewer for your review"
              : "Sentinel has access to all workspace data"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AgentPanel({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SessionTabs onClose={onClose} />
      <ChatBody workspaceId={workspaceId} />
    </div>
  );
}

// ─── Reopen button ────────────────────────────────────────────────────────────

export function AgentPanelToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-1.5 py-3 h-full border-l border-border bg-card hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:border-indigo-200 transition-colors group"
      title="Open Sentinel Agent"
    >
      <MessageSquare className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600 transition-colors" />
      <span
        className="text-[10px] font-medium text-muted-foreground group-hover:text-indigo-600 transition-colors"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        Sentinel
      </span>
    </button>
  );
}

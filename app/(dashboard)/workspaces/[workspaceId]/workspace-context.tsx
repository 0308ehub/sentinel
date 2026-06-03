"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

export type ArtifactRenderType =
  | "search-results"
  | "pain-points"
  | "opportunities"
  | "insights"
  | "prd"
  | "features"
  | "workflow"
  | "documents"
  | "synthesis"
  | "text";

export interface ToolResult {
  type: ArtifactRenderType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface ToolCallState {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
  status: "running" | "done" | "error";
  result?: ToolResult;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCallState[];
  isStreaming: boolean;
}

export interface ChatSession {
  id: string;
  label: string;
  messages: AgentMessage[];
  // PRD session fields — undefined for regular agent sessions
  prdId?: string;
  prdTitle?: string;
  // Digest session fields — undefined for non-digest sessions
  digestId?: string;
  digestTitle?: string;
  conversationId?: string;
  historyLoaded?: boolean;
}

function makeSession(index: number): ChatSession {
  return { id: crypto.randomUUID(), label: `Agent ${index}`, messages: [] };
}

interface WorkspaceContextValue {
  sessions: ChatSession[];
  activeSessionId: string;
  setActiveSession: (id: string) => void;
  createSession: () => void;
  removeSession: (id: string) => void;
  renameSession: (id: string, label: string) => void;

  // Operate on the active session:
  messages: AgentMessage[];
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  appendAssistantText: (text: string) => void;
  addToolCall: (toolCall: ToolCallState) => void;
  updateToolCall: (id: string, updates: Partial<ToolCallState>) => void;
  finishAssistantMessage: () => void;

  // PRD tab management:
  openPRDTab: (prdId: string, prdTitle: string) => void;
  loadSessionHistory: (
    sessionId: string,
    messages: AgentMessage[],
    conversationId: string
  ) => void;

  // Working content (updated as hunks are accepted/rejected — not yet saved):
  setPRDWorkingContent: (prdId: string, content: string) => void;
  getPRDWorkingContent: (prdId: string) => string | undefined;

  // Pending AI proposals (set by panel, read by PRD page):
  prdProposals: Map<string, string>;
  setPRDProposal: (prdId: string, proposedContent: string) => void;
  clearPRDProposal: (prdId: string) => void;

  // Digest tab management:
  openDigestTab: (digestId: string, digestTitle: string) => void;

  // Pending AI digest proposals (set by panel, read by digest page):
  digestProposals: Map<string, string>;
  setDigestProposal: (digestId: string, proposedContent: string) => void;
  clearDigestProposal: (digestId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const sessionCounter = useRef(1);
  const [sessions, setSessions] = useState<ChatSession[]>([makeSession(1)]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);

  // No re-render needed for working content — ChatBody reads it synchronously on send
  const prdWorkingContentRef = useRef<Map<string, string>>(new Map());
  const [prdProposals, setPrdProposals] = useState<Map<string, string>>(new Map());
  const [digestProposals, setDigestProposals] = useState<Map<string, string>>(new Map());

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const messages = activeSession?.messages ?? [];

  const setActiveSession = useCallback((id: string) => setActiveSessionId(id), []);

  const createSession = useCallback(() => {
    sessionCounter.current += 1;
    const session = makeSession(sessionCounter.current);
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(session.id);
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => {
      if (prev.length === 1) {
        sessionCounter.current += 1;
        const fresh = makeSession(sessionCounter.current);
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      const next = prev.filter((s) => s.id !== id);
      setActiveSessionId((cur) => (cur === id ? next[next.length - 1].id : cur));
      return next;
    });
  }, []);

  const renameSession = useCallback((id: string, label: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }, []);

  const updateActiveMessages = useCallback(
    (updater: (msgs: AgentMessage[]) => AgentMessage[]) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, messages: updater(s.messages) } : s
        )
      );
    },
    [activeSessionId]
  );

  const addUserMessage = useCallback(
    (content: string) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          // Preserve the label for PRD sessions; auto-label regular sessions from first message
          const label =
            !s.prdId && s.messages.length === 0
              ? content.slice(0, 28) + (content.length > 28 ? "…" : "")
              : s.label;
          const msg: AgentMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content,
            toolCalls: [],
            isStreaming: false,
          };
          return { ...s, label, messages: [...s.messages, msg] };
        })
      );
    },
    [activeSessionId]
  );

  const startAssistantMessage = useCallback(() => {
    updateActiveMessages((msgs) => [
      ...msgs,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
      },
    ]);
  }, [updateActiveMessages]);

  const appendAssistantText = useCallback(
    (text: string) => {
      updateActiveMessages((msgs) => {
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") return msgs;
        return [...msgs.slice(0, -1), { ...last, content: last.content + text }];
      });
    },
    [updateActiveMessages]
  );

  const addToolCall = useCallback(
    (toolCall: ToolCallState) => {
      updateActiveMessages((msgs) => {
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") return msgs;
        return [
          ...msgs.slice(0, -1),
          { ...last, toolCalls: [...last.toolCalls, toolCall] },
        ];
      });
    },
    [updateActiveMessages]
  );

  const updateToolCall = useCallback(
    (id: string, updates: Partial<ToolCallState>) => {
      updateActiveMessages((msgs) => {
        const last = msgs[msgs.length - 1];
        if (!last || last.role !== "assistant") return msgs;
        return [
          ...msgs.slice(0, -1),
          {
            ...last,
            toolCalls: last.toolCalls.map((tc) =>
              tc.id === id ? { ...tc, ...updates } : tc
            ),
          },
        ];
      });
    },
    [updateActiveMessages]
  );

  const finishAssistantMessage = useCallback(() => {
    updateActiveMessages((msgs) => {
      const last = msgs[msgs.length - 1];
      if (!last || last.role !== "assistant") return msgs;
      return [...msgs.slice(0, -1), { ...last, isStreaming: false }];
    });
  }, [updateActiveMessages]);

  // ── PRD tab management ─────────────────────────────────────────────────────

  const openPRDTab = useCallback((prdId: string, prdTitle: string) => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.prdId === prdId);
      if (existing) {
        setActiveSessionId(existing.id);
        return prev;
      }
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        label: `PRD: ${prdTitle}`,
        messages: [],
        prdId,
        prdTitle,
        historyLoaded: false,
      };
      setActiveSessionId(newSession.id);
      return [...prev, newSession];
    });
  }, []);

  // ── Digest tab management ──────────────────────────────────────────────────

  const openDigestTab = useCallback((digestId: string, digestTitle: string) => {
    setSessions((prev) => {
      const existing = prev.find((s) => s.digestId === digestId);
      if (existing) {
        setActiveSessionId(existing.id);
        return prev;
      }
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        label: `Digest: ${digestTitle}`,
        messages: [],
        digestId,
        digestTitle,
        historyLoaded: false,
      };
      setActiveSessionId(newSession.id);
      return [...prev, newSession];
    });
  }, []);

  const loadSessionHistory = useCallback(
    (sessionId: string, msgs: AgentMessage[], conversationId: string) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: msgs, conversationId, historyLoaded: true }
            : s
        )
      );
    },
    []
  );

  // ── Working content ────────────────────────────────────────────────────────

  const setPRDWorkingContent = useCallback((prdId: string, content: string) => {
    prdWorkingContentRef.current.set(prdId, content);
  }, []);

  const getPRDWorkingContent = useCallback(
    (prdId: string) => prdWorkingContentRef.current.get(prdId),
    []
  );

  // ── PRD proposals ──────────────────────────────────────────────────────────

  const setPRDProposal = useCallback((prdId: string, proposedContent: string) => {
    setPrdProposals((prev) => new Map(prev).set(prdId, proposedContent));
  }, []);

  const clearPRDProposal = useCallback((prdId: string) => {
    setPrdProposals((prev) => {
      const next = new Map(prev);
      next.delete(prdId);
      return next;
    });
  }, []);

  // ── Digest proposals ───────────────────────────────────────────────────────

  const setDigestProposal = useCallback((digestId: string, proposedContent: string) => {
    setDigestProposals((prev) => new Map(prev).set(digestId, proposedContent));
  }, []);

  const clearDigestProposal = useCallback((digestId: string) => {
    setDigestProposals((prev) => {
      const next = new Map(prev);
      next.delete(digestId);
      return next;
    });
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        sessions,
        activeSessionId,
        setActiveSession,
        createSession,
        removeSession,
        renameSession,
        messages,
        addUserMessage,
        startAssistantMessage,
        appendAssistantText,
        addToolCall,
        updateToolCall,
        finishAssistantMessage,
        openPRDTab,
        loadSessionHistory,
        setPRDWorkingContent,
        getPRDWorkingContent,
        prdProposals,
        setPRDProposal,
        clearPRDProposal,
        openDigestTab,
        digestProposals,
        setDigestProposal,
        clearDigestProposal,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

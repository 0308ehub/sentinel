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
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const sessionCounter = useRef(1);
  const [sessions, setSessions] = useState<ChatSession[]>([makeSession(1)]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);

  // Always derive messages from the active session
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
        // Reset to a single blank session instead of zero
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

  // Helpers that mutate the active session's messages
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
      // Auto-label the session after the first user message
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          const label =
            s.messages.length === 0
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
      { id: crypto.randomUUID(), role: "assistant", content: "", toolCalls: [], isStreaming: true },
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
        return [...msgs.slice(0, -1), { ...last, toolCalls: [...last.toolCalls, toolCall] }];
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
          { ...last, toolCalls: last.toolCalls.map((tc) => (tc.id === id ? { ...tc, ...updates } : tc)) },
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

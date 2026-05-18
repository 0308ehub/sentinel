"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { WorkspaceNav } from "@/components/nav/workspace-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate } from "@/lib/utils";
import {
  Send,
  Loader2,
  MessageSquare,
  Plus,
  Bot,
  User,
  Sparkles,
} from "lucide-react";

interface Message {
  id?: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  createdAt?: string;
}

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
  _count: { messages: number };
}

const SUGGESTED_PROMPTS = [
  "What should we build next?",
  "What are the top recurring pain points?",
  "Which customer segment is most frustrated?",
  "Generate a PRD for the top opportunity.",
  "Turn this recommendation into engineering tasks.",
];

export default function ChatPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    async function fetchConversations() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/conversations`);
        const data = await res.json();
        if (data.ok) {
          setConversations(data.data);
          if (data.data.length > 0) {
            loadConversation(data.data[0].id);
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoadingConversations(false);
      }
    }
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const loadConversation = async (convId: string) => {
    setActiveConvId(convId);
    setMessages([]);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      const data = await res.json();
      if (data.ok) setMessages(data.data.messages ?? []);
    } catch {
      // silently fail
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    setInput("");
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "USER", content: msg, createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, conversationId: activeConvId ?? undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        const { conversationId: returnedConvId, message: assistantMsg } = data.data;
        setActiveConvId(returnedConvId);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          { id: `user-${Date.now()}`, role: "USER" as const, content: msg, createdAt: new Date().toISOString() },
          { id: `assistant-${Date.now()}`, role: "ASSISTANT" as const, content: assistantMsg.content, createdAt: new Date().toISOString() },
        ]);
        // Refresh sidebar
        const convRes = await fetch(`/api/workspaces/${workspaceId}/conversations`);
        const convData = await convRes.json();
        if (convData.ok) setConversations(convData.data);
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempId),
          { id: `user-${Date.now()}`, role: "USER" as const, content: msg, createdAt: new Date().toISOString() },
          { id: `err-${Date.now()}`, role: "ASSISTANT" as const, content: "Something went wrong. Please try again.", createdAt: new Date().toISOString() },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        { id: `user-${Date.now()}`, role: "USER" as const, content: msg, createdAt: new Date().toISOString() },
        { id: `err-${Date.now()}`, role: "ASSISTANT" as const, content: "Failed to connect. Please try again.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const showWelcome = messages.length === 0 && !loadingMessages && !sending;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <WorkspaceNav workspaceId={workspaceId} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT PANEL: conversation list ── */}
        <aside className="w-64 border-r bg-white flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-4 border-b">
            <Button
              onClick={startNewConversation}
              size="sm"
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New Conversation
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {loadingConversations ? (
                <div className="space-y-2 p-1">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <MessageSquare className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={cn(
                        "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                        activeConvId === conv.id
                          ? "bg-violet-50 border border-violet-200"
                          : "hover:bg-gray-50 border border-transparent"
                      )}
                    >
                      <p className={cn(
                        "text-sm font-medium truncate leading-snug",
                        activeConvId === conv.id ? "text-violet-800" : "text-gray-700"
                      )}>
                        {conv.title ?? "Untitled conversation"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {conv._count.messages} msg{conv._count.messages !== 1 ? "s" : ""} · {formatDate(conv.updatedAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* ── RIGHT PANEL: messages + input ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loadingMessages ? (
              <div className="max-w-2xl mx-auto space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "flex-row-reverse" : "")}>
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <Skeleton className={cn("rounded-2xl", i % 2 === 0 ? "h-12 w-40" : "h-20 w-64")} />
                  </div>
                ))}
              </div>
            ) : showWelcome ? (
              <WelcomeScreen onPrompt={sendMessage} />
            ) : (
              <div className="max-w-2xl mx-auto space-y-4 pb-4">
                {messages.map((msg, i) => (
                  <MessageBubble key={msg.id ?? i} message={msg} />
                ))}
                {sending && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t bg-white px-6 py-4 shrink-0">
            <div className="max-w-2xl mx-auto">
              {/* Suggested prompts when chat is empty */}
              {messages.length === 0 && !loadingMessages && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      disabled={sending}
                      className="text-xs px-3 py-1.5 rounded-full border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Sentinel anything about your product…"
                  rows={2}
                  className="flex-1 resize-none text-sm"
                  disabled={sending}
                />
                <Button
                  onClick={() => sendMessage()}
                  disabled={sending || !input.trim()}
                  size="icon"
                  className="h-[68px] w-11 shrink-0 bg-violet-600 hover:bg-violet-700 text-white rounded-xl"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                <kbd className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">Enter</kbd> to send ·{" "}
                <kbd className="text-xs bg-gray-100 px-1 py-0.5 rounded font-mono">Shift+Enter</kbd> for new line
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "USER";

  return (
    <div className={cn("flex gap-3 items-end", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
        isUser
          ? "bg-violet-600 text-white"
          : "bg-gradient-to-br from-violet-500 to-indigo-600 text-white"
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-violet-600 text-white rounded-br-sm"
          : "bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm"
      )}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shrink-0">
        <Bot className="h-4 w-4" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4 py-12">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 mb-5 shadow-lg">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Ask Sentinel</h2>
      <p className="text-sm text-gray-500 max-w-sm mb-8 leading-relaxed">
        I&apos;ve analyzed your evidence, pain points, and opportunities. Ask me anything about
        what your customers need and what to build next.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPrompt(prompt)}
            className="text-sm px-4 py-2 rounded-xl border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 hover:border-violet-300 transition-colors font-medium"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

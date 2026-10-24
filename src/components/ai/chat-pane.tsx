"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Calendar,
  Folder,
  Hash,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { chipQuery, matchingChips, pullChips, pullChipsForSend } from "@/lib/chat-chips";
import {
  activeThread,
  addFiles,
  assignActiveFolder,
  chatBucket,
  contextEstimate,
  createFolder,
  greetingFor,
  openThread,
  pickChip,
  removeChip,
  removeFile,
  removeFolder,
  runScheduled,
  schedulePrompt,
  sendChat,
  setDraft,
  setFolderFilter,
  setModel,
  startNewChat,
  threadPending,
  useChatState,
  useComposerDraft,
  type ChatMessage,
  type ModelChoice,
} from "@/lib/chat/session";
import { modelTitle } from "@/lib/ai/policy";
import { CURRENT_USER } from "@/lib/settings";
import { readOnboarding } from "@/lib/onboarding";
import { fileBugFromChat } from "@/lib/issues/file-from-chat";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function ChatPane({ variant, onClose }: { variant: "page" | "dock"; onClose?: () => void }) {
  const state = useChatState();
  const draft = useComposerDraft();
  const thread = activeThread(state);
  const pending = threadPending(state.activeId);
  const [list, setList] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [greeting, setGreeting] = useState("What should we look at?");
  const bottomRef = useRef<HTMLDivElement>(null);
  const empty = !thread || thread.messages.length === 0;

  useEffect(() => {
    const draftProfile = readOnboarding();
    const full = draftProfile.name || (CURRENT_USER.name === "You" ? "" : CURRENT_USER.name);
    const first = full.trim().split(/\s+/)[0] ?? "";
    setGreeting(greetingFor(first && first !== "You" ? first : ""));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length, pending]);

  const transcript = (
    <div className="flex-1 overflow-y-auto">
      <div className={cn("mx-auto flex min-h-full w-full flex-col", variant === "page" ? "max-w-2xl px-4 py-8" : "px-3 py-4")}>
        {empty ? (
          <EmptyState greeting={greeting} dock={variant === "dock"} />
        ) : (
          <div className="space-y-7">
            {thread.messages.map((message) => (
              <MessageBlock key={message.id} message={message} />
            ))}
            {pending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );

  const history = (
    <ChatHistory
      compact={variant === "dock"}
      onPick={() => setList(false)}
      onCollapse={variant === "page" ? () => setHistoryOpen(false) : undefined}
    />
  );

  if (variant === "dock") {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <button type="button" onClick={() => setList((open) => !open)} className="text-sm font-medium">
            {list ? "Chat" : "Chats"}
          </button>
          <button type="button" onClick={() => { startNewChat(); setList(false); }} className="text-muted-foreground" aria-label="New chat">
            <Plus className="h-4 w-4" />
          </button>
          <Link href="/ai" className="ml-auto text-muted-foreground" aria-label="Open the full chat" onClick={onClose}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Link>
          <button type="button" onClick={onClose} className="text-muted-foreground" aria-label="Minimize chat" title="Minimize">
            <X className="h-4 w-4" />
          </button>
        </div>
        {list ? <div className="min-h-0 flex-1">{history}</div> : transcript}
        {!list && !empty && (
          <div className="border-t border-border p-2">
            <Composer />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {historyOpen && (
        <div className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-muted/40">{history}</div>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {!historyOpen && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Show chats"
            title="Show chats"
            className="absolute left-3 top-3 z-10 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        {transcript}
        {!empty && (
          <div className="px-4 pb-4">
            <div className="mx-auto max-w-2xl">
              <Composer />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ greeting, dock }: { greeting: string; dock: boolean }) {
  return (
    <div className="m-auto flex w-full max-w-2xl flex-col items-center pb-6">
      <h1 className={cn("text-center font-medium tracking-tight text-foreground/80", dock ? "text-xl" : "text-3xl")}>{greeting}</h1>
      <div className="mt-8 w-full">
        <Composer utilities />
      </div>
    </div>
  );
}

function UtilityButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
        active ? "border-foreground/20 bg-accent text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Composer({ utilities = false }: { utilities?: boolean }) {
  const state = useChatState();
  const draft = useComposerDraft();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [panel, setPanel] = useState<"folders" | "schedule" | null>(null);
  const [models, setModels] = useState({ claude: "Claude", openai: "OpenAI" });
  const query = chipQuery(draft.text);
  const menu = modeOpen ? matchingChips("") : query === null ? [] : matchingChips(query);
  const thread = activeThread(state);
  const estimate = contextEstimate(thread?.messages ?? [], state.model);
  const productId = useUIStore((store) => store.activeProductId);

  useEffect(() => {
    void fetch("/api/models/status", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ claude?: { model?: string }; openai?: { model?: string } }>)
      .then((body) => {
        setModels({
          claude: body.claude?.model ? modelTitle("claude", body.claude.model) : "Claude",
          openai: body.openai?.model ? openAiLabel(body.openai.model) : "OpenAI",
        });
      })
      .catch(() => undefined);
  }, []);

  async function sendWithBug(text: string, chips: string[]) {
    let message = text;
    if (chips.includes("bug")) {
      const filed = await fileBugFromChat(text, productId).catch(() => null);
      if (filed) message = `${text}\n\nFiled on the board as “${filed.title}” at /board/${filed.id}.`;
    }
    void sendChat(message);
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (menu.length > 0) {
      pickChip(menu[Math.min(menuIndex, menu.length - 1)].id);
      setModeOpen(false);
      setMenuIndex(0);
      return;
    }
    const pulled = pullChipsForSend(draft.text, draft.chips);
    setDraft({ text: pulled.text, chips: pulled.chips, files: draft.files });
    void sendWithBug(pulled.text, pulled.chips);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (menu.length > 0 && event.key === "ArrowDown") {
      event.preventDefault();
      setMenuIndex((index) => (index + 1) % menu.length);
      return;
    }
    if (menu.length > 0 && event.key === "ArrowUp") {
      event.preventDefault();
      setMenuIndex((index) => (index - 1 + menu.length) % menu.length);
      return;
    }
    if (menu.length > 0 && (event.key === "Tab" || event.key === "Enter")) {
      event.preventDefault();
      pickChip(menu[Math.min(menuIndex, menu.length - 1)].id);
      setModeOpen(false);
      return;
    }
    if (event.key === "Escape") {
      setModeOpen(false);
      setModelOpen(false);
      return;
    }
    if (event.key === "Backspace" && draft.text === "" && draft.chips.length > 0) {
      event.preventDefault();
      removeChip(draft.chips[draft.chips.length - 1]);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const modelLabel = state.model === "auto" ? "Auto" : state.model === "claude" ? models.claude : models.openai;

  return (
    <form onSubmit={submit} className="relative">
      {menu.length > 0 && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {menu.map((chip, index) => (
            <button
              key={chip.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                pickChip(chip.id);
                setModeOpen(false);
              }}
              className={cn("flex w-full flex-col px-3 py-2 text-left", index === menuIndex ? "bg-muted" : "hover:bg-muted/60")}
            >
              <span className="text-sm">#{chip.id}</span>
              <span className="text-[11px] text-muted-foreground">{chip.hint}</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
        {(draft.chips.length > 0 || draft.files.length > 0) && (
          <div className="mb-1 flex flex-wrap gap-1">
            {draft.chips.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-brand">
                #{id}
                <button type="button" aria-label={`Remove #${id}`} onClick={() => removeChip(id)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {draft.files.map((file) => (
              <span key={file.name} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                {file.name}
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeFile(file.name)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={areaRef}
          value={draft.text}
          onChange={(event) => {
            const pulled = pullChips(event.target.value, draft.chips);
            setDraft({
              text: pulled.text === event.target.value ? event.target.value : pulled.text.replace(/[ \t]+$/g, ""),
              chips: pulled.chips,
              files: draft.files,
            });
            setMenuIndex(0);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask anything…"
          className="max-h-40 w-full resize-none bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1 pb-0.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.log,.ts,.tsx,.py,.sql,.html"
            className="hidden"
            onChange={(event) => {
              void takeFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <IconButton label="Attach a file" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </IconButton>
          <IconButton label="Choose a mode" onClick={() => { setModeOpen((open) => !open); setModelOpen(false); }}>
            <Hash className="h-4 w-4" />
          </IconButton>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setModelOpen((open) => !open); setModeOpen(false); }}
              className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {modelLabel}
            </button>
            {modelOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-2 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {(["auto", "claude", "openai"] as ModelChoice[]).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => { setModel(choice); setModelOpen(false); }}
                    className={cn("block w-full px-3 py-2 text-left text-sm hover:bg-muted", state.model === choice && "bg-muted")}
                  >
                    {choice === "auto" ? "Auto" : choice === "claude" ? models.claude : models.openai}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ContextRing ratio={estimate.ratio} tokens={estimate.tokens} limit={estimate.window} />
          <button
            type="submit"
            disabled={threadPending(state.activeId) || (!draft.text.trim() && draft.files.length === 0 && menu.length === 0)}
            aria-label="Send"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
      {utilities && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <UtilityButton active={panel === "folders"} onClick={() => setPanel(panel === "folders" ? null : "folders")}>
            <Folder className="h-3.5 w-3.5" />
            Folders
          </UtilityButton>
          <UtilityButton active={panel === "schedule"} onClick={() => setPanel(panel === "schedule" ? null : "schedule")}>
            <Calendar className="h-3.5 w-3.5" />
            Schedule
          </UtilityButton>
          <Link href="/settings/connectors" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Connect apps
          </Link>
        </div>
      )}
      {utilities && panel === "folders" && <FolderPanel />}
      {utilities && panel === "schedule" && <SchedulePanel />}
    </form>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
      {children}
    </button>
  );
}

function ContextRing({ ratio, tokens, limit }: { ratio: number; tokens: number; limit: number }) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(ratio > 0 ? 1 : 0, ratio * circumference);
  return (
    <span
      title={`About ${tokens.toLocaleString()} of ${limit.toLocaleString()} tokens. Estimated from the text in this chat.`}
      className="inline-flex text-muted-foreground"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r={radius} fill="none" stroke="currentColor" className="text-border" strokeWidth="1.6" />
        <circle
          cx="8"
          cy="8"
          r={radius}
          fill="none"
          stroke="currentColor"
          className={ratio > 0.8 ? "text-warning" : "text-foreground/70"}
          strokeWidth="1.6"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
        />
      </svg>
    </span>
  );
}

function ChatHistory({ compact, onPick, onCollapse }: { compact?: boolean; onPick?: () => void; onCollapse?: () => void }) {
  const state = useChatState();
  const visible = state.folderId ? state.threads.filter((thread) => thread.folderId === state.folderId) : state.threads;
  const groups = ["Today", "This week", "Earlier"] as const;
  return (
    <div className={cn("flex h-full flex-col", compact ? "" : "h-full")}>
      <div className="flex items-center justify-between px-3 py-3">
        <p className="text-sm font-medium">Chats</p>
        <div className="flex items-center gap-1">
          {!compact && (
            <button type="button" onClick={() => startNewChat()} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="New chat">
              <Plus className="h-4 w-4" />
            </button>
          )}
          {onCollapse && (
            <button type="button" onClick={onCollapse} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Hide chats" title="Hide chats">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {state.folders.length > 0 && (
        <div className="flex gap-1 overflow-x-auto px-3 pb-2">
          <FilterChip active={!state.folderId} onClick={() => setFolderFilter(null)}>All</FilterChip>
          {state.folders.map((folder) => (
            <FilterChip key={folder.id} active={state.folderId === folder.id} onClick={() => setFolderFilter(folder.id)}>
              {folder.name}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {visible.length === 0 && <p className="px-2 py-6 text-xs text-muted-foreground">No chats yet.</p>}
        {groups.map((group) => {
          const items = visible.filter((thread) => chatBucket(thread.updatedAt) === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-3">
              <p className="px-2 py-1 text-[11px] text-muted-foreground">{group}</p>
              {items.map((thread) => {
                const folder = state.folders.find((item) => item.id === thread.folderId);
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => { openThread(thread.id); onPick?.(); }}
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm",
                      thread.id === state.activeId ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-muted",
                    )}
                  >
                    {thread.title}
                    {folder && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{folder.name}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px]", active ? "bg-accent text-foreground" : "text-muted-foreground")}>
      {children}
    </button>
  );
}

function FolderPanel() {
  const state = useChatState();
  const [name, setName] = useState("");
  return (
    <div className="mt-3 w-full max-w-md rounded-xl border border-border bg-card p-3 text-sm">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          createFolder(name);
          setName("");
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Folder for a product or feature"
          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none"
        />
        <button type="submit" className="rounded-md bg-foreground px-2 text-xs text-background">Add</button>
      </form>
      <div className="mt-2 space-y-1">
        {state.folders.map((folder) => (
          <div key={folder.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFolderFilter(folder.id);
                assignActiveFolder(folder.id);
              }}
              className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
            >
              {folder.name}
            </button>
            <button type="button" onClick={() => removeFolder(folder.id)} className="text-muted-foreground" aria-label={`Remove ${folder.name}`}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {state.folders.length === 0 && <p className="text-xs text-muted-foreground">Folders keep chats for one product or feature together.</p>}
      </div>
    </div>
  );
}

function SchedulePanel() {
  const state = useChatState();
  const draft = useComposerDraft();
  const [when, setWhen] = useState("");
  return (
    <div className="mt-3 w-full max-w-md rounded-xl border border-border bg-card p-3">
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          schedulePrompt(draft.text, when);
          setWhen("");
        }}
      >
        <input
          type="datetime-local"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none"
        />
        <button type="submit" className="h-8 rounded-md bg-foreground text-xs text-background">Schedule the draft</button>
      </form>
      <div className="mt-2 space-y-2">
        {state.schedules.filter((item) => !item.done).map((item) => {
          const due = new Date(item.at).getTime() <= Date.now();
          return (
            <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
              <div>
                <p className="line-clamp-2">{item.prompt}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(item.at).toLocaleString()}{due ? " · Due" : ""}</p>
              </div>
              {due && (
                <button type="button" onClick={() => runScheduled(item.id)} className="shrink-0 text-brand">
                  Run
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageBlock({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%]">
          {message.chips && message.chips.length > 0 && (
            <div className="mb-1 flex justify-end gap-1">
              {message.chips.map((id) => (
                <span key={id} className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-brand">#{id}</span>
              ))}
            </div>
          )}
          <p className="rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed">{message.content}</p>
          {message.files && message.files.length > 0 && (
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{message.files.map((file) => file.name).join(", ")}</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        <AnswerText text={message.content} />
      </div>
      <Citations message={message} />
      {message.route && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {modelTitle(message.route.provider, message.route.model)} · {message.route.reason}
        </p>
      )}
    </div>
  );
}

function Citations({ message }: { message: ChatMessage }) {
  const items: { key: string; logo?: string; label: string; href?: string }[] = [];
  for (const channel of message.channels ?? []) items.push({ key: `slack-${channel}`, logo: "/connectors/slack.png", label: `#${channel}` });
  for (const issue of message.issues ?? []) items.push({ key: `jira-${issue}`, logo: "/connectors/jira.svg", label: issue });
  for (const query of message.queries ?? []) {
    items.push({
      key: `db-${query.sql.slice(0, 40)}`,
      logo: "/connectors/databricks.svg",
      label: query.error ? "Databricks unavailable" : `Databricks · ${query.rowCount} row${query.rowCount === 1 ? "" : "s"}`,
    });
  }
  for (const source of message.sources ?? []) {
    items.push({ key: source.url, label: source.title || hostOf(source.url), href: source.url });
  }
  if (items.length === 0 && !message.searched && !message.queries?.length) return null;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {message.searched && <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Web search</span>}
        {items.map((item) => {
          const body = (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px]">
              {item.logo ? (
                // Logos are local connector marks.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.logo} alt="" className="h-3.5 w-3.5 object-contain" />
              ) : null}
              <span className="truncate">{item.label}</span>
            </span>
          );
          return item.href ? (
            <a key={item.key} href={item.href} target="_blank" rel="noreferrer" className="max-w-full hover:opacity-80">{body}</a>
          ) : (
            <span key={item.key}>{body}</span>
          );
        })}
      </div>
      {message.queries && message.queries.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">Warehouse query</summary>
          {message.queries.map((query) => (
            <pre key={query.sql} className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">
              {query.error || query.sql}
            </pre>
          ))}
        </details>
      )}
    </div>
  );
}

function AnswerText({ text }: { text: string }) {
  const parts = text.split(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 3 === 1) {
          const url = parts[index + 1];
          return (
            <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="text-brand underline-offset-2 hover:underline">
              {part}
            </a>
          );
        }
        if (index % 3 === 2) return null;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function openAiLabel(model: string): string {
  return model.startsWith("gpt-") ? `GPT-${model.slice(4)}` : model;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function takeFiles(list: FileList | null) {
  if (!list) return;
  const next = [];
  for (const file of Array.from(list).slice(0, 4)) {
    if (file.size > 200_000) continue;
    const text = await file.text();
    if (text.includes("\u0000")) continue;
    next.push({ name: file.name, text: text.slice(0, 12000) });
  }
  if (next.length) addFiles(next);
}


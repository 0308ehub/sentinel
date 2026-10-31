"use client";

import { FormEvent, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Pause, Play, Plus, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGraphNode, useGraphStore } from "@/lib/graph/graph-store";
import {
  assignKismetAgents,
  createAgent,
  removeAgent,
  setAgentModel,
  setAgentStatus,
  talkToAgent,
  useAgents,
  type AgentModel,
  type AgentStatus,
  type FleetAgent,
} from "@/lib/agents/fleet";

const STATUS_LABEL: Record<AgentStatus, string> = {
  working: "Working",
  thinking: "Thinking",
  done: "Done",
  paused: "Paused",
};

export function FleetView() {
  const agents = useAgents();
  const nodes = useGraphStore((state) => state.nodes);
  const params = useSearchParams();
  const router = useRouter();
  const openId = params.get("open");
  const open = agents.find((agent) => agent.id === openId) ?? null;
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [model, setModel] = useState<AgentModel>("auto");
  const [focus, setFocus] = useState("");

  function openAgent(id: string) {
    router.replace(`/agents?open=${id}`);
  }

  function closeAgent() {
    router.replace("/agents");
  }

  function assign(event: FormEvent) {
    event.preventDefault();
    const id = createAgent({ name, task, model, focusNodeId: focus || null });
    if (!id) return;
    setName("");
    setTask("");
    openAgent(id);
  }

  return (
    <div className="relative h-full overflow-hidden bg-background">
      <div
        className={cn(
          "h-full overflow-auto transition duration-300 ease-out",
          open && "pointer-events-none scale-[1.04] opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Agents</h1>
              <p className="text-sm text-muted-foreground">Several agents can work at once. Each one keeps its own context.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => assignKismetAgents()}>
              Have Kismet assign
            </Button>
          </div>

          <form onSubmit={assign} className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Agent name"
              className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <input
              value={task}
              onChange={(event) => setTask(event.target.value)}
              placeholder="What should it work on?"
              className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <ModelSelect value={model} onChange={setModel} />
            <select
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Anywhere on the graph</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
            <Button type="submit" className="h-9">
              <Plus className="mr-1 h-4 w-4" />
              Assign
            </Button>
          </form>

          {agents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
              No agents yet. Assign one, or let Kismet split the work across the graph.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <button type="button" onClick={() => openAgent(agent.id)} className="flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-foreground/20">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: agent.color }} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{agent.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{agent.task}</div>
                      </div>
                      <StatusPill status={agent.status} />
                    </div>
                    <p className="min-h-10 text-sm leading-snug text-foreground">{agent.activity}</p>
                    <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{agent.routeLabel || labelFor(agent.model)}</span>
                      <span>{where(agent)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {open && <AgentRoom agent={open} onClose={closeAgent} />}
    </div>
  );
}

function AgentRoom({ agent, onClose }: { agent: FleetAgent; onClose: () => void }) {
  const [text, setText] = useState("");

  function send(event: FormEvent) {
    event.preventDefault();
    const next = text;
    setText("");
    talkToAgent(agent.id, next);
  }

  return (
    <div className="absolute inset-0 z-10 flex origin-center animate-[agent-zoom_220ms_ease-out] flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
          All agents
        </button>
        <span className="h-3 w-3 rounded-full" style={{ background: agent.color }} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{agent.name}</div>
          <div className="truncate text-xs text-muted-foreground">{agent.task}</div>
        </div>
        <StatusPill status={agent.status} />
        <div className="ml-auto flex items-center gap-2">
          <ModelSelect value={agent.model} onChange={(model) => setAgentModel(agent.id, model)} />
          {agent.status === "paused" || agent.status === "done" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setAgentStatus(agent.id, "working")}>
              <Play className="mr-1 h-3.5 w-3.5" />
              Resume
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setAgentStatus(agent.id, "paused")}>
              <Pause className="mr-1 h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setAgentStatus(agent.id, "done")}>
            <Square className="mr-1 h-3.5 w-3.5" />
            Done
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { removeAgent(agent.id); onClose(); }}>
            Remove
          </Button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-auto px-4 py-4">
        <p className="text-sm text-muted-foreground">{agent.activity}</p>
        {agent.messages.map((message) => (
          <div key={message.id} className={cn("max-w-2xl rounded-2xl px-3 py-2 text-sm leading-relaxed", message.role === "user" ? "ml-auto bg-foreground text-background" : "bg-muted")}>
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3 pr-16">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Message ${agent.name}`}
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={!text.trim() || agent.status === "thinking"}>
          Send
        </Button>
      </form>
    </div>
  );
}

function ModelSelect({ value, onChange }: { value: AgentModel; onChange: (model: AgentModel) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as AgentModel)}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      aria-label="Model"
    >
      <option value="auto">Auto</option>
      <option value="claude">Claude</option>
      <option value="openai">OpenAI</option>
    </select>
  );
}

function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "done" && "bg-emerald-100 text-emerald-800",
        status === "thinking" && "bg-amber-100 text-amber-800",
        status === "paused" && "bg-muted text-muted-foreground",
        status === "working" && "bg-sky-100 text-sky-800",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function where(agent: FleetAgent): string {
  if (!agent.focusNodeId) return "Graph";
  return getGraphNode(agent.focusNodeId)?.title ?? "Graph";
}

function labelFor(model: AgentModel): string {
  if (model === "claude") return "Claude";
  if (model === "openai") return "OpenAI";
  return "Auto";
}

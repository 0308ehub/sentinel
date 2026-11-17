"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { AgentMark } from "@/components/inbox/agent-mark";
import { markLetter } from "@/lib/inbox/roster";
import type { InboxAgent, InboxThread } from "@/lib/inbox/types";

export function ContactSheet({
  thread,
  onClose,
  onSave,
  onPin,
  onMute,
  onTalk,
  onDelete,
}: {
  thread: InboxThread;
  onClose: () => void;
  onSave: (patch: { name: string; icon: string; color: string; instructions: string; spec: string }) => void;
  onPin: () => void;
  onMute: () => void;
  onTalk: () => void;
  onDelete: () => void;
}) {
  const agent = thread.agents[0];
  const direct = thread.kind === "direct" && agent;
  const [name, setName] = useState(direct ? agent.name : thread.title);
  const [letter, setLetter] = useState(direct ? markLetter(agent.icon, agent.name) : "");
  const [color, setColor] = useState(direct ? agent.color : "#6e8caf");
  const [instructions, setInstructions] = useState(direct ? agent.instructions : "");
  const [spec, setSpec] = useState(direct ? agent.spec : "");

  function save(event: FormEvent) {
    event.preventDefault();
    if (!direct) return;
    onSave({ name, icon: markLetter(letter, name), color, instructions, spec });
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm text-primary">Done</button>
        <p className="text-sm font-medium">Contact</p>
        <span className="w-10" />
      </div>
      <form onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col items-center gap-3 pt-2">
          {direct ? (
            <AgentMark name={name || agent.name} icon={letter} color={color} size={84} />
          ) : (
            <p className="text-sm font-medium">{thread.title}</p>
          )}
        </div>
        {direct ? (
          <>
            <Field label="Name">
              <input value={name} onChange={(event) => setName(event.target.value)} className="h-9 w-full bg-transparent text-sm outline-none" />
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Letter">
                <input value={letter} maxLength={1} onChange={(event) => setLetter(markLetter(event.target.value, name))} className="h-9 w-full bg-transparent text-center text-sm outline-none" />
              </Field>
              <Field label="Color">
                <input type="color" value={color} aria-label="Color" onChange={(event) => setColor(event.target.value)} className="h-9 w-12 bg-transparent" />
              </Field>
            </div>
            <Field label="Description">
              <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={4} className="w-full resize-none bg-transparent text-sm outline-none" />
            </Field>
            <Field label="Specifications">
              <textarea value={spec} onChange={(event) => setSpec(event.target.value)} rows={4} className="w-full resize-none bg-transparent text-sm outline-none" />
            </Field>
            <button type="submit" className="h-9 w-full rounded-full bg-primary text-sm text-primary-foreground">Save</button>
          </>
        ) : (
          <ul className="space-y-2">
            {thread.agents.map((member) => (
              <Member key={member.id} agent={member} />
            ))}
          </ul>
        )}
        <div className="overflow-hidden rounded-xl border border-border text-sm">
          <Row label={thread.pinned ? "Unpin" : "Pin"} onClick={onPin} />
          {direct && <Row label={agent.muted ? "Unmute" : "Mute"} onClick={onMute} />}
          {direct && <Row label={agent.boost > 1 ? `Talk more · ${agent.boost.toFixed(2)}` : "Talk more"} onClick={onTalk} />}
          <Row label="Delete conversation" onClick={onDelete} danger />
        </div>
      </form>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block rounded-xl border border-border px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full border-t border-border px-3 py-2.5 text-left first:border-t-0 ${danger ? "text-red-500" : ""}`}>
      {label}
    </button>
  );
}

function Member({ agent }: { agent: InboxAgent }) {
  return (
    <li className="flex items-center gap-2">
      <AgentMark name={agent.name} icon={agent.icon} color={agent.color} size={32} />
      <span className="text-sm">{agent.name}</span>
    </li>
  );
}

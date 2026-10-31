"use client";

import { FormEvent, ReactNode, useState } from "react";
import Link from "next/link";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { figmaEmbed, type LivingDoc, type PrdCheck, type PrdMilestone, type PrdStage } from "@/lib/prd/document";

export interface StoryEvidence {
  id: string;
  type: string;
  title: string;
  detail: string;
  href?: string;
}

export interface StoryLink {
  id: string;
  type: string;
  title: string;
  href: string;
}

export interface StoryAgent {
  id: string;
  name: string;
  color: string;
  activity: string;
  status: string;
}

const STAGES: { id: PrdStage; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "problem", label: "Problem review" },
  { id: "solution", label: "Solution review" },
  { id: "launch", label: "Launch review" },
  { id: "launched", label: "Launched" },
];

const CONTENTS = [
  ["introduction", "Introduction"],
  ["goals", "Goals"],
  ["non-goals", "Non-goals"],
  ["overview", "Overview"],
  ["design", "Detailed design"],
  ["requirements", "Requirements"],
  ["security", "Security"],
  ["privacy", "Privacy"],
  ["testing", "Testing"],
  ["milestones", "Key milestones"],
  ["checklist", "Launch checklist"],
  ["table", "Metrics"],
  ["code", "Reference implementation"],
  ["record", "Record"],
  ["sources", "Sources"],
];

export function PrdStory({
  editing,
  title,
  doc,
  evidence,
  links,
  agents,
  asking,
  writing,
  pending,
  onTitle,
  onCommitTitle,
  onChange,
  onCommit,
  onAsk,
  onWrite,
  onApply,
  toolbar,
}: {
  editing: boolean;
  title: string;
  doc: LivingDoc;
  evidence: StoryEvidence[];
  links: StoryLink[];
  agents: StoryAgent[];
  asking?: boolean;
  writing?: boolean;
  pending?: StoryEvidence[];
  onTitle?: (value: string) => void;
  onCommitTitle?: () => void;
  onChange?: (doc: LivingDoc) => void;
  onCommit?: (doc: LivingDoc) => void;
  onAsk?: () => void;
  onWrite?: () => void;
  onApply?: () => void;
  toolbar?: ReactNode;
}) {
  const embed = figmaEmbed(doc.figmaUrl);
  const [dragId, setDragId] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const stage = STAGES.find((item) => item.id === doc.stage)?.label ?? "Draft";

  function edit(patch: Partial<LivingDoc>, commit = false) {
    const next = { ...doc, ...patch };
    onChange?.(next);
    if (commit) onCommit?.(next);
  }

  function moveMilestone(id: string, targetId: string) {
    if (id === targetId) return;
    const from = doc.milestones.findIndex((item) => item.id === id);
    const to = doc.milestones.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const milestones = [...doc.milestones];
    const [item] = milestones.splice(from, 1);
    if (!item) return;
    milestones.splice(to, 0, item);
    edit({ milestones }, true);
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-5xl items-start gap-10 px-8 py-10">
        <article className="min-w-0 flex-1 text-[15px] leading-7 text-foreground">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-muted-foreground">Product requirements</p>
            <div className="flex items-center gap-3">{toolbar}</div>
          </div>

          {editing ? (
            <input
              value={title}
              onChange={(event) => onTitle?.(event.target.value)}
              onBlur={onCommitTitle}
              aria-label="Title"
              placeholder="Document title"
              className="mt-6 w-full bg-transparent text-[2rem] font-medium leading-tight tracking-[-0.02em] outline-none"
            />
          ) : (
            <h1 className="mt-6 text-[2rem] font-medium leading-tight tracking-[-0.02em]">{title}</h1>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {editing ? (
              <select
                value={doc.stage}
                onChange={(event) => edit({ stage: event.target.value as PrdStage }, true)}
                aria-label="Document stage"
                className="bg-transparent outline-none"
              >
                {STAGES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <span>{stage}</span>
            )}
            <label className="inline-flex items-center gap-1">
              Version
              {editing ? (
                <input
                  value={doc.version}
                  onChange={(event) => edit({ version: event.target.value })}
                  onBlur={(event) => onCommit?.({ ...doc, version: event.target.value })}
                  aria-label="Version"
                  className="w-14 bg-transparent outline-none"
                />
              ) : (
                <span>{doc.version}</span>
              )}
            </label>
            <div className="flex items-center gap-1">
              {doc.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() =>
                    editing &&
                    edit(
                      { reactions: doc.reactions.map((item) => (item.emoji === reaction.emoji ? { ...item, count: item.count + 1 } : item)) },
                      true
                    )
                  }
                  className="rounded border border-transparent px-1.5 py-0.5 text-xs text-muted-foreground hover:border-border hover:text-foreground"
                >
                  {reaction.emoji}
                  {reaction.count > 0 ? ` ${reaction.count}` : ""}
                </button>
              ))}
            </div>
          </div>

          {editing && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={doc.autoUpdate}
                  onChange={(event) => edit({ autoUpdate: event.target.checked }, true)}
                />
                Record Slack, meetings, and tickets on this document
              </label>
              {onWrite && (
                <button type="button" onClick={onWrite} disabled={writing} className="text-brand disabled:opacity-50">
                  {writing ? "Writing…" : "Write from sources"}
                </button>
              )}
              {onAsk && (
                <button type="button" onClick={onAsk} disabled={asking} className="text-muted-foreground disabled:opacity-50">
                  {asking ? "Commenting…" : "Comment"}
                </button>
              )}
            </div>
          )}

          {(pending?.length ?? 0) > 0 && !doc.autoUpdate && onApply && (
            <div className="mt-4 text-sm">
              <p>
                {pending!.length} {pending!.length === 1 ? "source is" : "sources are"} not in the record yet.
              </p>
              <button type="button" onClick={onApply} className="mt-1 text-brand">
                Add them to the record
              </button>
            </div>
          )}

          <Section n="1" id="introduction" title="Introduction">
            <Prose editing={editing} value={doc.introduction} label="Introduction" placeholder="Background, the problem, and who it is for." onChange={(introduction) => edit({ introduction })} onCommit={(introduction) => onCommit?.({ ...doc, introduction })} />
          </Section>
          <Section n="2" id="goals" title="Goals">
            <Prose editing={editing} value={doc.goals} label="Goals" placeholder="What success looks like, and how it will be measured." onChange={(goals) => edit({ goals })} onCommit={(goals) => onCommit?.({ ...doc, goals })} />
          </Section>
          <Section n="3" id="non-goals" title="Non-goals">
            <Prose editing={editing} value={doc.nonGoals} label="Non-goals" placeholder="What this document does not cover." onChange={(nonGoals) => edit({ nonGoals })} onCommit={(nonGoals) => onCommit?.({ ...doc, nonGoals })} />
          </Section>
          <Section n="4" id="overview" title="Overview">
            <Prose editing={editing} value={doc.overview} label="Overview" placeholder="How the product behaves, in plain language." onChange={(overview) => edit({ overview })} onCommit={(overview) => onCommit?.({ ...doc, overview })} />
          </Section>
          <Section n="5" id="design" title="Detailed design">
            <Prose editing={editing} value={doc.design} label="Detailed design" placeholder="The behavior, the states, and the edge cases." onChange={(design) => edit({ design })} onCommit={(design) => onCommit?.({ ...doc, design })} />
            {editing && (
              <input
                value={doc.figmaUrl}
                onChange={(event) => edit({ figmaUrl: event.target.value })}
                onBlur={(event) => onCommit?.({ ...doc, figmaUrl: event.target.value })}
                aria-label="Figma link"
                placeholder="Figma link"
                className="mt-4 h-8 w-full border-b border-border bg-transparent text-sm outline-none"
              />
            )}
            {embed ? (
              <div className="mt-4 overflow-hidden border border-border">
                <iframe title="Figma" src={embed} className="h-[440px] w-full" allowFullScreen />
                <a href={doc.figmaUrl} target="_blank" rel="noreferrer" className="block border-t border-border px-3 py-1.5 text-sm text-brand">
                  Open in Figma
                </a>
              </div>
            ) : (
              doc.figmaUrl && <p className="mt-3 text-sm text-muted-foreground">That link is not a Figma file.</p>
            )}
          </Section>

          <Section n="6" id="requirements" title="Requirements">
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="w-16 py-1.5 font-medium">No.</th>
                  <th className="py-1.5 font-medium">Requirement</th>
                  <th className="w-16 py-1.5 font-medium">P</th>
                  {editing && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {doc.requirements.map((item, index) => (
                  <tr key={item.id} className="border-b border-border align-top">
                    <td className="py-2 text-muted-foreground">1.{index + 1}</td>
                    <td className="py-2 pr-3">
                      {editing ? (
                        <textarea
                          value={item.text}
                          onChange={(event) =>
                            edit({ requirements: doc.requirements.map((row) => (row.id === item.id ? { ...row, text: event.target.value } : row)) })
                          }
                          onBlur={(event) =>
                            onCommit?.({
                              ...doc,
                              requirements: doc.requirements.map((row) => (row.id === item.id ? { ...row, text: event.target.value } : row)),
                            })
                          }
                          aria-label={`Requirement 1.${index + 1}`}
                          rows={2}
                          placeholder="The product shall …"
                          className="w-full resize-none bg-transparent leading-6 outline-none"
                        />
                      ) : (
                        item.text
                      )}
                    </td>
                    <td className="py-2">
                      {editing ? (
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={item.priority}
                          onChange={(event) =>
                            edit({
                              requirements: doc.requirements.map((row) =>
                                row.id === item.id ? { ...row, priority: Number(event.target.value) || 1 } : row
                              ),
                            })
                          }
                          onBlur={() => onCommit?.(doc)}
                          aria-label={`Priority 1.${index + 1}`}
                          className="w-12 bg-transparent outline-none"
                        />
                      ) : (
                        item.priority
                      )}
                    </td>
                    {editing && (
                      <td className="py-2">
                        <button
                          type="button"
                          aria-label="Remove requirement"
                          onClick={() => edit({ requirements: doc.requirements.filter((row) => row.id !== item.id) }, true)}
                          className="text-muted-foreground"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {doc.requirements.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No requirements yet.</p>}
            {editing && (
              <button
                type="button"
                onClick={() => edit({ requirements: [...doc.requirements, { id: crypto.randomUUID(), text: "", priority: 5 }] }, true)}
                className="mt-2 inline-flex items-center gap-1 text-sm text-brand"
              >
                <Plus className="h-3.5 w-3.5" />
                Add requirement
              </button>
            )}
          </Section>

          <Section n="7" id="security" title="Security">
            <Prose editing={editing} value={doc.security} label="Security" placeholder="Access, data handling, and what must not leak." onChange={(security) => edit({ security })} onCommit={(security) => onCommit?.({ ...doc, security })} />
          </Section>
          <Section n="8" id="privacy" title="Privacy">
            <Prose editing={editing} value={doc.privacy} label="Privacy" placeholder="What is collected, why, and who can see it." onChange={(privacy) => edit({ privacy })} onCommit={(privacy) => onCommit?.({ ...doc, privacy })} />
          </Section>
          <Section n="9" id="testing" title="Testing">
            <Prose editing={editing} value={doc.testing} label="Testing" placeholder="How this will be verified before launch." onChange={(testing) => edit({ testing })} onCommit={(testing) => onCommit?.({ ...doc, testing })} />
          </Section>

          <Section n="10" id="milestones" title="Key milestones">
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="w-8" />
                  <th className="py-1.5 font-medium">Milestone</th>
                  <th className="w-36 py-1.5 font-medium">Date</th>
                  {editing && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {doc.milestones.map((milestone) => (
                  <tr
                    key={milestone.id}
                    draggable={editing}
                    onDragStart={() => setDragId(milestone.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragId) moveMilestone(dragId, milestone.id);
                      setDragId(null);
                    }}
                    className="border-b border-border"
                  >
                    <td className="py-1.5 text-muted-foreground">{editing && <GripVertical className="h-3.5 w-3.5" />}</td>
                    <td className="py-1.5 pr-3">
                      <MilestoneLabel editing={editing} milestone={milestone} doc={doc} onChange={onChange} onCommit={onCommit} />
                    </td>
                    <td className="py-1.5">
                      {editing ? (
                        <input
                          type="date"
                          value={milestone.date}
                          onChange={(event) => edit({ milestones: replaceMilestone(doc.milestones, { ...milestone, date: event.target.value }) })}
                          onBlur={(event) => onCommit?.({ ...doc, milestones: replaceMilestone(doc.milestones, { ...milestone, date: event.target.value }) })}
                          aria-label="Date"
                          className="bg-transparent outline-none"
                        />
                      ) : (
                        milestone.date
                      )}
                    </td>
                    {editing && (
                      <td>
                        <button type="button" aria-label="Remove milestone" onClick={() => edit({ milestones: doc.milestones.filter((item) => item.id !== milestone.id) }, true)} className="text-muted-foreground">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {editing && (
              <button type="button" onClick={() => edit({ milestones: [...doc.milestones, { id: crypto.randomUUID(), label: "", date: "" }] }, true)} className="mt-2 inline-flex items-center gap-1 text-sm text-brand">
                <Plus className="h-3.5 w-3.5" />
                Add milestone
              </button>
            )}
          </Section>

          <Section n="11" id="checklist" title="Launch checklist">
            <ul className="mt-3 space-y-1.5">
              {doc.checklist.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!editing}
                    onChange={() => edit({ checklist: doc.checklist.map((row) => (row.id === item.id ? { ...row, done: !row.done } : row)) }, true)}
                    aria-label={item.label || "Checklist item"}
                    className="mt-1.5"
                  />
                  {editing ? (
                    <input
                      value={item.label}
                      onChange={(event) => edit({ checklist: replaceCheck(doc.checklist, { ...item, label: event.target.value }) })}
                      onBlur={(event) => onCommit?.({ ...doc, checklist: replaceCheck(doc.checklist, { ...item, label: event.target.value }) })}
                      placeholder="Checklist item"
                      className="w-full bg-transparent outline-none"
                    />
                  ) : (
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                  )}
                  {editing && (
                    <button type="button" aria-label="Remove checklist item" onClick={() => edit({ checklist: doc.checklist.filter((row) => row.id !== item.id) }, true)} className="text-muted-foreground">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {editing && (
              <button type="button" onClick={() => edit({ checklist: [...doc.checklist, { id: crypto.randomUUID(), label: "", done: false }] }, true)} className="mt-2 inline-flex items-center gap-1 text-sm text-brand">
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            )}
          </Section>

          <Section n="12" id="table" title="Metrics">
            <MetricTable editing={editing} doc={doc} onChange={onChange} onCommit={onCommit} />
          </Section>

          <Section n="13" id="code" title="Reference implementation">
            {editing ? (
              <textarea
                value={doc.snippet}
                onChange={(event) => edit({ snippet: event.target.value })}
                onBlur={(event) => onCommit?.({ ...doc, snippet: event.target.value })}
                aria-label="Code"
                rows={6}
                spellCheck={false}
                placeholder={"console.log('expected result')"}
                className="mt-3 w-full resize-y bg-muted px-3 py-2 font-mono text-[13px] leading-6 outline-none"
              />
            ) : (
              <pre className="mt-3 overflow-auto bg-muted px-3 py-2 font-mono text-[13px] leading-6">{doc.snippet || "No snippet."}</pre>
            )}
            {editing && doc.snippet.trim() && (
              <button
                type="button"
                onClick={() => setOutput(runSnippet(doc.snippet))}
                className="mt-2 text-sm text-brand"
              >
                Run
              </button>
            )}
            {output && <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{output}</pre>}
          </Section>

          <Section n="14" id="record" title="Record">
            <Prose editing={editing} value={doc.record} label="Record" placeholder="Dated notes from Slack, meetings, and tickets." onChange={(record) => edit({ record })} onCommit={(record) => onCommit?.({ ...doc, record })} />
          </Section>

          <Section n="15" id="sources" title="Sources">
            {evidence.length === 0 ? (
              <p className="text-muted-foreground">Nothing on the graph is linked to this document yet.</p>
            ) : (
              <ol className="list-decimal space-y-3 pl-5">
                {evidence.map((item) => (
                  <li key={item.id}>
                    <span className="text-muted-foreground">{item.type.replace(/_/g, " ").toLowerCase()}. </span>
                    {item.href ? (
                      <Link href={item.href} className="underline underline-offset-2">
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                    {item.detail && <p className="text-muted-foreground">{item.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
            {links.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Also linked: {links.map((item) => item.title).join(", ")}.
              </p>
            )}
          </Section>

          {(doc.comments.length > 0 || agents.length > 0) && (
            <section className="mt-12 border-t border-border pt-6">
              <h2 className="text-base font-semibold">Comments</h2>
              <div className="mt-3 space-y-3">
                {agents.map((agent) => (
                  <p key={agent.id}>
                    <span className="font-medium">{agent.name}.</span> {agent.activity}
                  </p>
                ))}
                {doc.comments.map((comment) => (
                  <p key={comment.id}>
                    <span className="font-medium">{comment.author}.</span> {comment.body}
                  </p>
                ))}
              </div>
            </section>
          )}
        </article>

        <nav className="sticky top-8 hidden w-44 shrink-0 text-[13px] leading-6 md:block">
          <p className="mb-2 text-muted-foreground">Contents</p>
          {CONTENTS.map(([id, label], index) => (
            <a key={id} href={`#${id}`} className="block text-foreground/80 hover:text-foreground">
              {index + 1}. {label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Section({ n, id, title, children }: { n: string; id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="border-b border-border pb-1 text-base font-semibold">
        {n}. {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Prose({
  editing,
  value,
  label,
  placeholder,
  onChange,
  onCommit,
}: {
  editing: boolean;
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
}) {
  if (!editing) return <p className="whitespace-pre-wrap">{value || <span className="text-muted-foreground">Not specified.</span>}</p>;
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onCommit(event.target.value)}
      aria-label={label}
      placeholder={placeholder}
      rows={Math.max(3, value.split("\n").length)}
      className="w-full resize-y bg-transparent leading-7 outline-none"
    />
  );
}

function MilestoneLabel({
  editing,
  milestone,
  doc,
  onChange,
  onCommit,
}: {
  editing: boolean;
  milestone: PrdMilestone;
  doc: LivingDoc;
  onChange?: (doc: LivingDoc) => void;
  onCommit?: (doc: LivingDoc) => void;
}) {
  if (!editing) return <>{milestone.label}</>;
  return (
    <input
      value={milestone.label}
      onChange={(event) => onChange?.({ ...doc, milestones: replaceMilestone(doc.milestones, { ...milestone, label: event.target.value }) })}
      onBlur={(event) => onCommit?.({ ...doc, milestones: replaceMilestone(doc.milestones, { ...milestone, label: event.target.value }) })}
      aria-label="Milestone"
      placeholder="Milestone"
      className="w-full bg-transparent outline-none"
    />
  );
}

function MetricTable({
  editing,
  doc,
  onChange,
  onCommit,
}: {
  editing: boolean;
  doc: LivingDoc;
  onChange?: (doc: LivingDoc) => void;
  onCommit?: (doc: LivingDoc) => void;
}) {
  const width = doc.table.headers.length;
  const numeric = doc.table.rows
    .map((row) => ({ label: row.cells[0] ?? "", value: Number(row.cells[width - 1]) }))
    .filter((row) => row.label && Number.isFinite(row.value));
  const max = Math.max(...numeric.map((row) => row.value), 0);

  function setCell(rowId: string, index: number, value: string) {
    const table = {
      ...doc.table,
      rows: doc.table.rows.map((row) => (row.id === rowId ? { ...row, cells: row.cells.map((cell, cellIndex) => (cellIndex === index ? value : cell)) } : row)),
    };
    onChange?.({ ...doc, table });
  }

  return (
    <div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {doc.table.headers.map((header) => (
              <th key={header} className="py-1.5 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.table.rows.map((row) => (
            <tr key={row.id} className="border-b border-border">
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`} className="py-1.5 pr-3">
                  {editing ? (
                    <input
                      value={cell}
                      onChange={(event) => setCell(row.id, index, event.target.value)}
                      onBlur={() => onCommit?.({ ...doc, table: doc.table })}
                      aria-label={doc.table.headers[index] ?? "Cell"}
                      className="w-full bg-transparent outline-none"
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <button
          type="button"
          onClick={() =>
            onCommit?.({
              ...doc,
              table: { ...doc.table, rows: [...doc.table.rows, { id: crypto.randomUUID(), cells: Array(width).fill("") }] },
            })
          }
          className="mt-2 inline-flex items-center gap-1 text-sm text-brand"
        >
          <Plus className="h-3.5 w-3.5" />
          Add row
        </button>
      )}
      {numeric.length > 0 && max > 0 && (
        <div className="mt-4 space-y-1.5">
          {numeric.map((row) => (
            <div key={row.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
              <span className="truncate">{row.label}</span>
              <span className="h-2 bg-muted">
                <span className="block h-2 bg-foreground/70" style={{ width: `${(row.value / max) * 100}%` }} />
              </span>
              <span className="text-right text-muted-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function replaceMilestone(items: PrdMilestone[], next: PrdMilestone) {
  return items.map((item) => (item.id === next.id ? next : item));
}

function replaceCheck(items: PrdCheck[], next: PrdCheck) {
  return items.map((item) => (item.id === next.id ? next : item));
}

function runSnippet(code: string): string {
  const logs: string[] = [];
  try {
    const fn = new Function("console", `"use strict";\n${code}`);
    const result = fn({ log: (...args: unknown[]) => logs.push(args.map((item) => String(item)).join(" ")) });
    if (result !== undefined) logs.push(String(result));
    return logs.join("\n") || "Done.";
  } catch (error) {
    return error instanceof Error ? error.message : "The snippet failed.";
  }
}

export function ShareGate({
  title,
  detail,
  error,
  onSubmit,
}: {
  title: string;
  detail: string;
  error?: string;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      setLocalError("Enter the work email this was shared to.");
      return;
    }
    setLocalError("");
    onSubmit(email.trim().toLowerCase());
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 max-w-md px-6">
      <p className="text-sm text-muted-foreground">Product requirements</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        aria-label="Work email"
        className="mt-4 h-10 w-full border border-input bg-background px-3 text-sm outline-none"
      />
      {(localError || error) && <p className="mt-2 text-sm text-muted-foreground">{localError || error}</p>}
      <button type="submit" className="mt-3 h-9 bg-foreground px-3 text-sm text-background">
        View document
      </button>
    </form>
  );
}

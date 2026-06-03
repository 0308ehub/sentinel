"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Users, Sparkles, Loader2, Pencil, Trash2, Check, X, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { InterviewGuide, InterviewQuestion, InterviewSession } from "@prisma/client";

type GuideWithRelations = InterviewGuide & {
  questions: InterviewQuestion[];
  sessions: InterviewSession[];
};

interface SynthesisData {
  generatedAt: string;
  sessionCount: number;
  themes: { title: string; summary: string }[];
  patterns: { observation: string; frequency: string }[];
  quotes: { interviewee: string; quote: string; context: string }[];
  nextSteps: string[];
}

export function GuideDetailClient({ workspaceId, guide: initialGuide }: { workspaceId: string; guide: GuideWithRelations }) {
  const [guide, setGuide] = useState(initialGuide);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ theme: "", question: "", probe: "" });
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(initialGuide.synthesis as SynthesisData | null);

  async function saveQuestions(questions: InterviewQuestion[]) {
    const res = await fetch(`/api/workspaces/${workspaceId}/interview-guide/${guide.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: questions.map((q) => ({ theme: q.theme, question: q.question, probe: q.probe ?? undefined })) }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error?.message ?? "Save failed");
    setGuide(data.data as GuideWithRelations);
  }

  async function commitEdit(idx: number) {
    const updated = guide.questions.map((q, i) =>
      i === idx ? { ...q, theme: editDraft.theme, question: editDraft.question, probe: editDraft.probe || null } : q
    );
    try { await saveQuestions(updated); setEditingIdx(null); toast.success("Question updated"); }
    catch { toast.error("Failed to save"); }
  }

  async function deleteQuestion(idx: number) {
    try { await saveQuestions(guide.questions.filter((_, i) => i !== idx)); toast.success("Question removed"); }
    catch { toast.error("Failed to remove"); }
  }

  async function addQuestion() {
    const placeholder = { id: `tmp-${Date.now()}`, guideId: guide.id, theme: "General", question: "New question", probe: null, order: guide.questions.length } as InterviewQuestion;
    try {
      await saveQuestions([...guide.questions, placeholder]);
      setEditingIdx(guide.questions.length);
      setEditDraft({ theme: "General", question: "New question", probe: "" });
    } catch { toast.error("Failed to add question"); }
  }

  async function handleSynthesize() {
    if (guide.sessions.length === 0) { toast.error("Add at least one session before synthesizing."); return; }
    setSynthesizing(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/interview-guide/${guide.id}/synthesize`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? "Synthesis failed");
      setSynthesis(data.data.synthesis as SynthesisData);
      toast.success("Synthesis complete — saved as a workspace document.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Synthesis failed"); }
    finally { setSynthesizing(false); }
  }

  const grouped = guide.questions.reduce((acc, q, idx) => {
    const t = q.theme || "General";
    if (!acc[t]) acc[t] = [];
    acc[t].push({ q, idx });
    return acc;
  }, {} as Record<string, { q: InterviewQuestion; idx: number }[]>);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Link href={`/workspaces/${workspaceId}/interview-guide`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{guide.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className="text-xs bg-indigo-500/10 text-indigo-400 border-0">{guide.interviewType}</Badge>
              <span className="text-xs text-muted-foreground">{guide.customerSegment}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/new`}>
            <Button size="sm" variant="outline" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Session</Button>
          </Link>
          <Button size="sm" onClick={handleSynthesize} disabled={synthesizing || guide.sessions.length === 0} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            {synthesizing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Synthesizing…</> : <><Sparkles className="h-3.5 w-3.5" /> Synthesize All</>}
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-5xl">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Questions ({guide.questions.length})</h2>
            <Button variant="ghost" size="sm" onClick={addQuestion} className="gap-1.5 text-indigo-600 text-xs"><Plus className="h-3.5 w-3.5" /> Add Question</Button>
          </div>
          <div className="space-y-4">
            {Object.entries(grouped).map(([theme, items]) => (
              <div key={theme}>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />{theme}
                </p>
                <div className="space-y-2 ml-3">
                  {items.map(({ q, idx }) =>
                    editingIdx === idx ? (
                      <div key={q.id} className="bg-card border border-indigo-500/30 rounded-xl px-4 py-3 space-y-2">
                        <input autoFocus className="w-full text-sm bg-transparent border-b border-border focus:border-indigo-500 outline-none pb-1 text-foreground" value={editDraft.question} onChange={(e) => setEditDraft((d) => ({ ...d, question: e.target.value }))} placeholder="Question" />
                        <div className="flex gap-2">
                          <input className="flex-1 text-xs bg-transparent border-b border-border focus:border-indigo-500 outline-none pb-1 text-muted-foreground" value={editDraft.theme} onChange={(e) => setEditDraft((d) => ({ ...d, theme: e.target.value }))} placeholder="Theme" />
                          <input className="flex-1 text-xs bg-transparent border-b border-border focus:border-indigo-500 outline-none pb-1 text-muted-foreground" value={editDraft.probe} onChange={(e) => setEditDraft((d) => ({ ...d, probe: e.target.value }))} placeholder="Follow-up probe (optional)" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)} className="h-7 px-2"><X className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" onClick={() => commitEdit(idx)} className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1"><Check className="h-3 w-3" /> Save</Button>
                        </div>
                      </div>
                    ) : (
                      <div key={q.id} className="bg-card rounded-xl border border-border px-4 py-3 flex items-start justify-between gap-3 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed">{q.question}</p>
                          {q.probe && <p className="text-xs text-muted-foreground mt-1 italic">Follow-up: {q.probe}</p>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditDraft({ theme: q.theme, question: q.question, probe: q.probe ?? "" }); setEditingIdx(idx); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-500" onClick={() => deleteQuestion(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Sessions ({guide.sessions.length})</h2>
            <Link href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/new`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-indigo-600 text-xs"><Plus className="h-3.5 w-3.5" /> New Session</Button>
            </Link>
          </div>
          {guide.sessions.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
              <Link href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/new`}><Button variant="link" className="mt-1 text-indigo-600 text-sm">Add your first session</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {guide.sessions.map((session) => (
                <Link key={session.id} href={`/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/${session.id}`}>
                  <div className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between gap-3 hover:border-indigo-300 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-foreground">{session.intervieweeName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[session.intervieweeRole, session.intervieweeCompany].filter(Boolean).join(", ")}
                        {(session.intervieweeRole || session.intervieweeCompany) ? " · " : ""}
                        {formatDate(session.date)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {synthesis && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5" /> Synthesis
              <Badge className="text-xs bg-emerald-500/10 text-emerald-400 border-0 ml-1">{synthesis.sessionCount} sessions</Badge>
            </h2>
            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Themes</p>
                <div className="space-y-2">
                  {synthesis.themes.map((t, i) => (
                    <div key={i} className="bg-indigo-500/5 rounded-lg px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Patterns</p>
                <ul className="space-y-1">
                  {synthesis.patterns.map((p, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />{p.observation}
                      <span className="text-xs text-muted-foreground shrink-0">({p.frequency})</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Notable Quotes</p>
                <div className="space-y-2">
                  {synthesis.quotes.map((q, i) => (
                    <blockquote key={i} className="border-l-2 border-indigo-500/30 pl-3">
                      <p className="text-sm text-foreground italic">&ldquo;{q.quote}&rdquo;</p>
                      <p className="text-xs text-muted-foreground mt-0.5">— {q.interviewee}, {q.context}</p>
                    </blockquote>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Next Steps</p>
                <ol className="space-y-1">
                  {synthesis.nextSteps.map((s, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-indigo-500 font-semibold shrink-0">{i + 1}.</span>{s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

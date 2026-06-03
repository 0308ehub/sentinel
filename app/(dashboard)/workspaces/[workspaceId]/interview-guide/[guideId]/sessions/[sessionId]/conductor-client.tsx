"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2, CheckCircle2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type {
  InterviewGuide,
  InterviewQuestion,
  InterviewSession,
  SessionNote,
} from "@prisma/client";

type SessionWithRelations = InterviewSession & {
  notes: SessionNote[];
  guide: InterviewGuide & { questions: InterviewQuestion[] };
};

export function ConductorClient({
  workspaceId,
  session,
}: {
  workspaceId: string;
  session: SessionWithRelations;
}) {
  const { guide } = session;

  const initialNotes: Record<string, string> = {};
  for (const n of session.notes) {
    initialNotes[n.questionId] = n.content;
  }

  const [notes, setNotes] = useState<Record<string, string>>(initialNotes);
  const [generalNotes, setGeneralNotes] = useState(session.generalNotes ?? "");
  const [activeId, setActiveId] = useState<string | null>(
    guide.questions[0]?.id ?? null
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const grouped = guide.questions.reduce(
    (acc, q) => {
      const t = q.theme || "General";
      if (!acc[t]) acc[t] = [];
      acc[t].push(q);
      return acc;
    },
    {} as Record<string, InterviewQuestion[]>
  );

  const activeQuestion = guide.questions.find((q) => q.id === activeId) ?? null;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const notesPayload = Object.entries(notes).map(([questionId, content]) => ({
        questionId,
        content,
      }));

      const [notesRes, sessionRes] = await Promise.all([
        fetch(
          `/api/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/${session.id}/notes`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: notesPayload }),
          }
        ),
        fetch(
          `/api/workspaces/${workspaceId}/interview-guide/${guide.id}/sessions/${session.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generalNotes }),
          }
        ),
      ]);

      const [notesData, sessionData] = await Promise.all([
        notesRes.json(),
        sessionRes.json(),
      ]);

      if (!notesData.ok) throw new Error(notesData.error?.message ?? "Failed to save notes");
      if (!sessionData.ok) throw new Error(sessionData.error?.message ?? "Failed to save session");

      setSavedAt(new Date());
      toast.success("Notes saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [notes, generalNotes, workspaceId, guide.id, session.id]);

  const noteCount = Object.values(notes).filter((v) => v.trim()).length;
  const totalQuestions = guide.questions.length;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/workspaces/${workspaceId}/interview-guide/${guide.id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {session.intervieweeName}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {[session.intervieweeRole, session.intervieweeCompany]
                .filter(Boolean)
                .join(", ")}
              {(session.intervieweeRole || session.intervieweeCompany) ? " · " : ""}
              {formatDate(session.date)}
              {" · "}
              <span className="text-indigo-400">{guide.title}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {savedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {noteCount}/{totalQuestions} noted
          </span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Save Notes</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="p-3 space-y-4">
            {Object.entries(grouped).map(([theme, questions]) => (
              <div key={theme}>
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-indigo-500" />
                  {theme}
                </p>
                <div className="space-y-0.5">
                  {questions.map((q) => {
                    const hasNote = !!notes[q.id]?.trim();
                    const isActive = q.id === activeId;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setActiveId(q.id)}
                        className={[
                          "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                          isActive
                            ? "bg-indigo-500/15 text-indigo-300"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        ].join(" ")}
                      >
                        <span className="flex items-start gap-2">
                          <span
                            className={[
                              "mt-1 w-1.5 h-1.5 rounded-full shrink-0",
                              hasNote ? "bg-emerald-500" : "bg-border",
                            ].join(" ")}
                          />
                          <span className="line-clamp-2 leading-relaxed">
                            {q.question}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="border-t border-border pt-3">
              <button
                onClick={() => setActiveId(null)}
                className={[
                  "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2",
                  activeId === null
                    ? "bg-indigo-500/15 text-indigo-300"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                ].join(" ")}
              >
                <StickyNote className="h-3.5 w-3.5 shrink-0" />
                General Notes
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {activeQuestion ? (
            <div className="max-w-2xl space-y-4">
              <div className="bg-card rounded-xl border border-border px-5 py-4">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1">
                  {activeQuestion.theme}
                </p>
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  {activeQuestion.question}
                </p>
                {activeQuestion.probe && (
                  <p className="text-xs text-muted-foreground mt-2 italic border-t border-border pt-2">
                    Follow-up: {activeQuestion.probe}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Notes
                </label>
                <textarea
                  autoFocus
                  value={notes[activeQuestion.id] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [activeQuestion.id]: e.target.value }))
                  }
                  placeholder="Type your notes here…"
                  rows={16}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-muted-foreground">
                  {notes[activeQuestion.id]?.length ?? 0} characters
                </span>
                <div className="flex gap-2">
                  {guide.questions.findIndex((q) => q.id === activeId) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const idx = guide.questions.findIndex((q) => q.id === activeId);
                        setActiveId(guide.questions[idx - 1]?.id ?? null);
                      }}
                      className="text-xs"
                    >
                      ← Previous
                    </Button>
                  )}
                  {guide.questions.findIndex((q) => q.id === activeId) <
                    guide.questions.length - 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const idx = guide.questions.findIndex((q) => q.id === activeId);
                        setActiveId(guide.questions[idx + 1]?.id ?? null);
                      }}
                      className="text-xs"
                    >
                      Next →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl space-y-4">
              <div className="bg-card rounded-xl border border-border px-5 py-4">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-indigo-400" />
                  General Notes
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Overall observations, context, or anything not tied to a specific question.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  autoFocus
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Overall impressions, context, rapport notes…"
                  rows={16}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <span className="text-xs text-muted-foreground block">
                {generalNotes.length} characters
              </span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

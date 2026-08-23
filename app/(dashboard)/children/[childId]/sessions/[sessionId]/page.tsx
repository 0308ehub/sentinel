import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ childId: string; sessionId: string }>;
}) {
  const { childId, sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      child: { include: { mentorProfile: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session || session.childId !== childId || session.child.parentId !== user.id) {
    notFound();
  }

  const mentor = session.child.mentorProfile?.mentorName ?? "Mentor";
  const childName = session.child.name;
  const minutes = session.endedAt
    ? Math.max(1, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60_000))
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <header className="space-y-4">
        <Link
          href={`/children/${childId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {childName}
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {session.startedAt.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.messages.length} message{session.messages.length === 1 ? "" : "s"}
            {minutes ? ` · about ${minutes} minutes` : ""}
            {" · "}
            {session.startedAt.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>

        {session.summary && (
          <p className="rounded-lg border-l-2 border-foreground/20 bg-muted/40 px-4 py-3 text-[15px] leading-relaxed">
            {session.summary}
          </p>
        )}
      </header>

      <div className="space-y-5">
        {session.messages.length === 0 && (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No messages in this conversation.
          </p>
        )}

        {session.messages
          .filter((m) => m.role !== "SYSTEM")
          .map((m) => (
            <div key={m.id} className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {m.role === "CHILD" ? childName : mentor}
                {m.safetyFlagged && (
                  <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] normal-case text-destructive">
                    flagged
                  </span>
                )}
              </p>
              <p
                className={
                  m.role === "CHILD"
                    ? "text-[17px] leading-relaxed"
                    : "text-[17px] leading-relaxed text-muted-foreground"
                }
              >
                {m.content}
              </p>
              {m.action && (
                <p className="pt-0.5 font-mono text-[11px] text-muted-foreground/70">
                  {m.action}
                  {m.targetConcept ? ` → ${m.targetConcept}` : ""}
                </p>
              )}
            </div>
          ))}
      </div>

      <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
        This is the complete record of the conversation. Nothing {childName} said is
        withheld from you, and you can delete this history at any time.
      </p>
    </div>
  );
}

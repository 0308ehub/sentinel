import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { AddChildForm } from "./add-child-form";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <p className="text-muted-foreground">Please sign in to continue.</p>
      </div>
    );
  }

  const children = await prisma.child.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { sessions: true, memoryNodes: true, hypotheses: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user.name ? `Hello, ${user.name.split(" ")[0]}` : "Your family"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Each child has their own mentor that learns how they think.
        </p>
      </header>

      {children.length > 0 && (
        <section className="space-y-3">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/children/${c.id}`}
              className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  Age {c.ageYears}
                  {c.gradeLabel ? ` · ${c.gradeLabel}` : ""}
                  {c.interests.length ? ` · likes ${c.interests.slice(0, 2).join(", ")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-6 text-right text-xs text-muted-foreground">
                <div>
                  <div className="text-base font-medium text-foreground">{c._count.sessions}</div>
                  sessions
                </div>
                <div>
                  <div className="text-base font-medium text-foreground">{c._count.memoryNodes}</div>
                  memories
                </div>
                <div>
                  <div className="text-base font-medium text-foreground">{c._count.hypotheses}</div>
                  hypotheses
                </div>
                <span className="text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  →
                </span>
              </div>
            </Link>
          ))}
        </section>
      )}

      <AddChildForm />
    </div>
  );
}

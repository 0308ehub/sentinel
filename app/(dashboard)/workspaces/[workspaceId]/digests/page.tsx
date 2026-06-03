import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart2, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DigestGenerateButton } from "./digest-generate-button";
import type { DigestType } from "@prisma/client";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function digestTitle(type: DigestType, createdAt: Date) {
  const label = type === "DAILY" ? "Daily" : type === "WEEKLY" ? "Weekly" : "Manual";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(createdAt)
  );
  return `${label} Digest — ${date}`;
}

function typeBadgeClass(type: DigestType) {
  switch (type) {
    case "DAILY":
      return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    case "WEEKLY":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "MANUAL":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  }
}

export default async function DigestsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const digests = await prisma.digest.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-indigo-500" />
            Digests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daily AI-generated summaries of workspace activity. Open any digest to chat with Sentinel about it.
          </p>
        </div>
        <DigestGenerateButton workspaceId={workspaceId} />
      </div>

      {digests.length === 0 ? (
        <div className="bg-card rounded-xl border border-dashed p-16 text-center">
          <BarChart2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            No digests yet. Generate one now or wait for the daily cron.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {digests.map((digest) => {
            const title = digestTitle(digest.type, digest.createdAt);
            const preview = digest.content.slice(0, 200).replace(/#+\s/g, "").replace(/\n+/g, " ");
            return (
              <Link
                key={digest.id}
                href={`/workspaces/${workspaceId}/digests/${digest.id}`}
                className="block bg-card rounded-xl border hover:border-indigo-300 hover:shadow-sm transition-all p-5 group"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm text-foreground group-hover:text-indigo-700 transition-colors">
                      {title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeBadgeClass(digest.type)}`}
                    >
                      {digest.type}
                    </span>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {formatDate(digest.createdAt)}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {preview}
                  {digest.content.length > 200 ? "…" : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

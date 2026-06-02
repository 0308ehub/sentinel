import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PRDPageClient } from "./prd-page-client";

export default async function PRDDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; prdId: string }>;
}) {
  const { workspaceId, prdId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const prd = await prisma.pRD.findFirst({
    where: { id: prdId, workspaceId },
    include: {
      opportunity: { select: { id: true, title: true, totalScore: true } },
      tickets: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          priority: true,
          ticketType: true,
          estimate: true,
        },
      },
    },
  });

  if (!prd) {
    notFound();
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={`/workspaces/${workspaceId}/prd`}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-indigo-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          PRDs
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium truncate max-w-xs">
          {prd.title}
        </span>
      </div>

      <PRDPageClient
        prd={{
          id: prd.id,
          content: prd.content,
          title: prd.title,
          createdAt: prd.createdAt.toISOString(),
          opportunity: prd.opportunity,
          tickets: prd.tickets,
        }}
        workspaceId={workspaceId}
      />
    </div>
  );
}

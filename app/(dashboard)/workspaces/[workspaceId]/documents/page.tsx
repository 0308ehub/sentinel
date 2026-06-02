import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import { dispatchIngestion } from "@/server/jobs/dispatch";
import { DocumentsManager } from "@/components/document/documents-manager";

export default async function DocumentsPage({
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

  const documents = await prisma.document.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { chunks: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  // Auto-heal: reset docs stuck in processing for > 5 minutes and re-dispatch
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const STUCK_STATUSES = ["EXTRACTING", "PARSING", "CHUNKING", "EMBEDDING"];
  const stuckDocs = documents.filter(
    (d) => STUCK_STATUSES.includes(d.status) && d.updatedAt < fiveMinutesAgo
  );
  if (stuckDocs.length > 0) {
    await prisma.document.updateMany({
      where: { id: { in: stuckDocs.map((d) => d.id) } },
      data: { status: "PENDING" },
    });
    for (const doc of stuckDocs) {
      dispatchIngestion(doc.id).catch(() => {});
    }
    documents.splice(
      0,
      documents.length,
      ...(await prisma.document.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { chunks: true } },
          uploadedBy: { select: { name: true } },
        },
      }))
    );
  }

  const items = documents.map((d) => ({
    id: d.id,
    workspaceId,
    title: d.title,
    status: d.status,
    sourceType: d.sourceType,
    fileType: d.fileType,
    chunkCount: d._count.chunks,
    createdAt: d.createdAt,
    uploaderName: d.uploadedBy?.name ?? null,
    errorMessage:
      d.status === "FAILED"
        ? ((d.metadata as Record<string, unknown> | null)?.error as string | undefined)
        : undefined,
  }));

  return <DocumentsManager documents={items} workspaceId={workspaceId} />;
}

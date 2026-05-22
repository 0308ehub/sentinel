import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload, FileText } from "lucide-react";
import { DocumentRow } from "@/components/document/document-row";

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

  // Extract stored error message from metadata for FAILED docs
  type DocWithError = (typeof documents)[number] & { errorMessage?: string };
  const docsWithErrors: DocWithError[] = documents.map((d) => ({
    ...d,
    errorMessage: d.status === "FAILED"
      ? ((d.metadata as Record<string, unknown> | null)?.error as string | undefined)
      : undefined,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {documents.length} evidence source{documents.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link href={`/workspaces/${workspaceId}/documents/upload`}>
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              <Upload className="h-4 w-4" /> Upload Evidence
            </Button>
          </Link>
        </div>
      </div>

      {/* File list */}
      {documents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No documents yet</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
              Upload customer interviews, support tickets, feedback exports, or paste text directly.
            </p>
            <Link href={`/workspaces/${workspaceId}/documents/upload`}>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white">Upload first document</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_160px_120px_80px_160px_100px] gap-4 px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-gray-200 mb-1">
            <span>Name</span>
            <span>Source</span>
            <span>Status</span>
            <span>Chunks</span>
            <span>Uploaded</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          <div>
            {docsWithErrors.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={{
                  id: doc.id,
                  title: doc.title,
                  status: doc.status,
                  sourceType: doc.sourceType,
                  fileType: doc.fileType,
                  chunkCount: doc._count.chunks,
                  createdAt: doc.createdAt,
                  uploaderName: doc.uploadedBy?.name,
                  errorMessage: doc.errorMessage,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

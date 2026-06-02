import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Calendar, Layers, Tag } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  FAILED: "bg-red-50 text-red-700 border border-red-200",
  EXTRACTING: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  PARSING: "bg-blue-50 text-blue-700 border border-blue-200",
  CHUNKING: "bg-blue-50 text-blue-700 border border-blue-200",
  EMBEDDING: "bg-blue-50 text-blue-700 border border-blue-200",
};

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
}) {
  const { workspaceId, documentId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const doc = await prisma.document.findFirst({
    where: { id: documentId, workspaceId },
    include: {
      uploadedBy: { select: { name: true } },
      chunks: { orderBy: { index: "asc" }, select: { index: true, content: true, tokenCount: true } },
      extractions: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { chunks: true } },
    },
  });

  if (!doc) notFound();

  const extraction = doc.extractions[0];
  const displayText = doc.rawText ?? doc.chunks.map((c) => c.content).join("\n\n");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0 border-b border-gray-100">
        <Link
          href={`/workspaces/${workspaceId}/documents`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Documents
        </Link>

        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 break-words">{doc.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                {doc.status}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Tag className="h-3 w-3" />
                {doc.sourceType.replace(/_/g, " ")}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Layers className="h-3 w-3" />
                {doc._count.chunks} chunks
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="h-3 w-3" />
                {formatDate(doc.createdAt)}
                {doc.uploadedBy?.name && ` · ${doc.uploadedBy.name}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* AI extraction summary */}
        {extraction?.summary && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-2">AI Summary</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{extraction.summary}</p>
          </div>
        )}

        {/* Raw content */}
        {displayText ? (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Document Content</h2>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto max-h-[60vh] overflow-y-auto">
              {displayText}
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 text-gray-200" />
            <p className="text-sm">
              {doc.status === "COMPLETED"
                ? "No text content stored for this document."
                : "Content will appear once processing is complete."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

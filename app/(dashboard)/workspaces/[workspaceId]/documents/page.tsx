import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkspaceNav } from "@/components/nav/workspace-nav";
import { Upload, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ReprocessButton } from "@/components/document/reprocess-button";

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
      _count: { select: { extractions: true, chunks: true } },
      uploadedBy: { select: { name: true } },
    },
  });

  const statusStyles: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    FAILED: "bg-red-100 text-red-700",
    PARSING: "bg-blue-100 text-blue-700",
    CHUNKING: "bg-blue-100 text-blue-700",
    EMBEDDING: "bg-blue-100 text-blue-700",
    EXTRACTING: "bg-blue-100 text-blue-700",
  };

  return (
    <div>
      <WorkspaceNav workspaceId={workspaceId} />
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="text-sm text-gray-500 mt-1">{documents.length} evidence sources uploaded</p>
          </div>
          <Link href={`/workspaces/${workspaceId}/documents/upload`}>
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              <Upload className="h-4 w-4" /> Upload Evidence
            </Button>
          </Link>
        </div>

        {documents.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed p-16 text-center">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No documents yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Upload customer interviews, support tickets, feedback exports, or paste text directly.
            </p>
            <Link href={`/workspaces/${workspaceId}/documents/upload`}>
              <Button className="bg-violet-600 hover:bg-violet-700 text-white">Upload first document</Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Chunks</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Uploaded</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{doc.title}</p>
                      {doc.uploadedBy?.name && (
                        <p className="text-xs text-gray-400">{doc.uploadedBy.name}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className="text-xs">
                        {doc.sourceType.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {doc._count.chunks}
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(doc.status === "FAILED" || doc.status === "COMPLETED") && (
                          <ReprocessButton documentId={doc.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

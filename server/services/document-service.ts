import { prisma } from "@/lib/db/prisma";
import type { DocumentSourceType } from "@prisma/client";

export async function createDocument(input: {
  workspaceId: string;
  uploadedById: string;
  title: string;
  sourceType: DocumentSourceType;
  fileType?: string;
  rawText?: string;
  storageKey?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.document.create({
    data: {
      workspaceId: input.workspaceId,
      uploadedById: input.uploadedById,
      title: input.title,
      sourceType: input.sourceType,
      fileType: input.fileType,
      rawText: input.rawText,
      storageKey: input.storageKey,
      metadata: input.metadata as Record<string, string> | undefined,
      status: "PENDING",
    },
  });
}

export async function updateDocumentStatus(
  documentId: string,
  status: "PENDING" | "PARSING" | "CHUNKING" | "EMBEDDING" | "EXTRACTING" | "COMPLETED" | "FAILED",
  error?: string
) {
  return prisma.document.update({
    where: { id: documentId },
    data: { status, metadata: error ? { error } : undefined },
  });
}

export async function getDocument(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: { extractions: true, chunks: { select: { id: true, index: true, tokenCount: true } } },
  });
}

export async function getWorkspaceDocuments(workspaceId: string) {
  const docs = await prisma.document.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { extractions: true } },
    },
  });

  // Get pain point count from extractions
  return docs;
}

export async function deleteDocument(documentId: string) {
  return prisma.document.delete({ where: { id: documentId } });
}

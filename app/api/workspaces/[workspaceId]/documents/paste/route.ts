import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { createDocument } from "@/server/services/document-service";
import { apiSuccess, apiError } from "@/types";
import { documentIngestionQueue } from "@/server/jobs/queues";
import type { DocumentSourceType } from "@prisma/client";

const PasteSchema = z.object({
  title: z.string().min(1).max(200),
  text: z.string().min(1).max(100000),
  sourceType: z.enum([
    "PASTE", "INTERVIEW", "SUPPORT_TICKET", "ANALYTICS_EXPORT",
    "SLACK_EXPORT", "SALES_CALL", "USER_FEEDBACK", "INTERNAL_DOC",
    "MARKET_RESEARCH", "UPLOAD",
  ]).default("PASTE"),
  metadata: z.object({
    customer: z.string().optional(),
    segment: z.string().optional(),
    date: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { user } = await requireWorkspaceAccess(workspaceId);

    const body = await request.json();
    const { title, text, sourceType, metadata } = PasteSchema.parse(body);

    const document = await createDocument({
      workspaceId,
      uploadedById: user.id,
      title,
      sourceType: sourceType as DocumentSourceType,
      fileType: "txt",
      rawText: text,
      metadata,
    });

    try {
      await documentIngestionQueue.add("process-document", { documentId: document.id });
    } catch {
      const { processDocument } = await import("@/server/services/ingestion-service");
      processDocument(document.id).catch(console.error);
    }

    return Response.json(apiSuccess({ documentId: document.id, status: "PENDING" }), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input", error.issues), { status: 400 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Failed to create document"), { status: 500 });
  }
}

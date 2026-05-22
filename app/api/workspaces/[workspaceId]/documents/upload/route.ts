import { z } from "zod";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { createDocument } from "@/server/services/document-service";
import { apiSuccess, apiError } from "@/types";
import { dispatchIngestion } from "@/server/jobs/dispatch";
import type { DocumentSourceType } from "@prisma/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { user } = await requireWorkspaceAccess(workspaceId);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const sourceType = (formData.get("sourceType") as DocumentSourceType) ?? "UPLOAD";
    const metadataRaw = formData.get("metadata") as string | null;

    if (!file) {
      return Response.json(apiError("VALIDATION_ERROR", "No file provided"), { status: 400 });
    }

    const maxBytes = parseInt(process.env.UPLOAD_MAX_FILE_MB ?? "20") * 1024 * 1024;
    if (file.size > maxBytes) {
      return Response.json(
        apiError("VALIDATION_ERROR", `File too large. Max ${process.env.UPLOAD_MAX_FILE_MB ?? "20"}MB`),
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileExt = file.name.split(".").pop() ?? "txt";

    // For MVP, store text inline. Production would use object storage.
    const rawText = fileExt === "pdf" ? undefined : buffer.toString("utf-8");
    const storageKey = fileExt === "pdf" ? file.name : undefined;

    let metadata: Record<string, unknown> = {};
    if (metadataRaw) {
      try { metadata = JSON.parse(metadataRaw); } catch { /* ignore */ }
    }

    const document = await createDocument({
      workspaceId,
      uploadedById: user.id,
      title: title || file.name,
      sourceType,
      fileType: fileExt,
      rawText,
      storageKey,
      metadata,
    });

    await dispatchIngestion(document.id);

    return Response.json(apiSuccess({ documentId: document.id, status: "PENDING" }), { status: 201 });
  } catch (error) {
    console.error("[upload]", error);
    return Response.json(apiError("INTERNAL_ERROR", "Upload failed"), { status: 500 });
  }
}

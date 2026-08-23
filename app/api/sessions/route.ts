import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const startSessionSchema = z.object({
  childId: z.string().min(1),
  variant: z.enum(["PRIMER", "CONTROL"]).default("PRIMER"),
});

/** An active session older than this is considered finished. */
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;
const HISTORY_LIMIT = 100;

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Sign in required"), { status: 401 });
  }

  const parsed = startSessionSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json(apiError("INVALID_INPUT", "childId is required"), { status: 400 });

  const child = await prisma.child.findUnique({ where: { id: parsed.data.childId } });
  if (!child || child.parentId !== user.id) {
    return Response.json(apiError("NOT_FOUND", "Child not found"), { status: 404 });
  }
  if (!child.consentGrantedAt) {
    return Response.json(apiError("CONSENT_REQUIRED", "Parental consent is required"), { status: 403 });
  }

  // Resume the session in progress rather than starting a blank one on every visit.
  const existing = await prisma.session.findFirst({
    where: {
      childId: child.id,
      status: "ACTIVE",
      startedAt: { gte: new Date(Date.now() - RESUME_WINDOW_MS) },
    },
    orderBy: { startedAt: "desc" },
  });

  const session =
    existing ??
    (await prisma.session.create({
      data: { childId: child.id, variant: parsed.data.variant },
    }));

  // The child's conversation so far, across sessions — continuity is the product.
  const messages = await prisma.message.findMany({
    where: { session: { childId: child.id } },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
    select: {
      id: true,
      role: true,
      content: true,
      action: true,
      targetConcept: true,
      rationale: true,
      sessionId: true,
      createdAt: true,
    },
  });

  return Response.json(
    apiSuccess({ session, messages, resumed: Boolean(existing) })
  );
}

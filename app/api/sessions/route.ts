import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const startSessionSchema = z.object({
  childId: z.string().min(1),
  variant: z.enum(["PRIMER", "CONTROL"]).default("PRIMER"),
});

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
    return Response.json(apiError("CONSENT_REQUIRED", "Parental consent is required before a session"), { status: 403 });
  }

  const session = await prisma.session.create({
    data: { childId: child.id, variant: parsed.data.variant },
  });
  return Response.json(apiSuccess(session));
}

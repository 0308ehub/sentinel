import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";

const createChildSchema = z.object({
  name: z.string().min(1).max(40),
  ageYears: z.number().int().min(3).max(14),
  gradeLabel: z.string().max(40).optional(),
  readingLevel: z.string().max(60).optional(),
  mathLevel: z.string().max(60).optional(),
  interests: z.array(z.string().max(60)).default([]),
  goals: z.array(z.string().max(120)).default([]),
  strugglesWith: z.array(z.string().max(120)).default([]),
  /** COPPA: the parent must affirm consent before any child interaction. */
  consentGranted: z.literal(true),
});

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Sign in required"), { status: 401 });
  }

  const parsed = createChildSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(apiError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; ")), { status: 400 });
  }
  const { consentGranted: _consent, ...fields } = parsed.data;

  const child = await prisma.child.create({
    data: {
      ...fields,
      parentId: user.id,
      consentGrantedAt: new Date(),
      consentVersion: "2026-08-22",
      mentorProfile: { create: {} },
    },
  });

  return Response.json(apiSuccess(child));
}

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Sign in required"), { status: 401 });
  }
  const children = await prisma.child.findMany({
    where: { parentId: user.id },
    orderBy: { createdAt: "asc" },
  });
  return Response.json(apiSuccess(children));
}

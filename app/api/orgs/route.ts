import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/helpers";
import { apiSuccess, apiError } from "@/types";
import { slugify } from "@/lib/utils";

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { organization: { include: { _count: { select: { workspaces: true } } } } },
    });
    return Response.json(apiSuccess(memberships.map((m) => ({ ...m.organization, role: m.role }))));
  } catch {
    return Response.json(apiError("UNAUTHORIZED", "Not authenticated"), { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { name } = CreateOrgSchema.parse(body);

    const baseSlug = slugify(name);
    let slug = baseSlug;
    let attempt = 0;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });

    return Response.json(apiSuccess(org), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid input", error.issues), { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json(apiError("UNAUTHORIZED", "Not authenticated"), { status: 401 });
    }
    return Response.json(apiError("INTERNAL_ERROR", "Failed to create organization"), { status: 500 });
  }
}

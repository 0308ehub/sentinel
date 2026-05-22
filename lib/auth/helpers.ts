import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/types";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  // First visit after Clerk sign-up — webhook may not have fired yet, so upsert now.
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
      imageUrl: clerkUser.imageUrl ?? null,
    },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireWorkspaceAccess(workspaceId: string) {
  const user = await requireUser();

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: {
        include: {
          memberships: { where: { userId: user.id } },
        },
      },
    },
  });

  if (!workspace || workspace.organization.memberships.length === 0) {
    throw new Error("UNAUTHORIZED");
  }

  return { workspace, user };
}

export function unauthorizedResponse() {
  return Response.json(apiError("UNAUTHORIZED", "Not authenticated"), {
    status: 401,
  });
}

export function notFoundResponse(entity = "Resource") {
  return Response.json(apiError("NOT_FOUND", `${entity} not found`), {
    status: 404,
  });
}

export function validationErrorResponse(details: unknown) {
  return Response.json(
    apiError("VALIDATION_ERROR", "Validation failed", details),
    { status: 400 }
  );
}

export function internalErrorResponse(message = "Internal server error") {
  return Response.json(apiError("INTERNAL_ERROR", message), { status: 500 });
}

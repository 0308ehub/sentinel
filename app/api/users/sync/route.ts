import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/types";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json(apiError("UNAUTHORIZED", "Not authenticated"), { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return Response.json(apiError("UNAUTHORIZED", "Not authenticated"), { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null,
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      clerkId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null,
      imageUrl: clerkUser.imageUrl,
    },
  });

  return Response.json(apiSuccess(user));
}

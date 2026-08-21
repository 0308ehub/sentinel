import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

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

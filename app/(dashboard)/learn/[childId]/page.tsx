import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { SessionClient } from "./session-client";

export default async function LearnPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const child = await prisma.child.findUnique({ where: { id: childId } });
  if (!child || child.parentId !== user.id) notFound();

  return <SessionClient childId={child.id} childName={child.name} />;
}

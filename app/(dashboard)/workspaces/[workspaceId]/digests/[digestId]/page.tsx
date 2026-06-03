import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { redirect, notFound } from "next/navigation";
import { DigestPageClient } from "./digest-page-client";
import type { DigestType } from "@prisma/client";

function digestTitle(type: DigestType, createdAt: Date) {
  const label = type === "DAILY" ? "Daily" : type === "WEEKLY" ? "Weekly" : "Manual";
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(createdAt)
  );
  return `${label} Digest — ${date}`;
}

export default async function DigestPage({
  params,
}: {
  params: Promise<{ workspaceId: string; digestId: string }>;
}) {
  const { workspaceId, digestId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    redirect("/sign-in");
  }

  const digest = await prisma.digest.findFirst({
    where: { id: digestId, workspaceId },
  });

  if (!digest) notFound();

  const serialized = {
    id: digest.id,
    type: digest.type,
    content: digest.content,
    title: digestTitle(digest.type, digest.createdAt),
    createdAt: digest.createdAt.toISOString(),
  };

  return <DigestPageClient digest={serialized} workspaceId={workspaceId} />;
}

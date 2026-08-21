import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      return Response.json(apiError("VALIDATION_ERROR", "Invalid email"), { status: 400 });
    }

    const entry = await prisma.waitlistEntry.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    return Response.json(apiSuccess(entry));
  } catch {
    return Response.json(apiError("INTERNAL_ERROR", "Server error"), { status: 500 });
  }
}

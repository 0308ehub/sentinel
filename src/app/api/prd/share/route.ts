import { currentAccountId } from "@/lib/connections/current";
import { normalizeShare } from "@/lib/prd/document";
import { shareVisible, signShare, verifyShare } from "@/lib/prd/share-token";

export async function POST(request: Request) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the PRD as JSON." }, { status: 400 });
  }

  const share = normalizeShare(body);
  if (!share) return Response.json({ error: "This PRD cannot be shared." }, { status: 400 });

  try {
    return Response.json({ token: signShare(share) });
  } catch {
    return Response.json({ error: "Share links are not configured." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  let token = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return Response.json({ error: "Send the share token." }, { status: 400 });
  }

  const share = verifyShare(token);
  if (!share) return Response.json({ error: "This link does not open a PRD." }, { status: 404 });
  const access = await shareVisible(share);
  if (access === "expired") return Response.json({ error: "This link has expired." }, { status: 410 });
  if (access === "signin") return Response.json({ error: "Sign in with the email this PRD was shared to." }, { status: 401 });
  if (access === "denied") return Response.json({ error: "This account cannot open this PRD." }, { status: 403 });
  return Response.json({ share });
}

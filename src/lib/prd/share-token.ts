import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { emailAllowed, normalizeShare, shareExpired, type PrdShare } from "@/lib/prd/document";

function secret(): string | null {
  return process.env.CONNECTIONS_KEY?.trim() || null;
}

export function signShare(share: PrdShare): string {
  const key = secret();
  if (!key) throw new Error("CONNECTIONS_KEY is required to sign a share link.");
  const payload = Buffer.from(JSON.stringify(share), "utf8").toString("base64url");
  const signature = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyShare(token: string): PrdShare | null {
  const key = secret();
  const dot = token.lastIndexOf(".");
  if (!key || dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac("sha256", key).update(payload).digest("base64url");
  const got = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    return normalizeShare(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

export async function signedInEmail(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
    return email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export async function shareVisible(share: PrdShare): Promise<"ok" | "signin" | "denied" | "expired"> {
  if (shareExpired(share.expiresAt)) return "expired";
  if (share.audience === "anyone") return "ok";
  const email = await signedInEmail();
  if (!email) return "signin";
  return emailAllowed(share, email) ? "ok" : "denied";
}

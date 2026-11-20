import "server-only";

import { currentUser } from "@clerk/nextjs/server";

export async function currentPersonName(): Promise<string> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return "someone";
  try {
    const person = await currentUser();
    return person?.fullName || person?.firstName || person?.username || "someone";
  } catch {
    return "someone";
  }
}

export function attributed(message: string, name: string): string {
  return `${message} — by ${name}`;
}

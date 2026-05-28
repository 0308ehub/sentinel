import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const { userId } = await auth();
  // Authenticated users go straight into the app.
  // Unauthenticated users hit the sign-in page — the real marketing/landing
  // experience lives at the root domain (Sentinel-AI-website).
  if (userId) {
    redirect("/dashboard");
  } else {
    redirect("/sign-in");
  }
}

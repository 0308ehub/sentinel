import type { Metadata } from "next";
import { LandingView } from "@/components/marketing/landing-view";

export const metadata: Metadata = {
  title: "Kismet",
  description: "Cursor for product managers. Figure out what to build next.",
};

export default function Home() {
  return <LandingView />;
}

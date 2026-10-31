import type { Metadata } from "next";
import { AnyView } from "@/components/marketing/any-view";

export const metadata: Metadata = {
  title: "any% — Kismet",
  description: "Kismet's experimentation platform. The shortest valid test, then the next one.",
};

export default function AnyPage() {
  return <AnyView />;
}

import type { Metadata } from "next";
import { ContactView } from "@/components/marketing/contact-view";

export const metadata: Metadata = {
  title: "Talk to us — Kismet",
  description: "Book a time to walk through Kismet with your team.",
};

export default function ContactPage() {
  return <ContactView />;
}

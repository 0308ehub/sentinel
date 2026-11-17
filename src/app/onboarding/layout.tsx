import { privatePage } from "@/lib/page-meta";

export const metadata = privatePage("Onboarding", "Set up this Kismet workspace.");

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

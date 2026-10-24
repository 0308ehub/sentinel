"use client";

import { useParams } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default function OnboardingStepPage() {
  const params = useParams<{ step: string }>();
  return <OnboardingFlow step={params.step ?? ""} />;
}

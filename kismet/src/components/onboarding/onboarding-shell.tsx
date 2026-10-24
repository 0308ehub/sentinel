import Link from "next/link";
import { BrandLogo } from "@/components/marketing/brand-logo";
import type { ReactNode } from "react";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding";

export function OnboardingShell({
  step,
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  hideFooter = false,
  wide = false,
}: {
  step: OnboardingStep;
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideFooter?: boolean;
  wide?: boolean;
}) {
  const index = Math.max(0, ONBOARDING_STEPS.indexOf(step));
  const progress = ((index + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-white text-[#111]">
      <header className="px-6 pt-6 md:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <BrandLogo className="h-7" />
          </Link>
          <span className="text-sm text-[#8b939e]">
            {index + 1} of {ONBOARDING_STEPS.length}
          </span>
        </div>
        <div className="mt-4 h-0.5 w-full bg-[#eef0f3]">
          <div className="h-full bg-[#0571d3] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className={`mx-auto w-full px-6 pb-32 pt-16 md:pt-20 ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <h1 className="text-[2rem] font-medium leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-[#5c6570]">{description}</p>}
        <div className="mt-8">{children}</div>
      </main>

      {!hideFooter && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-[#e6e8ec] bg-white">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-4">
            {onBack ? (
              <button type="button" onClick={onBack} className="text-sm text-[#3c4250] hover:text-[#111]">
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="inline-flex h-10 items-center rounded-md bg-[#111] px-4 text-sm font-medium text-white disabled:opacity-30"
            >
              {nextLabel}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

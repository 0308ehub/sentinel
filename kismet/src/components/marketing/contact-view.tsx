import { CalendlyEmbed } from "@/components/marketing/calendly-embed";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

function calendlyUrl(): string {
  const raw = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim() ?? "";
  if (!raw) return "";
  const color = "background_color=ffffff&text_color=111111&primary_color=0571d3";
  return `${raw}${raw.includes("?") ? "&" : "?"}${color}`;
}

export function ContactView() {
  const url = calendlyUrl();

  return (
    <MarketingFrame>
      <main className="px-6 pb-8 pt-12 md:px-16 md:pt-16">
        <div className="max-w-2xl">
          <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111] md:text-[2.65rem]">
            Talk to us
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#3c4250]">
            Pick a time to walk through Kismet with your team.
          </p>
        </div>
        <div className="mt-10">
          {url ? (
            <CalendlyEmbed url={url} />
          ) : (
            <p className="px-6 py-16 text-[15px] leading-relaxed text-[#3c4250]">
              The booking calendar is not connected yet. Set NEXT_PUBLIC_CALENDLY_URL to your Calendly link.
            </p>
          )}
        </div>
      </main>
    </MarketingFrame>
  );
}

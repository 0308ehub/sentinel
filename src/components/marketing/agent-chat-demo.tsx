"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMPTS = [
  { text: "What are customers saying in Slack and in support tickets about the first results?", tag: "Users" },
  { text: "Why did purchases fall the week we raised the recency weight?", tag: "Product" },
  { text: "Set up a test that cuts that weight, and stop it when the result is significant.", tag: "Experiments" },
] as const;

const TAGS = ["Users", "Product", "Experiments"] as const;

export function AgentChatDemo() {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const prompt = PROMPTS[index]!;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    if (count < prompt.text.length) {
      const id = window.setTimeout(() => setCount((value) => value + 1), 36);
      return () => window.clearTimeout(id);
    }
    const hold = window.setTimeout(() => {
      setCount(0);
      setIndex((value) => (value + 1) % PROMPTS.length);
    }, 1800);
    return () => window.clearTimeout(hold);
  }, [count, prompt.text.length, reduceMotion]);

  function show(next: number) {
    setIndex(next);
    setCount(reduceMotion ? PROMPTS[next]!.text.length : 0);
  }

  const shown = reduceMotion ? prompt.text : prompt.text.slice(0, count);

  return (
    <div className="px-2 py-6 text-center md:px-8 md:py-10">
      <h2 className="text-[1.65rem] leading-tight text-[#111] md:text-[2rem]">A context-connected agent</h2>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-[#3c4250]">
        Product-focused. Ask about your users, your product, or the experiment to launch.
      </p>
      <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-white/80 bg-white/85 text-left shadow-[0_16px_50px_rgba(17,17,17,0.06)] backdrop-blur-md">
        <p className="min-h-20 px-4 pt-4 text-[15px] leading-relaxed text-[#111]" aria-live="polite">
          {shown}
          {!reduceMotion && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-[#111] align-middle" />}
        </p>
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
          <span className="text-xs text-[#6a717c]">Context</span>
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => show(PROMPTS.findIndex((item) => item.tag === tag))}
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                prompt.tag === tag ? "bg-[#f3f4f6] font-medium text-[#111]" : "text-[#6a717c] hover:text-[#111]",
              )}
            >
              {tag}
            </button>
          ))}
          <span className="ml-auto text-xs tabular-nums text-[#9aa3ad]">
            {shown.length}/{prompt.text.length}
          </span>
          <button
            type="button"
            aria-label="Send"
            onClick={() => show((index + 1) % PROMPTS.length)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#111] text-white hover:bg-[#2a2a2a]"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

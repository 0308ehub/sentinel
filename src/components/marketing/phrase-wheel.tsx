"use client";

import { useEffect, useState } from "react";

const PHRASES = [
  "proactively monitor changes",
  "become your company's brain",
  "run autonomous experiments",
  "optimize every update",
  "explore your data",
  "plan important features",
  "ship fast",
  "catch what the metrics miss",
  "remember every decision",
  "watch the product overnight",
];

const LEAD = "Kismet is the AI-native platform for your product teams to";

export function PhraseWheel() {
  const [current, setCurrent] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const hold = window.setTimeout(() => {
      const next = (current + 1) % PHRASES.length;
      if (reduceMotion) {
        setCurrent(next);
        return;
      }
      setLeaving(current);
      setCurrent(next);
    }, 2400);
    return () => window.clearTimeout(hold);
  }, [current, reduceMotion]);

  useEffect(() => {
    if (leaving == null) return;
    const words = PHRASES[leaving].split(" ").length;
    const id = window.setTimeout(() => setLeaving(null), words * 55 + 520);
    return () => window.clearTimeout(id);
  }, [leaving]);

  return (
    <span className="mt-1 block">
      <span className="sr-only" aria-live="polite">{`${LEAD} ${PHRASES[current]}.`}</span>
      <span className="phrase-slot" aria-hidden>
        {PHRASES.map((phrase) => (
          <span key={phrase} className="phrase-measure">
            {phrase}
          </span>
        ))}
        {leaving != null && <PhraseLine text={PHRASES[leaving]} mode="exit" />}
        <PhraseLine text={PHRASES[current]} mode={leaving != null && !reduceMotion ? "enter" : "hold"} />
      </span>
    </span>
  );
}

function PhraseLine({ text, mode }: { text: string; mode: "hold" | "exit" | "enter" }) {
  const words = text.split(" ");
  return (
    <span className="phrase-live">
      {words.map((word, index) => (
        <span
          key={`${text}-${index}`}
          className={mode === "exit" ? "phrase-word phrase-word-exit" : mode === "enter" ? "phrase-word phrase-word-enter" : "phrase-word"}
          style={{
            marginRight: index < words.length - 1 ? "0.28em" : undefined,
            animationDelay: mode === "hold" ? undefined : `${index * 55}ms`,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

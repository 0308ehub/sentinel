"use client";

import { useEffect, useRef, useState } from "react";
import { AgentMark } from "@/components/inbox/agent-mark";

const BEATS = [
  {
    slug: "insights",
    name: "Insights",
    letter: "I",
    color: "#6e8caf",
    title: "Morning brief",
    doing: "Reading overnight purchases",
    body: "Purchases fell from 18.4 to 14.1. Clicks rose. Recency moved from 0.30 to 0.45.",
    action: "Put the ranking prompt on the standup.",
    done: "Filed the morning brief.",
  },
  {
    slug: "experiments",
    name: "Experiments",
    letter: "E",
    color: "#6f9a7b",
    title: "Checkout guardrail",
    doing: "Checking the checkout test",
    body: "Error rate on the treatment is near the stop line.",
    action: "Pause the treatment until it settles.",
    done: "Paused the treatment.",
  },
  {
    slug: "research",
    name: "Research",
    letter: "R",
    color: "#b09a62",
    title: "Cold-start complaints",
    doing: "Reading public posts",
    body: "People outside the company are describing the same drop in new listings.",
    action: "Read the three posts before changing the prompt.",
    done: "Saved the three posts.",
  },
  {
    slug: "decisions",
    name: "Decisions",
    letter: "D",
    color: "#c46d6d",
    title: "Sample project",
    doing: "Reading an open decision",
    body: "The sample-project draft has been waiting with no answer.",
    action: "Approve the draft or close it today.",
    done: "Approved the draft.",
  },
] as const;

export function AgentDemo() {
  const [index, setIndex] = useState(0);
  const [approved, setApproved] = useState(false);
  const held = useRef(false);
  const beat = BEATS[index] ?? BEATS[0];

  useEffect(() => {
    if (held.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setApproved(true);
      return;
    }
    const approveTimer = window.setTimeout(() => {
      if (!held.current) setApproved(true);
    }, 2200);
    const nextTimer = window.setTimeout(() => {
      if (held.current) return;
      setApproved(false);
      setIndex((current) => (current + 1) % BEATS.length);
    }, 4000);
    return () => {
      window.clearTimeout(approveTimer);
      window.clearTimeout(nextTimer);
    };
  }, [index]);

  function pick(next: number) {
    held.current = true;
    setApproved(false);
    setIndex(next);
  }

  function approve() {
    held.current = true;
    setApproved(true);
  }

  return (
    <div className="ks-agent-card">
      <div className="ks-agent-switch" role="tablist" aria-label="Agents">
        {BEATS.map((item, itemIndex) => {
          const selected = item.slug === beat.slug;
          return (
            <button
              key={item.slug}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => pick(itemIndex)}
              className="ks-agent-tab"
            >
              <AgentMark name={item.name} icon={item.letter} color={item.color} size={28} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>
      <div className="ks-agent-body" aria-live="polite">
        <p className="ks-agent-doing">{beat.doing}</p>
        <p className="ks-agent-title">{beat.title}</p>
        <p className="ks-agent-copy">{beat.body}</p>
        {approved ? (
          <p className="ks-agent-action">{beat.done}</p>
        ) : (
          <p className="ks-agent-action">
            <span>I'd do</span>
            {beat.action}
          </p>
        )}
      </div>
      <button type="button" className="ks-agent-approve" data-on={approved || undefined} onClick={approve}>
        {approved ? "Approved" : "Approve"}
      </button>
    </div>
  );
}

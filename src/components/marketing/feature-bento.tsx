"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Field } from "@/components/marketing/stageshow/kit/controls/Field";
import { Code, type CodeLine } from "@/components/marketing/stageshow/kit/code";
import { Count } from "@/components/marketing/stageshow/kit/motion/Count";
import { Card } from "@/components/marketing/stageshow/kit/parts/Card";
import { Check } from "@/components/marketing/stageshow/kit/parts/Check";
import { Icon } from "@/components/marketing/stageshow/kit/parts/Icon";
import { Meter } from "@/components/marketing/stageshow/kit/parts/Meter";
import { Stage, type LookTokens } from "@/components/marketing/stageshow/kit/stage";
import type { Act } from "@/components/marketing/stageshow/kit/act";
import { Text } from "@/components/marketing/stageshow/kit/window";
import { CONNECTORS } from "@/lib/connectors/catalog";
import { AgentDemo } from "@/components/marketing/agent-demo";
import { ConnectorField } from "@/components/marketing/connector-field";
import { TopoField } from "@/components/marketing/topo-field";
import "./feature-bento.css";

// Tile list, written before the pictures:
//
//   Tile    Span   Kind        The one thing                         Words
//   Ask     1 × 1  Component   questions type in and delete           Ask the company.
//   Plan    1 × 1  Object      a plan writes its metric, then the next Write the plan.
//   Ship    1 × 1  Component   a GitHub diff writes itself in          Ship the change.
//   Agents  2 × 1  Component   agents act, you approve, click through  Agents move first.
//
// The experiment window above this grid is the hero. No tile here repeats
// its chrome. Ask, plan, and ship loop. Connector bubbles keep drifting.

const LOOK: LookTokens = {
  "--ss-accent": "#0571d3",
  "--ss-accent-2": "#0460b5",
  "--ss-accent-soft": "rgba(5, 113, 211, 0.12)",
  "--ss-accent-text": "#0460b5",
  "--ss-font": "var(--font-satoshi), Satoshi, ui-sans-serif, system-ui, sans-serif",
  "--ss-radius-md": "10px",
  "--ss-radius-lg": "16px",
  "--ss-text-strong": "#141414",
  "--ss-text": "#5c6570",
};

const QUESTIONS = [
  "Why did purchases fall?",
  "Which test is near a guardrail?",
  "What did the ranking prompt change?",
  "Who is blocked on a decision?",
  "Where do new accounts drop off?",
];

const BUBBLE_IDS = [
  "slack",
  "google-workspace",
  "jira",
  "databricks",
  "amplitude",
  "pylon",
  "notion",
  "linear",
  "zendesk",
  "figma",
  "github",
  "intercom",
  "snowflake",
  "sentry",
  "posthog",
  "stripe",
  "salesforce",
  "hubspot",
  "asana",
  "discord",
  "datadog",
  "mixpanel",
  "postgres",
  "zoom",
  "teams",
  "confluence",
  "coda",
  "gitlab",
  "bitbucket",
  "pagerduty",
  "bigquery",
  "redshift",
  "dbt",
  "segment",
  "fivetran",
  "statsig",
  "hotjar",
  "braze",
  "mailchimp",
  "google-ads",
  "meta-ads",
  "shopify",
  "twilio",
  "monday",
  "clickup",
  "heap",
];

const MARKS = BUBBLE_IDS.flatMap((id) => {
  const connector = CONNECTORS.find((item) => item.id === id);
  if (!connector?.logo) return [];
  return [{ src: id === "slack" ? "/connectors/slack-color.svg" : connector.logo, name: connector.name }];
});

function usePictureWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(1, Math.round(node.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Tile({ area, title, detail, children, picture }: { area: string; title: string; detail: string; children?: ReactNode; picture?: ReactNode }) {
  return (
    <section className={`ks-tile ks-tile--${area}`}>
      <TopoField id={`ks-topo-${area}`} />
      <p className="ks-copy">
        <b>{title}</b> {detail}
      </p>
      {children}
      {picture}
    </section>
  );
}

type AskState = { draft: string; focused: boolean };

async function askScript(a: Act<AskState>) {
  for (const question of QUESTIONS) {
    a.put({ focused: true });
    await a.wait(360);
    await a.type("draft", question, { interval: 42 });
    await a.wait(1400);
    for (let i = question.length - 1; i >= 0; i--) {
      a.put({ draft: question.slice(0, i) });
      await a.wait(16);
    }
    await a.wait(220);
  }
}

function Ask() {
  const [picture, width] = usePictureWidth();
  return (
    <Tile
      area="ask"
      title="Ask the company."
      detail="The graph, the warehouse, and what people said."
      picture={
        <div ref={picture} className="ks-picture ks-picture--ask">
          <Stage<AskState>
            width={width}
            height={64}
            tokens={{ ...LOOK, "--ss-control": "48px", "--ss-radius-md": "999px" }}
            initial={{ draft: "", focused: true }}
            poster={{ draft: QUESTIONS[0], focused: true }}
            script={askScript}
            play="loop"
            className="ks-stage"
          >
            {(s) => (
              <Field
                value={s.draft}
                placeholder="Ask anything"
                focused={s.focused}
                leading={<Icon name="plus" size={16} />}
                trailing={<Icon name="arrow" size={16} />}
              />
            )}
          </Stage>
        </div>
      }
    />
  );
}

const PLANS = [
  {
    title: "Purchase prior",
    metric: "Purchases per session",
    guard: "Refund rate +0.3pt",
    hypothesis: "A prior beats recency",
  },
  {
    title: "Onboarding drop",
    metric: "Accounts that finish setup",
    guard: "Minutes to first action",
    hypothesis: "A shorter first screen",
  },
  {
    title: "Invite quality",
    metric: "Invites that become accounts",
    guard: "Spam reports stay flat",
    hypothesis: "Fewer invites, better ones",
  },
] as const;

type PlanKey = "metric" | "guard" | "hypothesis";

type PlanState = {
  title: string;
  metric: string;
  guard: string;
  hypothesis: string;
  done: number;
  writing: number;
};

const PLAN_ROWS: { key: PlanKey; label: string }[] = [
  { key: "metric", label: "Metric" },
  { key: "guard", label: "Guardrail" },
  { key: "hypothesis", label: "Hypothesis" },
];

const PLAN_EMPTY: PlanState = { title: "", metric: "", guard: "", hypothesis: "", done: 0, writing: -1 };

async function erase(a: Act<PlanState>, key: "title" | PlanKey, text: string) {
  for (let i = text.length - 1; i >= 0; i--) {
    a.put({ [key]: text.slice(0, i) });
    await a.wait(12);
  }
}

async function planScript(a: Act<PlanState>) {
  for (const plan of PLANS) {
    a.put({ ...PLAN_EMPTY });
    await a.wait(240);
    await a.type("title", plan.title, { interval: 32 });
    for (let i = 0; i < PLAN_ROWS.length; i++) {
      const key = PLAN_ROWS[i].key;
      a.put({ writing: i });
      await a.type(key, plan[key], { interval: 22 });
      a.put({ done: i + 1, writing: -1 });
      await a.wait(280);
    }
    await a.wait(1100);
    for (let i = PLAN_ROWS.length - 1; i >= 0; i--) {
      const key = PLAN_ROWS[i].key;
      await erase(a, key, plan[key]);
      a.put({ done: i, writing: -1 });
    }
    await erase(a, "title", plan.title);
    await a.wait(200);
  }
}

function Plan() {
  const [picture, width] = usePictureWidth();
  const filled = PLANS[0];
  return (
    <Tile
      area="plan"
      title="Write the plan."
      detail="A feature, a decision, and the test that would prove it."
      picture={
        <div ref={picture} className="ks-picture ks-picture--plan">
          <Stage<PlanState>
            width={width}
            height={228}
            tokens={LOOK}
            initial={PLAN_EMPTY}
            poster={{ title: filled.title, metric: filled.metric, guard: filled.guard, hypothesis: filled.hypothesis, done: 3, writing: -1 }}
            script={planScript}
            play="loop"
            className="ks-stage"
          >
            {(s) => (
              <Card lift pad="medium" gap={12} className="ks-plan-card">
                <div className="ks-plan-head">
                  <Text className="ks-plan-name">{s.title || "\u00a0"}</Text>
                  <span className="ks-plan-count">
                    <Count value={s.done} /> / 3
                  </span>
                </div>
                <Meter value={s.done / 3} />
                {PLAN_ROWS.map((row, index) => (
                  <div key={row.key} className="ks-step">
                    <Check on={s.done > index} pending={s.writing === index} size={18} />
                    <Text className="ks-step-label">{row.label}</Text>
                    <Text className="ks-step-value">{s[row.key]}</Text>
                  </div>
                ))}
              </Card>
            )}
          </Stage>
        </div>
      }
    />
  );
}

type ShipState = { index: number; shown: number };

const PULLS: { repo: string; number: string; title: string; file: string; add: string; del: string; lines: CodeLine[] }[] = [
  {
    repo: "x/ranker",
    number: "418",
    title: "Purchase prior versus recency",
    file: "ranker/score.py",
    add: "+18",
    del: "−6",
    lines: [
      { text: "def score(bid, p_click, age):", kind: "del" },
      { text: "    return bid * p_click * recency", kind: "del" },
      { text: "def score(bid, p_buy, n):", kind: "add" },
      { text: "    prior = (n + 1.2) / (n + 8)", kind: "add" },
      { text: "    return bid * p_buy * prior", kind: "add" },
      { text: 'PRIMARY = "purchases"', kind: "add" },
      { text: 'GUARD = "refund_rate"', kind: "add" },
      { text: "STOP = 0.003", kind: "add" },
    ],
  },
  {
    repo: "x/onboarding",
    number: "426",
    title: "New metric: setup finished",
    file: "metrics/onboarding.py",
    add: "+11",
    del: "−2",
    lines: [
      { text: "def activated(account):", kind: "del" },
      { text: "    return account.clicked", kind: "del" },
      { text: "def setup_finished(account):", kind: "add" },
      { text: "    return account.first_action", kind: "add" },
      { text: 'METRIC = "setup_finished"', kind: "add" },
      { text: 'GUARD = "minutes_to_act"', kind: "add" },
      { text: "SAMPLE = 80000", kind: "add" },
      { text: "DAYS = 14", kind: "add" },
    ],
  },
];

const SHIP_EMPTY: ShipState = { index: 0, shown: 0 };

async function shipScript(a: Act<ShipState>) {
  for (let index = 0; index < PULLS.length; index++) {
    const pull = PULLS[index];
    a.put({ index, shown: 0 });
    await a.wait(320);
    for (let shown = 1; shown <= pull.lines.length; shown++) {
      a.put({ shown });
      await a.wait(120);
    }
    await a.wait(1600);
  }
  a.put(SHIP_EMPTY);
}

function Ship() {
  const [picture, width] = usePictureWidth();
  const posterPull = PULLS[0];
  return (
    <Tile
      area="ship"
      title="Ship the change."
      detail="The ranking prompt leaves as a pull request."
      picture={
        <div ref={picture} className="ks-picture ks-picture--ship">
          <Stage<ShipState>
            width={width}
            height={292}
            tokens={LOOK}
            initial={SHIP_EMPTY}
            poster={{ index: 0, shown: posterPull.lines.length }}
            script={shipScript}
            play="loop"
            className="ks-stage"
          >
            {(s) => {
              const pull = PULLS[s.index] ?? PULLS[0];
              return (
                <Card lift pad="small" gap={8} className="ks-ship-card">
                  <div className="ks-ship-head">
                    <div className="ks-gh">
                      <img src="/connectors/github.svg" alt="" width={14} height={14} />
                      <Text>{pull.repo}</Text>
                      <Text className="ks-gh-num">#{pull.number}</Text>
                    </div>
                  </div>
                  <Text className="ks-ship-title">{pull.title}</Text>
                  <div className="ks-gh-file">
                    <Text>{pull.file}</Text>
                    <span className="ks-diff-stat">
                      <span className="ks-diff-add">{pull.add}</span>
                      <span className="ks-diff-del">{pull.del}</span>
                    </span>
                  </div>
                  <Code numbers={false} lines={pull.lines.slice(0, s.shown)} />
                </Card>
              );
            }}
          </Stage>
        </div>
      }
    />
  );
}

function Tools() {
  return (
    <Tile area="tools" title="Easily connect" detail={`to your existing workflows with ${CONNECTORS.length} connectors.`}>
      <ConnectorField marks={MARKS} />
    </Tile>
  );
}

function Agents() {
  return (
    <Tile area="agents" title="Agents move first." detail="They say what they would do, and wait for a yes.">
      <div className="ks-picture ks-picture--agents">
        <AgentDemo />
      </div>
    </Tile>
  );
}

export function FeatureBento() {
  return (
    <section className="ks-bento" aria-label="What Kismet does">
      <div className="ks-grid">
        <Ask />
        <Plan />
        <Ship />
        <Tools />
        <Agents />
      </div>
    </section>
  );
}

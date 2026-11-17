import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, FlaskConical, GitPullRequest, LineChart, MessageSquare, PenLine, Plug, Settings, Sparkles } from "lucide-react";
import { DocCard, DocsShell } from "@/components/marketing/docs-shell";
import { docNeighbors } from "@/lib/product-docs";

export const metadata: Metadata = {
  title: "Docs — Kismet",
  description: "What Kismet can do: the chat, the product graph, analytics, experiments, and the handoff into the tools you already use.",
};

const TOC = [
  { id: "quick-links", label: "Quick links" },
  { id: "what-it-does", label: "What it does" },
];

export default function DocsPage() {
  const { next } = docNeighbors("/docs");

  return (
    <DocsShell current="/docs" toc={TOC}>
      <p className="text-sm text-[#6a717c]">Docs</p>
      <h1 className="mt-3 text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111]">Kismet</h1>
      <div className="mt-5 max-w-2xl space-y-4 text-[15px] leading-relaxed text-[#3c4250]">
        <p>
          Kismet is a workspace for product managers. You ask in a chat. The answer is supposed to come from the company you already run: the product graph, the warehouse, and the tools that are connected.
        </p>
        <p>
          It is one place for four jobs. Read the product and what people said. Turn that into a feature, a decision, and a hypothesis. Measure it, including a test that can stop itself. Ship the change into the tools the team already uses.
        </p>
      </div>

      <h2 id="quick-links" className="mt-12 scroll-mt-20 text-xl font-semibold tracking-[-0.02em]">
        Quick links
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DocCard
          href="/docs/chat"
          title="Chat"
          detail="Ask in plain language. The question can see the graph, the connectors, and the recent thread."
          icon={<MessageSquare className="h-5 w-5" />}
        />
        <DocCard
          href="/docs/experiment"
          title="Experiment"
          detail="Write the metric, the guardrails, and the looks before anything ships."
          icon={<FlaskConical className="h-5 w-5" />}
        />
        <DocCard
          href="/docs/connectors"
          title="Connectors"
          detail="Slack, Google, Jira, and Databricks are what the chat can read today."
          icon={<Plug className="h-5 w-5" />}
        />
      </div>

      <h2 id="what-it-does" className="mt-12 scroll-mt-20 text-xl font-semibold tracking-[-0.02em]">
        What it does
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DocCard
          href="/docs/explore"
          title="Explore"
          detail="Features, decisions, tickets, and the evidence they came from."
          icon={<Boxes className="h-5 w-5" />}
        />
        <DocCard
          href="/docs/analytics"
          title="Analytics"
          detail="Boards, funnels, charts, definitions, and a query editor."
          icon={<LineChart className="h-5 w-5" />}
        />
        <DocCard
          href="/docs/optimize"
          title="Optimize"
          detail="An agent that looks for a small test and stays inside guardrails."
          icon={<Sparkles className="h-5 w-5" />}
        />
        <DocCard
          href="/docs/plan"
          title="Plan"
          detail="A feature, a decision, and a hypothesis from the evidence."
          icon={<PenLine className="h-5 w-5" />}
        />
        <DocCard
          href="/docs/ship"
          title="Ship"
          detail="The pull request or the issue, and a record of what went out."
          icon={<GitPullRequest className="h-5 w-5" />}
        />
        <DocCard
          href="/docs/settings"
          title="Settings"
          detail="What the chat may see, how a link is shared, and the account."
          icon={<Settings className="h-5 w-5" />}
        />
      </div>

      {next && (
        <div className="mt-14 border-t border-[#eceef1] pt-6">
          <Link href={next.href} className="text-sm font-medium text-[#111] hover:underline">
            Next: {next.title}
          </Link>
        </div>
      )}
    </DocsShell>
  );
}

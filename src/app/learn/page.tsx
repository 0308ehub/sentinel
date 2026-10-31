import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "Learn — Kismet",
  description: "What Kismet does, what it connects to, and how to try the chat.",
};

export default function LearnPage() {
  return (
    <MarketingFrame>
      <article className="mx-6 mt-16 max-w-2xl space-y-10 pb-16 text-[15px] leading-relaxed md:mx-16">
        <header className="space-y-4">
          <h1 className="text-3xl font-medium tracking-tight">How Kismet works</h1>
          <p className="text-[#3c4250]">
            Kismet is a workspace for product managers. The front door is a chat. Behind it is the
            product graph: features, decisions, tickets, and the evidence they came from.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">What it does for you</h2>
          <p>
            Kismet is proactive. It understands what you are working on, and what is important to
            you: the feature in front of you, the decision still open, the customer thread that
            keeps coming back. It brings the next step before you go looking.
          </p>
          <p>
            The interface is simple: there are no new interfaces. You ask in the chat, or from
            Slack. It can use the company&apos;s tools the same way you do.
          </p>
          <p>
            It can pull the complaints and the numbers for a feature you are about to spec, open
            the tickets, put the review on the calendar, tell the team what was decided, or find
            who owns the metric that slipped.
          </p>
          <p className="text-[#3c4250]">
            When you do ask, the analytics come back in the same place. How a feature is doing, who
            dropped off, what the comparison says, and what to do next.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">The chat</h2>
          <p>
            After you sign in, you land in the chat. Ask in plain language. Kismet sends the
            question to OpenAI, along with recent Slack messages from the channels the bot has
            joined. The model answers from those excerpts. It should name the channel and the
            person. It should not invent a message that was not there.
          </p>
          <p>
            It also sees the pages you open in Kismet, and it keeps a short log of what you asked.
            The next question already has that context. If a public link is in the question or on
            the page, Kismet reads that page. It does not see other applications, and it does not
            listen or speak. When a question needs numbers, it writes a read-only SQL query, runs
            it on the connected Databricks warehouse, and answers from the rows.
          </p>
          <p>Useful questions:</p>
          <ul className="list-disc space-y-1 pl-5 text-[#3c4250]">
            <li>What are people talking about in Slack?</li>
            <li>Which customer complaints show up more than once?</li>
            <li>What should we build next, based on this week?</li>
            <li>What have we been working on?</li>
            <li>How many rows are in the bakehouse sales sample?</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Slack</h2>
          <p>
            Slack is the live source. The bot token in the workspace reads channels the bot is a
            member of. On each question, Kismet pulls the latest messages from those channels and
            gives them to the model. That is the retrieval step: the chat does not browse Slack on
            its own, and it does not keep a separate copy. If the bot is not in a channel, that
            channel is invisible.
          </p>
          <p>
            To add a channel, open it in Slack and invite the bot. Then ask again. You can also
            open Settings, then Connectors, then Slack, and read the same messages without the
            model in between.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">The rest of the workspace</h2>
          <p>The sidebar stays out of the way. Each item is one surface:</p>
          <ul className="space-y-2 text-[#3c4250]">
            <li>
              <span className="text-[#111]">Chat.</span> The question and the answer.
            </li>
            <li>
              <span className="text-[#111]">Dashboard.</span> Health, risks, and recent activity.
            </li>
            <li>
              <span className="text-[#111]">Explorer.</span> The product tree: features, problems,
              experiments.
            </li>
            <li>
              <span className="text-[#111]">Features.</span> One feature, its PRD, engineering, and
              metrics.
            </li>
            <li>
              <span className="text-[#111]">Timeline and Graph.</span> How a decision moved, and
              what it connects to.
            </li>
            <li>
              <span className="text-[#111]">Analytics and Decisions.</span> The numbers and the
              calls already made.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">What it can connect to</h2>
          <p>Slack is connected and used by the chat today. The workspace is shaped for the rest:</p>
          <ul className="list-disc space-y-1 pl-5 text-[#3c4250]">
            <li>Google Workspace, for docs, mail, and calendar</li>
            <li>Jira, for the issues on the connected site</li>
            <li>Confluence, for pages next to those issues</li>
            <li>GitHub and Linear, for the work itself</li>
            <li>Notion, for specs</li>
            <li>Granola, for meeting notes</li>
            <li>Pendo, for product analytics</li>
            <li>Sentry, for errors tied to a feature</li>
          </ul>
          <p>
            The full list is on the{" "}
            <Link href="/connectors" className="underline underline-offset-4">
              connectors
            </Link>{" "}
            page. The chat reads Slack, Google, Jira, and Databricks when those are connected.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Try it</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Sign in. You land in the chat.</li>
            <li>Ask what people said in Slack this week.</li>
            <li>If the answer says the bot is not in a channel, invite it in Slack and ask again.</li>
            <li>Open Settings → Connectors → Slack to read the channel directly.</li>
          </ol>
          <p className="pt-2">
            <Link href="/sign-in" className="underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </section>
      </article>
    </MarketingFrame>
  );
}

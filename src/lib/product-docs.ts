export interface DocSection {
  heading?: string;
  paragraphs: string[];
}

export interface ProductDoc {
  slug: string;
  title: string;
  summary: string;
  sections: DocSection[];
}

export const PRODUCT_DOCS: ProductDoc[] = [
  {
    slug: "optimize",
    title: "Optimize",
    summary:
      "An always-on agent that mines analytics for anomalies and opportunities, then ships small experiments inside guardrails.",
    sections: [
      {
        paragraphs: [
          "Kismet watches the product. It mines analytics for anomalies and opportunities, proposes a hypothesis, and can launch a small, low-risk experiment inside guardrails. It asks a product manager before it steps outside those guardrails.",
          "**Given permission, Kismet can ship small experiments on its own.** Over a couple of weeks it can keep optimizing a product without someone approving every change. The run stays inside a framework: what may change, how far it may go, and when it has to stop.",
        ],
      },
      {
        heading: "Trust is the product",
        paragraphs: [
          "The hard part is statistical validity. Peeking at a result too early, testing many ideas at once, and a sample ratio mismatch can all make a win look real when it is not. Kismet treats those as safety checks. An experiment that cannot be trusted does not ship.",
        ],
      },
    ],
  },
  {
    slug: "experiment",
    title: "Experiment",
    summary:
      "Ship design and code experiments that match your design system, with the stats, the QA, and a write-up included.",
    sections: [
      {
        paragraphs: [
          "Kismet is an experimentation platform where anybody can ship design-heavy and code-heavy experiments quickly. Variants come from a prompt and from the company’s own design system, so they look native. They match the codebase you already have.",
          "Kismet opens a pull request that wraps the change in a flag and adds instrumentation. It suggests metrics and guardrails, runs a power calculation, and flags collisions with experiments that are already running.",
        ],
      },
      {
        heading: "After it is live",
        paragraphs: [
          "Kismet does the QA and the monitoring: automated exposure checks, sample ratio mismatch detection, and alerts. When an experiment ends, it writes a plain-language readout and files it in a searchable library, so the team does not retest the same idea.",
        ],
      },
      {
        heading: "Smaller samples",
        paragraphs: [
          "Most experimentation tools assume consumer-scale traffic. Kismet is also for teams with less of it: sequential testing, Bayesian methods, bandits, and informative priors from past experiments. The detail is packaged, and the surface is simple enough that anyone on the team can use it.",
        ],
      },
      {
        heading: "Where the ideas come from",
        paragraphs: [
          "Most teams still rank ideas with ICE scores in a spreadsheet, which is mostly gut feel. Kismet mines analytics, session replays, support tickets, and past experiment results, and proposes a hypothesis with a rough estimate of impact.",
          "It can also predict platform usage, and usage of a specific feature, from click-through and the other statistics you already collect.",
        ],
      },
    ],
  },
  {
    slug: "explore",
    title: "Explore",
    summary: "Look through the product, the numbers, and what people already said, in one place.",
    sections: [
      {
        paragraphs: [
          "The company already knows a lot. It is spread across analytics, tickets, docs, and conversations. Explore is how you move through that without rebuilding it.",
          "Kismet keeps a product graph: features, decisions, tickets, and the evidence they came from. You can open the tree, the timeline, and the graph, or ask in the chat and get an answer that names the source.",
          "The tools it can read are listed on the connectors page. Slack, Google, Jira, and Databricks are the ones the chat uses today. The rest are there for the sources a team already runs.",
        ],
      },
    ],
  },
  {
    slug: "plan",
    title: "Plan",
    summary: "Turn what you found into a feature, a decision, and a hypothesis.",
    sections: [
      {
        paragraphs: [
          "Planning starts from evidence. A feature draft can pull the complaints, the tickets, and a warehouse number. A decision stays attached to the reason it was made.",
          "Recommendations come from what the company has said and measured. The output is a feature, a hypothesis, and a rough sense of impact, not a blank prompt and a guess.",
        ],
      },
    ],
  },
  {
    slug: "ship",
    title: "Ship",
    summary: "Send the work out through the tools the team already uses, and keep the record.",
    sections: [
      {
        paragraphs: [
          "Shipping is the handoff. Kismet can open the Jira issue and keep the spec next to the feature. For an experiment, it opens the pull request with the flag and the instrumentation.",
          "What went out stays in the library. The next person can see what was tried, what it did, and what should not be tested again.",
        ],
      },
    ],
  },
];

export function docBySlug(slug: string): ProductDoc | undefined {
  return PRODUCT_DOCS.find((doc) => doc.slug === slug);
}

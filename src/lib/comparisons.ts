export type ComparisonRow = {
  job: string;
  kismet: string;
  other: string;
};

export type Comparison = {
  slug: string;
  name: string;
  summary: string;
  theirs: string;
  ours: string;
  rows: ComparisonRow[];
};

export const COMPARISONS: Comparison[] = [
  {
    slug: "statsig",
    name: "Statsig",
    summary: "Statsig is where a test runs. Kismet is where you decide the test is worth running.",
    theirs:
      "Statsig is an experimentation platform. Teams use it for feature flags, assignment, and the statistics on a test, often on top of the warehouse they already have. It is built to be the system that runs the experiment.",
    ours:
      "Kismet starts earlier. You ask about a feature, read what people already said, and write the metric, the guardrails, and the looks before anything ships. The change then leaves as a pull request. Kismet is not a replacement for the system that assigns traffic.",
    rows: [
      {
        job: "Find the evidence",
        kismet: "Slack, Google, Jira, Databricks, and the product graph.",
        other: "Not the job. Statsig starts from the metric.",
      },
      {
        job: "Write the plan",
        kismet: "A feature, a decision, and a hypothesis.",
        other: "You bring the hypothesis with you.",
      },
      {
        job: "Measure",
        kismet: "Boards, funnels, charts, and a query editor.",
        other: "Warehouse-native analytics built around the experiment.",
      },
      {
        job: "Run the test",
        kismet: "The metric, the guardrails, and the looks, then a pull request.",
        other: "Flags, assignment, and the stats at scale.",
      },
      {
        job: "Ship",
        kismet: "A pull request or an issue, and a record of what went out.",
        other: "Ship by rolling the flag forward.",
      },
    ],
  },
  {
    slug: "glean",
    name: "Glean",
    summary: "Glean finds the answer in the company. Kismet turns that answer into the next change.",
    theirs:
      "Glean is a company search product. It reads the tools people already work in and answers questions across them. It is built for anyone in the company who needs to find something.",
    ours:
      "Kismet reads a narrower set, and it reads them for a product decision. Slack, Google, Jira, and Databricks can sit behind a question. The point of the answer is a feature, a hypothesis, and a change you can ship.",
    rows: [
      {
        job: "Search the company",
        kismet: "The tools connected to a product question.",
        other: "The whole company's knowledge, as a search product.",
      },
      {
        job: "Write the plan",
        kismet: "A feature, a decision, and a hypothesis from the evidence.",
        other: "An answer, a summary, or a draft.",
      },
      {
        job: "Measure",
        kismet: "Boards, funnels, charts, and a query editor.",
        other: "Not the job.",
      },
      {
        job: "Run the test",
        kismet: "The metric, the guardrails, and the looks.",
        other: "Not the job.",
      },
      {
        job: "Ship",
        kismet: "A pull request or an issue.",
        other: "Not the job.",
      },
    ],
  },
  {
    slug: "amplitude",
    name: "Amplitude",
    summary: "Amplitude is where a growth team reads the product. Kismet is where the decision gets made.",
    theirs:
      "Amplitude is a product analytics suite. Teams chart behavior, build funnels, and run experiments from the same data. It is the system of record for how the product is used.",
    ours:
      "Kismet has boards, funnels, charts, and a query editor for the question in front of you. It also keeps the evidence next to the chart: the tickets, the threads, and the decision. The test is written there, and the change leaves as a pull request.",
    rows: [
      {
        job: "Find the evidence",
        kismet: "The chart, plus Slack, Jira, and the product graph.",
        other: "The chart, and the events behind it.",
      },
      {
        job: "Write the plan",
        kismet: "A feature, a decision, and a hypothesis.",
        other: "A chart or a notebook. The decision lives somewhere else.",
      },
      {
        job: "Measure",
        kismet: "Boards, funnels, charts, and a query editor.",
        other: "A full product-analytics suite.",
      },
      {
        job: "Run the test",
        kismet: "Designed next to the evidence, then opened as a pull request.",
        other: "An experiment product on Amplitude's data.",
      },
      {
        job: "Ship",
        kismet: "A pull request or an issue.",
        other: "The result comes back to the chart.",
      },
    ],
  },
  {
    slug: "posthog",
    name: "PostHog",
    summary: "PostHog is the product suite engineers adopt. Kismet is the workspace a product manager works in.",
    theirs:
      "PostHog puts product analytics, session replay, feature flags, and experiments in one product, aimed at the engineers who ship the product. A lot of software teams start there.",
    ours:
      "Kismet assumes those tools may already exist. It is the place you ask what happened, write what to do about it, and hand the change back to the repo. The analytics inside Kismet are for that decision, not a second warehouse.",
    rows: [
      {
        job: "Find the evidence",
        kismet: "Slack, Google, Jira, Databricks, and the product graph.",
        other: "Events, replays, and the product data PostHog collects.",
      },
      {
        job: "Write the plan",
        kismet: "A feature, a decision, and a hypothesis.",
        other: "An insight or a ticket you file yourself.",
      },
      {
        job: "Measure",
        kismet: "Boards, funnels, charts, and a query editor.",
        other: "Product analytics as a core part of the suite.",
      },
      {
        job: "Run the test",
        kismet: "The metric, the guardrails, and the looks, then a pull request.",
        other: "Flags and experiments in the same product as the analytics.",
      },
      {
        job: "Ship",
        kismet: "A pull request or an issue, tied back to the decision.",
        other: "Ship from the repo, and read the result in PostHog.",
      },
    ],
  },
];

export function comparisonBySlug(slug: string) {
  return COMPARISONS.find((item) => item.slug === slug);
}

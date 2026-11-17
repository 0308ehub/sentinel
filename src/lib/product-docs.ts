export interface DocSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ProductDoc {
  slug: string;
  title: string;
  summary: string;
  sections: DocSection[];
}

export interface DocNavItem {
  href: string;
  title: string;
  slug?: string;
}

export interface DocNavGroup {
  label: string;
  items: DocNavItem[];
}

export const DOC_NAV: DocNavGroup[] = [
  {
    label: "Get started",
    items: [
      { href: "/docs", title: "Overview" },
      { href: "/docs/chat", title: "Chat", slug: "chat" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/docs/explore", title: "Explore", slug: "explore" },
      { href: "/docs/plan", title: "Plan", slug: "plan" },
      { href: "/docs/agents", title: "Agents", slug: "agents" },
    ],
  },
  {
    label: "Measure",
    items: [
      { href: "/docs/analytics", title: "Analytics", slug: "analytics" },
      { href: "/docs/experiment", title: "Experiment", slug: "experiment" },
      { href: "/docs/optimize", title: "Optimize", slug: "optimize" },
    ],
  },
  {
    label: "Ship",
    items: [{ href: "/docs/ship", title: "Ship", slug: "ship" }],
  },
  {
    label: "Context",
    items: [
      { href: "/docs/connectors", title: "Connectors", slug: "connectors" },
      { href: "/docs/settings", title: "Settings", slug: "settings" },
    ],
  },
];

export const PRODUCT_DOCS: ProductDoc[] = [
  {
    slug: "chat",
    title: "Chat",
    summary: "The front door. Ask in plain language. The answer is supposed to come from the company, not from a guess.",
    sections: [
      {
        id: "where-you-land",
        heading: "Where you land",
        paragraphs: [
          "After you sign in, you land in the chat. The rest of the workspace is in the sidebar: agents, analytics, experiments, and the product graph. The chat is where a question starts.",
        ],
      },
      {
        id: "what-it-can-see",
        heading: "What a question can see",
        paragraphs: [
          "Each question is sent with the context you have turned on. Those switches are the product graph, the connected tools, and the recent chat. Turn one off and that source stays out of the answer.",
          "When connectors are on, the chat can use recent Slack messages from channels the bot has joined. The answer should name the channel and the person. It should not invent a message that was not there. If a public link is in the question, or on the page you have open, Kismet can read that page.",
          "When a question needs a number, the chat can write a read-only SQL query, run it on the connected Databricks warehouse, and answer from the rows.",
        ],
        bullets: [
          "The pages you open in Kismet stay in context for the next question.",
          "A short log of what you asked is kept, so you do not have to restate the thread.",
          "The chat does not see other applications, and it does not listen or speak.",
        ],
      },
      {
        id: "questions",
        heading: "Questions that fit",
        paragraphs: ["The useful questions are specific. Name the feature, the week, or the source."],
        bullets: [
          "What are people saying in Slack about this feature?",
          "Which complaints show up more than once?",
          "Why did this metric move last week?",
          "What should we test next, given the last result?",
        ],
      },
    ],
  },
  {
    slug: "explore",
    title: "Explore",
    summary: "The product graph: features, decisions, tickets, and the evidence they came from.",
    sections: [
      {
        id: "the-graph",
        heading: "The graph",
        paragraphs: [
          "The company already knows a lot. It is spread across features, decisions, tickets, and conversations. Explore is that record in one place: the tree, the timeline, and the graph.",
          "Open a feature and the spec sits next to the evidence it came from. Open a decision and the reason stays attached to the call. The point is that the next person can see why, not only what shipped.",
        ],
      },
      {
        id: "surfaces",
        heading: "Where you look",
        paragraphs: ["The same record shows up as a few surfaces in the sidebar."],
        bullets: [
          "Explorer is the product tree: features, problems, and experiments.",
          "A feature page holds the spec, the engineering notes, and the metrics.",
          "Timeline is how a decision moved.",
          "Graph is what that decision connects to.",
          "Decisions is the list of calls already made.",
        ],
      },
      {
        id: "ask",
        heading: "Ask instead of clicking",
        paragraphs: [
          "If the product graph is included in chat context, you can ask and the answer can name the source. The graph is the record. The chat is a way to move through it.",
        ],
      },
    ],
  },
  {
    slug: "plan",
    title: "Plan",
    summary: "Turn evidence into a feature, a decision, and a hypothesis.",
    sections: [
      {
        id: "from-evidence",
        heading: "Start from evidence",
        paragraphs: [
          "A plan in Kismet is supposed to start from something the company already said or measured. A feature draft can pull the complaints, the tickets, and a warehouse number. The output is a feature, a hypothesis, and a rough sense of impact.",
          "That is the difference from a blank prompt. The draft should be able to point at the thread, the ticket, or the query it used.",
        ],
      },
      {
        id: "decisions",
        heading: "Keep the decision",
        paragraphs: [
          "A decision stays in the workspace after it is made, with the reason next to it. The next plan can see what was already chosen, and what was already rejected.",
        ],
      },
    ],
  },
  {
    slug: "agents",
    title: "Agents",
    summary: "A fleet of agents for the work a product manager repeats: read the context, propose a change, and hand it off.",
    sections: [
      {
        id: "the-fleet",
        heading: "The fleet",
        paragraphs: [
          "Agents is a page in the sidebar, next to the chat. It is where a run lives when the work is bigger than one question: read the sources, write the proposal, and wait for a person when the next step needs one.",
        ],
      },
      {
        id: "what-they-read",
        heading: "What they can read",
        paragraphs: [
          "An agent can use the same context as the chat. That includes the warehouse, the tickets and conversations in connected tools, and the public web when the question is about a specific feature.",
          "A search should name the feature. “Sponsored results” is a search. “The product” is not. The sources show up with the note, so you can see where a claim came from.",
        ],
      },
    ],
  },
  {
    slug: "analytics",
    title: "Analytics",
    summary: "Boards, funnels, charts, definitions, and a query editor on the connected warehouse.",
    sections: [
      {
        id: "the-workspace",
        heading: "The analytics workspace",
        paragraphs: [
          "Analytics is its own surface. You can work in boards, funnels, an explore view, metric definitions, saved charts, a query editor, and the list of data sources.",
          "A shared board can be opened from a link. A saved notebook can be opened in the query editor.",
        ],
      },
      {
        id: "from-the-chat",
        heading: "Ask for a number",
        paragraphs: [
          "You do not have to start in the query editor. Ask in the chat. When the question needs a number, Kismet can write a read-only SQL query against the connected Databricks warehouse and answer from the rows.",
        ],
      },
      {
        id: "usage",
        heading: "Usage is not the warehouse",
        paragraphs: [
          "Usage in Settings is this browser’s graph, chats, and agents. It is not an org-wide report, and it is not the product metrics. Product numbers come from the warehouse.",
        ],
      },
    ],
  },
  {
    slug: "experiment",
    title: "Experiment",
    summary: "Design a test, write the stats before it ships, and stop it when the result is real.",
    sections: [
      {
        id: "before-it-ships",
        heading: "Before it ships",
        paragraphs: [
          "An experiment is a change you can measure. Before it runs, write down the metric you are optimizing, the smallest lift worth detecting, how much traffic it gets, and the guardrails that stop it.",
          "The change can be a prompt, not only a screen. A ranking prompt can move a weight and a prior while the page stays the same. Kismet opens a pull request so the change can run on a slice of traffic.",
        ],
      },
      {
        id: "the-plan",
        heading: "The plan",
        paragraphs: [
          "Kismet can lay out a sequential plan instead of waiting for a fixed end date. For a five-look test at a 5% false-positive rate, it uses O’Brien–Fleming boundaries. A look that is merely ahead stays open. A look that clears its boundary can stop the test early.",
          "Guardrails are separate from the metric you are optimizing. A click-through drop, a refund move, or a latency budget can stop the test even when the primary metric looks good.",
        ],
      },
      {
        id: "after-it-is-live",
        heading: "After it is live",
        paragraphs: [
          "The checks that matter once it is running are exposure and a sample ratio mismatch. An experiment that cannot be trusted does not ship. When it ends, the readout should say what happened in plain language, so the team does not run the same test again.",
        ],
      },
    ],
  },
  {
    slug: "optimize",
    title: "Optimize",
    summary: "An agent that looks for a small, safe test and can ship it inside guardrails.",
    sections: [
      {
        id: "the-loop",
        heading: "The loop",
        paragraphs: [
          "Optimize watches for a change that is worth a small test. It proposes the hypothesis and can launch that test inside guardrails. Outside those guardrails, it asks a person.",
          "The run stays inside a frame: what may change, how far it may go, and when it has to stop. A person can still approve the proposal before it ships.",
        ],
      },
      {
        id: "trust",
        heading: "Trust is the constraint",
        paragraphs: [
          "Peeking too early, testing many ideas at once, and a sample ratio mismatch can all make a win look real when it is not. Kismet treats those as safety checks. A result that fails them does not ship.",
        ],
      },
    ],
  },
  {
    slug: "ship",
    title: "Ship",
    summary: "Hand the change to the tools the team already uses, and keep the record.",
    sections: [
      {
        id: "the-handoff",
        heading: "The handoff",
        paragraphs: [
          "Shipping is the handoff out of Kismet. For an experiment, that is a pull request with the change wrapped so it can run on a slice of traffic. For a feature, Kismet can open the Jira issue and keep the spec next to the feature.",
        ],
      },
      {
        id: "the-record",
        heading: "The record",
        paragraphs: [
          "What went out stays with the feature and the decision. The next person should be able to see what was tried, what it did, and what should not be tested again.",
        ],
      },
    ],
  },
  {
    slug: "connectors",
    title: "Connectors",
    summary: "The tools the chat can read today, and the catalog of tools a team already runs.",
    sections: [
      {
        id: "used-by-chat",
        heading: "What the chat reads today",
        paragraphs: [
          "The chat reads Slack, Google, Jira, and Databricks when those are connected. Slack only includes channels the bot has been invited to. If the bot is not in a channel, that channel is invisible. Databricks is the warehouse for read-only SQL.",
          "To add a Slack channel, invite the bot in Slack and ask again. You can also open Settings, then Connected apps, then Slack, and read the same messages without the model in between.",
        ],
      },
      {
        id: "the-catalog",
        heading: "The catalog",
        paragraphs: [
          "The connectors page lists the other tools a team already runs: docs, project trackers, analytics, warehouses, and the rest. They are there so the workspace can point at them. The chat does not read every logo on that page today.",
        ],
      },
    ],
  },
  {
    slug: "settings",
    title: "Settings",
    summary: "The account, the org, what the chat is allowed to see, and how a link is shared.",
    sections: [
      {
        id: "organization",
        heading: "Organization",
        paragraphs: ["Organization settings cover how the workspace is set up."],
        bullets: [
          "General, plan and billing, projects, and members.",
          "Access and SSO, and content access for what a link can open.",
          "Usage reports, privacy, and data retention.",
          "Navigation, connected apps, and the AI switches.",
        ],
      },
      {
        id: "personal",
        heading: "Personal",
        paragraphs: ["Personal settings are the profile, security, notifications, and year in review."],
      },
      {
        id: "context-switches",
        heading: "What the chat may use",
        paragraphs: [
          "The AI switches decide what is sent with a question: the product graph, the connectors, and the recent chat. They are the context on the chat request. Turn one off and that source is left out.",
        ],
      },
      {
        id: "stored-here",
        heading: "What is stored in this browser",
        paragraphs: [
          "Org policy is stored in this browser, under the localStorage key kismet-org-settings. It is not a server-side org policy yet.",
          "Share links can expire. The public-link and domain checks run in the client. They are not a cryptographic lock on the link.",
        ],
      },
    ],
  },
];

export function docBySlug(slug: string): ProductDoc | undefined {
  return PRODUCT_DOCS.find((doc) => doc.slug === slug);
}

export function flatDocNav(): DocNavItem[] {
  return DOC_NAV.flatMap((group) => group.items);
}

export function docNeighbors(href: string): { prev?: DocNavItem; next?: DocNavItem } {
  const items = flatDocNav();
  const index = items.findIndex((item) => item.href === href);
  if (index < 0) return {};
  return {
    prev: index > 0 ? items[index - 1] : undefined,
    next: index < items.length - 1 ? items[index + 1] : undefined,
  };
}

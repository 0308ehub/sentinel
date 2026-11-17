export interface EvidenceLink {
  title: string;
  href: string;
  kind: string;
}

export interface Candidate {
  agentSlug: string;
  type: string;
  semanticKey: string;
  title: string;
  summary: string;
  hypothesis: string;
  proposedAction: string;
  intro: string;
  activity: string;
  confidence: number;
  impact: number;
  urgency: number;
  evidence: EvidenceLink[];
}

/** Stand-in producers until the live pipelines publish findings. Semantic keys keep them from sending twice. */
export function mockCandidates(): Candidate[] {
  return [
    {
      agentSlug: "insights",
      type: "insight",
      semanticKey: "mock:onboarding-drop",
      title: "Onboarding drop-off",
      intro: "People are leaving before they create a project.",
      summary: "Most new accounts never reach a first project.",
      hypothesis: "The empty project list is the step where they stall.",
      proposedAction: "Show one sample project on that empty list.",
      activity: "Reading onboarding replays",
      confidence: 0.82,
      impact: 0.74,
      urgency: 0.62,
      evidence: [{ title: "Onboarding funnel", href: "/analytics?tab=funnels", kind: "chart" }],
    },
    {
      agentSlug: "experiments",
      type: "experiment",
      semanticKey: "mock:checkout-guardrail",
      title: "Checkout guardrail",
      intro: "The checkout test is close to its guardrail.",
      summary: "Error rate on checkout is up for the treatment.",
      hypothesis: "The new payment step is what people are failing.",
      proposedAction: "Pause the treatment until the error rate settles.",
      activity: "Checking the checkout guardrail",
      confidence: 0.93,
      impact: 0.9,
      urgency: 0.96,
      evidence: [{ title: "Checkout experiment", href: "/experiments", kind: "experiment" }],
    },
    {
      agentSlug: "prds",
      type: "prd",
      semanticKey: "mock:sample-prd",
      title: "Sample project draft",
      intro: "The draft for the sample project is ready.",
      summary: "It proposes one sample project on the empty list.",
      hypothesis: "A concrete first project gives people a reason to stay.",
      proposedAction: "Read the draft before anyone ships it.",
      activity: "Drafting the sample-project note",
      confidence: 0.7,
      impact: 0.55,
      urgency: 0.48,
      evidence: [{ title: "Draft", href: "/features", kind: "doc" }],
    },
    {
      agentSlug: "monitoring",
      type: "monitor",
      semanticKey: "mock:noise",
      title: "A small dip in settings views",
      intro: "",
      summary: "Settings views moved within the usual range.",
      hypothesis: "This looks like ordinary day-to-day movement.",
      proposedAction: "Leave it.",
      activity: "Checking settings traffic",
      confidence: 0.3,
      impact: 0.2,
      urgency: 0.2,
      evidence: [{ title: "Settings chart", href: "/analytics", kind: "chart" }],
    },
    {
      agentSlug: "decisions",
      type: "decision",
      semanticKey: "mock:sample-decision",
      title: "Ship the sample project",
      intro: "The sample project is waiting on a yes.",
      summary: "The draft is sitting with no decision.",
      hypothesis: "Leaving it open is why the empty list stays empty.",
      proposedAction: "Approve the draft or close it today.",
      activity: "Reading the open decision",
      confidence: 0.9,
      impact: 0.88,
      urgency: 0.86,
      evidence: [{ title: "Open decision", href: "/decisions", kind: "doc" }],
    },
    {
      agentSlug: "research",
      type: "research",
      semanticKey: "mock:cold-start",
      title: "Cold-start complaints",
      intro: "People outside the company are describing the same drop.",
      summary: "Posts this week describe new listings taking the top slot.",
      hypothesis: "The recency change is what they are reacting to.",
      proposedAction: "Read the three posts before changing the prompt.",
      activity: "Reading public posts",
      confidence: 0.62,
      impact: 0.58,
      urgency: 0.55,
      evidence: [{ title: "Public posts", href: "/explorer", kind: "doc" }],
    },
    {
      agentSlug: "growth",
      type: "growth",
      semanticKey: "mock:invite-quiet",
      title: "A quiet week on invites",
      intro: "",
      summary: "Invites moved inside the usual range.",
      hypothesis: "Nothing here is asking for a change.",
      proposedAction: "Leave it.",
      activity: "Checking invites",
      confidence: 0.35,
      impact: 0.28,
      urgency: 0.22,
      evidence: [{ title: "Invites", href: "/analytics", kind: "chart" }],
    },
  ];
}

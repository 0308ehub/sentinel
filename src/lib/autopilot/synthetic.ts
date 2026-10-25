import "server-only";

import type { NewEvidence } from "@/lib/autopilot/store";

// Made-up but realistic customer chatter about Kismet itself, so the loop has something to work on
// before there is real traffic. Every item is stored with synthetic = true.

interface Scenario {
  weight: number;
  slack: string[];
  tickets: { title: string; body: string }[];
}

const SCENARIOS: Scenario[] = [
  {
    weight: 4,
    slack: [
      "Is there a way to propose a feature without hitting cmd+K? I didn't even know that existed until today",
      "took me 10 min to find 'propose feature'. why is it hidden in the command palette",
      "our new PM asked where to add a feature idea and I had to screen share to show the shortcut",
      "would be nice to have a visible 'New feature' button on the features page tbh",
    ],
    tickets: [
      { title: "How do I create a new feature?", body: "I've looked through the Features page and can't find any button to add one." },
      { title: "Can't add feature idea", body: "Docs mention proposing features but there's no button on the Features list." },
    ],
  },
  {
    weight: 3,
    slack: [
      "connected slack in settings but chat still says it can't see our channels?",
      "the connectors page lists 40 tools but only a few actually connect, super confusing",
      "spent a while trying to connect Linear before realising it's not live yet",
    ],
    tickets: [
      { title: "Notion connector does nothing", body: "Clicked Connect on Notion and filled the form. Nothing happened and chat can't see our docs." },
      { title: "Which connectors actually work?", body: "Please mark which integrations are available today. We tried three that seem to be placeholders." },
    ],
  },
  {
    weight: 2,
    slack: [
      "experiments page is empty and I have no idea what I'm supposed to do first",
      "how do you start an experiment? the page just shows an empty table",
    ],
    tickets: [
      { title: "Experiments empty state", body: "First time opening Experiments. There's no guidance on how to create one." },
    ],
  },
  {
    weight: 1,
    slack: [
      "chat answers are great but take like 30s, is that normal?",
      "kismet chat felt slow today when it was pulling from databricks",
    ],
    tickets: [{ title: "Chat is slow", body: "Responses regularly take 20-40 seconds when the warehouse is involved." }],
  },
];

const NOISE: string[] = [
  "love the graph view, showed it to our VP today",
  "anyone know if there's a dark mode? (found it, nvm)",
  "timeline is really nice for our weekly sync",
];

const PEOPLE = ["Priya (Acme)", "Jordan (Northwind)", "Sam (Globex)", "Alex (Initech)", "Riley (Umbrella)", "Taylor (Hooli)"];
const CHANNELS = ["#kismet-feedback", "#product", "#pm-team", "#general"];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function weighted(): Scenario {
  const total = SCENARIOS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const scenario of SCENARIOS) {
    roll -= scenario.weight;
    if (roll <= 0) return scenario;
  }
  return SCENARIOS[0];
}

/** A small batch of new synthetic evidence, spread over the last few hours. */
export function syntheticEvidence(count = 3 + Math.floor(Math.random() * 4)): NewEvidence[] {
  const items: NewEvidence[] = [];
  for (let i = 0; i < count; i++) {
    const occurredAt = new Date(Date.now() - Math.floor(Math.random() * 6 * 3600_000)).toISOString();
    if (Math.random() < 0.12) {
      items.push({ source: "slack", synthetic: true, title: pick(NOISE), body: pick(CHANNELS), author: pick(PEOPLE), occurredAt });
      continue;
    }
    const scenario = weighted();
    if (Math.random() < 0.65) {
      items.push({ source: "slack", synthetic: true, title: pick(scenario.slack), body: pick(CHANNELS), author: pick(PEOPLE), occurredAt });
    } else {
      const ticket = pick(scenario.tickets);
      items.push({
        source: "ticket",
        synthetic: true,
        title: ticket.title,
        body: ticket.body,
        author: pick(PEOPLE),
        url: null,
        occurredAt,
      });
    }
  }
  return items;
}

export function syntheticEnabled(): boolean {
  return process.env.AUTOPILOT_SYNTHETIC?.trim() !== "off";
}

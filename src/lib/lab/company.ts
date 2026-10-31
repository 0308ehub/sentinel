import type { CompanyContext, MetricDef, MetricId, Proposal, Scenario, ScenarioTruth } from "./types.ts";

const segments = ["new", "casual", "power", "premium"] as const;
function metric(
  id: MetricId,
  label: string,
  kind: "binary" | "continuous",
  unit: MetricDef["unit"],
  higherIsBetter: boolean,
  values: number[],
  sds?: number[],
): MetricDef {
  const baseline = Object.fromEntries(segments.map((segment, i) => [segment, values[i]])) as MetricDef["baseline"];
  const sd = sds
    ? (Object.fromEntries(segments.map((segment, i) => [segment, sds[i]])) as NonNullable<MetricDef["sd"]>)
    : undefined;
  return { id, label, kind, unit, higherIsBetter, baseline, ...(sd ? { sd } : {}) };
}

export const METRICS: Record<MetricId, MetricDef> = {
  d7_return: metric("d7_return", "D7 return", "binary", "%", true, [0.31, 0.42, 0.58, 0.66]),
  completion: metric("completion", "Recipe completion", "binary", "%", true, [0.43, 0.56, 0.68, 0.72]),
  engaged_minutes: metric(
    "engaged_minutes",
    "Engaged minutes",
    "continuous",
    "min",
    true,
    [7.2, 11.4, 18.2, 16.8],
    [6, 8, 11, 10],
  ),
  ad_revenue: metric(
    "ad_revenue",
    "Ad revenue per user",
    "continuous",
    "$",
    true,
    [0.09, 0.17, 0.29, 0.02],
    [0.15, 0.23, 0.37, 0.05],
  ),
  premium_start: metric("premium_start", "Premium trial start", "binary", "%", true, [0.018, 0.012, 0.026, 0.001]),
  recipes_saved: metric(
    "recipes_saved",
    "Recipes saved",
    "continuous",
    "count",
    true,
    [0.35, 0.72, 1.8, 1.5],
    [0.8, 1.1, 2.1, 1.8],
  ),
  page_load_p75: metric(
    "page_load_p75",
    "Page load p75",
    "continuous",
    "ms",
    false,
    [1260, 1170, 1090, 1050],
    [310, 280, 250, 230],
  ),
  error_rate: metric("error_rate", "Error rate", "binary", "%", false, [0.012, 0.009, 0.007, 0.006]),
  refund_rate: metric("refund_rate", "Refund rate", "binary", "%", false, [0.01, 0.01, 0.012, 0.018]),
};

const evidence = [
  [
    "e1",
    "analytics",
    "New cooks leave before saving",
    "Only 18% of new cooks save a recipe; 46% read for at least 60 seconds.",
  ],
  [
    "e2",
    "sessions",
    "Save intent appears late",
    "Session replays show readers returning to the save button after finishing ingredients.",
  ],
  ["e3", "support", "People lose recipes", "“I read a recipe and then could not find it the next day.”"],
  ["e4", "goals", "Retention goal", "Lift D7 return from 31% to 34% without giving back ad revenue."],
  ["e5", "analytics", "Long recipes monetize", "Recipes over eight steps earn 41% more ad revenue."],
  ["e6", "sessions", "Mid-recipe slot is visible", "Seventy-two percent of cooks reach step four."],
  ["e7", "support", "Ad complaints", "“The ads make it hard to keep my place.”"],
  [
    "e8",
    "codebase",
    "Recipe ad placement",
    "RecipeView renders AdSlot once after step 3; flags live in src/lib/flags.ts.",
  ],
  ["e9", "analytics", "Ingredient backtracking", "Cooks reopen ingredients 2.3 times per completed recipe."],
  ["e10", "sessions", "Checklist workaround", "Power cooks screenshot the ingredient list before starting."],
  ["e11", "support", "Checklist request", "“Please let me pin ingredients while I cook.”"],
  ["e12", "past_experiment", "Bigger hero image was flat", "No completion or retention movement in August 2026."],
  ["e13", "analytics", "Saving predicts Premium", "Users with three saved recipes start Premium 2.4 times as often."],
  ["e14", "goals", "Premium goal", "Grow qualified Premium trials without increasing refunds."],
  [
    "e15",
    "past_experiment",
    "Open interstitial lost",
    "Interstitial ad on open raised revenue but reduced D7 return 4.1%.",
  ],
  ["e16", "codebase", "Save milestone exists", "SaveButton already emits the saved_recipe_count event."],
] as const;

export const PANTRY: CompanyContext = {
  name: "Pantry",
  pitch: "A recipe app that helps home cooks get dinner made.",
  businessModel: "Free with ads; Premium is $5.99 per month.",
  northStar: "weekly active cooks",
  goals: [
    "Lift D7 return from 31% to 34% without giving back ad revenue",
    "Increase useful recipe completion",
    "Grow qualified Premium trials without increasing refunds",
  ],
  dailyTraffic: { new: 3200, casual: 7800, power: 1600, premium: 900 },
  metrics: METRICS,
  evidence: evidence.map(([id, source, title, detail]) => ({ id, source, title, detail })),
  codebase: {
    "src/components/recipe/RecipeView.tsx": "Renders recipe steps and the current ad slot.",
    "src/components/recipe/SaveButton.tsx": "Saves recipes and emits save counts.",
    "src/components/recipe/IngredientList.tsx": "Shows ingredient quantities.",
    "src/components/paywall/Paywall.tsx": "Displays Premium offers.",
    "src/lib/flags.ts": "Resolves experiment flags.",
    "src/lib/analytics.ts": "Emits product events.",
    "src/app/recipes/[slug]/page.tsx": "Loads a recipe page.",
    "src/app/saved/page.tsx": "Lists saved recipes.",
    "src/components/ads/AdSlot.tsx": "Loads and records display ads.",
  },
  pastExperiments: [
    { title: "Bigger hero image", date: "Aug 2026", result: "Flat" },
    { title: "Interstitial ad on open", date: "Sep 2026", result: "Killed: D7 return -4.1%" },
    { title: "Shorter signup", date: "Jul 2026", result: "Shipped: completion +3.2%" },
  ],
  conflicts: (a, b) => a.files.some((file) => b.files.includes(file)),
};

const NO_EFFECT = { new: 0, casual: 0, power: 0, premium: 0 };

export const SCENARIOS: Record<string, Scenario> = {
  savePrompt: {
    proposal: {
      id: "save-prompt",
      title: "Save prompt after 60 seconds of reading",
      objective: "retention",
      hypothesis:
        "If cooks who have read a recipe for 60 seconds are offered a one-tap save, more new cooks will come back within 7 days, because they will have a reason to return.",
      why: "46% of new cooks read for a full minute, but only 18% save anything, and people write in that they lose recipes. Saving is the strongest predictor of a second visit.",
      evidenceIds: ["e1", "e2", "e3", "e4", "e16"],
      page: "/recipes/[slug]",
      files: ["src/components/recipe/SaveButton.tsx"],
      expectedLift: 0.05,
      confidence: "high",
      impactScore: 92,
      risk: "A prompt can feel pushy. The error-rate guardrail stops it if the page breaks.",
      treatment: "After 60 seconds on a recipe, a small bar slides up: “Save this for later?” with a one-tap save.",
      diff: {
        file: "src/components/recipe/SaveButton.tsx",
        before: "  return <button onClick={save}>Save</button>;",
        after:
          '  if (flag("save-prompt") === "a") return <TimedSavePrompt onSave={save} afterSeconds={60} />;\n  return <button onClick={save}>Save</button>;',
        shipped: "  return <TimedSavePrompt onSave={save} afterSeconds={60} />;",
      },
      followUp: "Try the prompt on the saved-recipes page for casual cooks.",
    },
    truth: {
      d7_return: { new: 0.18, casual: 0.03, power: 0, premium: 0 },
      recipes_saved: { new: 0.3, casual: 0.08, power: 0.02, premium: 0.02 },
      ad_revenue: { new: 0.01, casual: 0, power: 0, premium: 0 },
    },
  },
  secondAd: {
    proposal: {
      id: "second-ad",
      title: "Second ad slot mid-recipe",
      objective: "monetization",
      hypothesis:
        "If long recipes show a second ad after step 6, ad revenue per user will rise, because 72% of cooks scroll past step 4.",
      why: "Long recipes earn 41% more ad revenue and most cooks reach the middle. Revenue is behind plan this quarter.",
      evidenceIds: ["e5", "e6", "e8", "e7", "e15"],
      page: "/recipes/[slug]",
      files: ["src/components/recipe/RecipeView.tsx", "src/components/ads/AdSlot.tsx"],
      expectedLift: 0.06,
      confidence: "medium",
      impactScore: 74,
      risk: "Cooks already complain that ads make them lose their place, and the interstitial test cut D7 return by 4.1%. Return visits are a stop-now guardrail.",
      treatment: "Recipes with more than 8 steps show a second ad slot after step 6.",
      diff: {
        file: "src/components/recipe/RecipeView.tsx",
        before: '      {index === 2 && <AdSlot slot="recipe-mid" />}',
        after:
          '      {index === 2 && <AdSlot slot="recipe-mid" />}\n      {flag("second-ad") === "a" && index === 5 && steps.length > 8 && (\n        <AdSlot slot="recipe-late" />\n      )}',
      },
      followUp: "Test a lighter native placement after the last step instead of mid-recipe.",
    },
    truth: {
      ad_revenue: { new: 0.09, casual: 0.09, power: 0.09, premium: 0 },
      d7_return: { new: -0.08, casual: -0.06, power: -0.03, premium: 0 },
      engaged_minutes: { new: -0.02, casual: -0.015, power: -0.01, premium: 0 },
    },
  },
  stickyChecklist: {
    proposal: {
      id: "sticky-checklist",
      title: "Sticky ingredient checklist",
      objective: "engagement",
      hypothesis:
        "If the ingredient list stays pinned with checkboxes while cooking, more cooks will finish the recipe, because they will stop scrolling back.",
      why: "Cooks reopen the ingredient list 2.3 times per recipe, power cooks screenshot it, and it is a frequent request.",
      evidenceIds: ["e9", "e10", "e11"],
      page: "/recipes/[slug]",
      files: ["src/components/recipe/IngredientList.tsx"],
      expectedLift: 0.03,
      confidence: "medium",
      impactScore: 61,
      risk: "Low. A sticky header can slow the page, so page load is a guardrail.",
      treatment:
        "The ingredient list collapses into a sticky bar with checkboxes that follows the cook down the steps.",
      diff: {
        file: "src/components/recipe/IngredientList.tsx",
        before: '  return <ul className="ingredients">{items}</ul>;',
        after:
          '  if (flag("sticky-checklist") === "a") return <StickyChecklist items={ingredients} />;\n  return <ul className="ingredients">{items}</ul>;',
      },
      followUp:
        "Interview five power cooks: the backtracking may come from unit conversions, not from losing the list.",
    },
    truth: { page_load_p75: { new: 0.01, casual: 0.01, power: 0.01, premium: 0.01 } },
  },
  thirdSavePaywall: {
    proposal: {
      id: "third-save-paywall",
      title: "Premium offer after the 3rd saved recipe",
      objective: "conversion",
      hypothesis:
        "If cooks see the Premium offer right after their third save, more will start a trial, because that is when they have shown they are building a habit.",
      why: "Cooks with three saved recipes start Premium 2.4 times as often, and the save count event already exists.",
      evidenceIds: ["e13", "e14", "e16"],
      page: "/recipes/[slug]",
      files: ["src/components/recipe/SaveButton.tsx", "src/components/paywall/Paywall.tsx"],
      expectedLift: 0.1,
      confidence: "medium",
      impactScore: 68,
      risk: "It edits the same save button as the save prompt, so it waits for that test to finish.",
      treatment: "On the third save, the confirmation becomes a Premium offer with a 7-day trial.",
      diff: {
        file: "src/components/recipe/SaveButton.tsx",
        before: '    showToast("Saved");',
        after:
          '    if (flag("third-save-paywall") === "a" && savedCount === 3) openPaywall("third-save");\n    else showToast("Saved");',
        shipped: '    if (savedCount === 3) openPaywall("third-save");\n    else showToast("Saved");',
      },
      followUp: "Try the offer on the saved-recipes page instead of at the moment of saving.",
    },
    truth: {
      premium_start: { new: 0.12, casual: 0.1, power: 0.08, premium: 0 },
      d7_return: NO_EFFECT,
    },
  },
};

/** Ideas Kismet considered and chose not to test, with the reason. */
export const SKIPPED: Proposal[] = [
  {
    id: "open-interstitial",
    title: "Full-screen ad when the app opens",
    objective: "monetization",
    hypothesis: "An ad on open would raise ad revenue per user.",
    why: "It is the fastest way to add impressions.",
    evidenceIds: ["e15"],
    page: "/",
    files: ["src/components/ads/AdSlot.tsx"],
    expectedLift: 0.12,
    confidence: "low",
    impactScore: 0,
    risk: "",
    treatment: "A full-screen ad on app open.",
    skippedReason:
      "Already tested in September: it raised revenue but cut D7 return by 4.1%. Kismet does not retest a known loss.",
  },
  {
    id: "bigger-hero",
    title: "Bigger recipe hero image",
    objective: "engagement",
    hypothesis: "A larger photo would keep more cooks on the page.",
    why: "Design asked for it.",
    evidenceIds: ["e12"],
    page: "/recipes/[slug]",
    files: ["src/app/recipes/[slug]/page.tsx"],
    expectedLift: 0.02,
    confidence: "low",
    impactScore: 0,
    risk: "",
    treatment: "A taller hero image.",
    skippedReason: "Flat in August with 120,000 cooks. Not enough new evidence to try again.",
  },
];

type FollowUpSeed = Pick<
  Proposal,
  "title" | "objective" | "hypothesis" | "treatment" | "page" | "files" | "expectedLift"
> & {
  truth: ScenarioTruth;
};

/** What Scout proposes once a test is decided, keyed by the test it learned from. */
const FOLLOW_UPS: Record<string, FollowUpSeed> = {
  "save-prompt": {
    title: "Save prompt on the saved-recipes page for casual cooks",
    objective: "retention",
    hypothesis:
      "The prompt worked for new cooks. If casual cooks see it where they plan meals, more of them will come back within 7 days.",
    treatment: "Casual cooks on the saved-recipes page get a “Plan this week” save prompt.",
    page: "/saved",
    files: ["src/app/saved/page.tsx"],
    expectedLift: 0.05,
    truth: { d7_return: { new: 0.02, casual: 0.07, power: 0.01, premium: 0 } },
  },
  "second-ad": {
    title: "Native ad card after the last step",
    objective: "monetization",
    hypothesis:
      "The mid-recipe slot cost return visits. An ad after the last step earns without interrupting the cook.",
    treatment: "A single native ad card appears after the final step, never in the middle of cooking.",
    page: "/recipes/[slug]",
    files: ["src/components/ads/AdSlot.tsx"],
    expectedLift: 0.05,
    truth: { ad_revenue: { new: 0.06, casual: 0.06, power: 0.05, premium: 0 } },
  },
  "sticky-checklist": {
    title: "One-tap unit conversion on ingredients",
    objective: "engagement",
    hypothesis:
      "The checklist did nothing, so backtracking is not about losing the list. Cooks may be scrolling back to convert units.",
    treatment: "Each ingredient gets a one-tap toggle between cups and grams.",
    page: "/recipes/[slug]",
    files: ["src/components/recipe/IngredientList.tsx"],
    expectedLift: 0.03,
    truth: { completion: { new: 0.04, casual: 0.04, power: 0.05, premium: 0.04 } },
  },
  "third-save-paywall": {
    title: "Premium offer on the saved-recipes page",
    objective: "conversion",
    hypothesis: "The third-save offer worked. Cooks browsing their saves are in the same mindset.",
    treatment: "The saved-recipes page shows a Premium offer card once a cook has three saves.",
    page: "/saved",
    files: ["src/components/paywall/Paywall.tsx"],
    expectedLift: 0.1,
    truth: { premium_start: { new: 0.06, casual: 0.08, power: 0.05, premium: 0 } },
  },
};

export function followUpFor(parent: Proposal): Scenario | null {
  const seed = FOLLOW_UPS[parent.id];
  if (!seed) return null;
  const { truth, ...fields } = seed;
  return {
    truth,
    proposal: {
      ...fields,
      id: `${parent.id}-next`,
      why: `Scout wrote this from the “${parent.title}” readout. ${parent.followUp ?? ""}`.trim(),
      evidenceIds: parent.evidenceIds,
      confidence: "medium",
      impactScore: Math.max(40, parent.impactScore - 15),
      risk: "Same guardrails as the test it builds on.",
    },
  };
}

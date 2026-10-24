import { ModelError, runOrchestrated } from "@/lib/ai/orchestrate";
import type { ProviderId } from "@/lib/ai/policy";
import { hasDeepDive, promptForChips } from "@/lib/chat-chips";
import { DatabricksApiError } from "@/lib/databricks/client";
import { getDatabricksPrompt } from "@/lib/databricks/context";
import { getJiraContext, jiraContextError } from "@/lib/jira/context";
import { findReadableUrl, readPublicPage } from "@/lib/page-text";
import { getSlackContext } from "@/lib/slack/context";
import { SlackApiError } from "@/lib/slack/client";

export const maxDuration = 120;

type ChatMessage = { role: "user" | "assistant"; content: string };

interface PageSight {
  path: string;
  title: string;
  text: string;
  at: string;
}

interface WorkMemory {
  at: string;
  summary: string;
}

export async function POST(request: Request) {
  let messages: ChatMessage[] = [];
  let modes: string[] = [];
  let pages: PageSight[] = [];
  let memory: WorkMemory[] = [];
  let prefer: ProviderId | undefined;
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      modes?: string[];
      pages?: PageSight[];
      memory?: WorkMemory[];
      model?: string;
    };
    if (body.model === "claude" || body.model === "openai") prefer = body.model;
    modes = (body.modes ?? []).filter((mode) => typeof mode === "string").slice(0, 8);
    pages = (body.pages ?? [])
      .filter((page) => page && typeof page.path === "string" && typeof page.text === "string")
      .slice(-4)
      .map((page) => ({
        path: page.path.slice(0, 200),
        title: typeof page.title === "string" ? page.title.slice(0, 160) : page.path.slice(0, 160),
        text: page.text.slice(0, 4000),
        at: typeof page.at === "string" ? page.at.slice(0, 40) : "",
      }));
    memory = (body.memory ?? [])
      .filter((item) => item && typeof item.summary === "string")
      .slice(-12)
      .map((item) => ({
        at: typeof item.at === "string" ? item.at.slice(0, 40) : "",
        summary: item.summary.replace(/\s+/g, " ").trim().slice(0, 360),
      }))
      .filter((item) => item.summary);
    messages = (body.messages ?? [])
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim()
      )
      .slice(-20)
      .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 8000) }));
  } catch {
    return Response.json({ error: "Send a JSON body with messages." }, { status: 400 });
  }

  if (!messages.some((message) => message.role === "user")) {
    return Response.json({ error: "Ask a question first." }, { status: 400 });
  }

  let slackText = "";
  let channels: string[] = [];
  let slackNote = "Slack is connected, but no channel messages were available.";
  try {
    const slack = await getSlackContext();
    slackText = slack.text;
    channels = slack.channels;
    slackNote = slackText
      ? `Recent messages from ${channels.map((name) => `#${name}`).join(", ")} are below. Use them when they answer the question. Name the channel and the person. Do not invent messages that are not in the excerpts.`
      : "The Slack bot is connected, but it is not in any channels yet, or those channels are empty. Say that plainly if the user asks about Slack.";
  } catch (error) {
    const hint = error instanceof SlackApiError ? error.hint ?? error.code : "Slack could not be read.";
    slackNote = `Slack could not be read (${hint}). Say so if the user asks about Slack, and answer from general knowledge otherwise.`;
  }

  let jiraText = "";
  let issues: string[] = [];
  let jiraNote = "";
  try {
    const jira = await getJiraContext();
    if (jira.configured) {
      jiraText = jira.text;
      issues = jira.keys;
      jiraNote = jiraText
        ? `Recent Jira issues from ${jira.site} are below. Use them when they answer the question. Name the issue key. Do not invent issues that are not in the excerpts.`
        : "Jira is connected, but no issues were updated in the last 90 days. Say that plainly if the user asks about Jira.";
    }
  } catch (error) {
    jiraNote = `Jira could not be read (${jiraContextError(error)}). Say so if the user asks about Jira.`;
  }

  const latestQuestion = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const pageUrl = findReadableUrl([latestQuestion, ...pages.map((page) => page.text).reverse()]);
  const linkedPage = pageUrl ? await readPublicPage(pageUrl) : null;
  const screen = pages
    .map((page) => `At ${page.at || "unknown time"}, on ${page.title} (${page.path}):\n${page.text}`)
    .join("\n\n");
  const workLog = memory.map((item) => `- ${item.at}: ${item.summary}`).join("\n");
  let warehouseNote = "";
  try {
    const warehouse = await getDatabricksPrompt();
    warehouseNote = warehouse
      ? `${warehouse}\nWhen a question needs these tables, call query_databricks. Use one read-only statement. If the tool returns an error, fix the SQL and call it again. Then answer from the rows. Name the table. Do not invent a number that was not returned.`
      : "";
  } catch (error) {
    const hint = error instanceof DatabricksApiError ? error.hint ?? error.code : "Databricks could not be read.";
    warehouseNote = `Databricks could not be read (${hint}). Say so if the user asks for warehouse numbers.`;
  }

  const deep = hasDeepDive(modes);
  const instructions = [
    "You are Kismet, a product manager's assistant.",
    deep ? "Write in plain sentences." : "Be direct and short. Write in plain sentences.",
    "You can see the Kismet pages this person has opened, and a log of what they have been doing here. Use that. Do not ask them to paste it. When they ask what you have been working on, or ask you to reflect, answer from the log in time order.",
    "You can search the web. Use it for facts that are not in the workspace, the linked page, Slack, Jira, or Databricks. Prefer Slack for what this company said, Jira for the state of the work, and Databricks for numbers. When you use a web page, name it in the sentence as a markdown link.",
    ...promptForChips(modes),
    screen ? `Pages open in Kismet:\n${screen}` : "No Kismet page text was sent with this question.",
    workLog ? `Recent work:\n${workLog}` : "",
    linkedPage ? `Text from the link on screen (${linkedPage.title}, ${linkedPage.url}):\n${linkedPage.text}` : "",
    slackNote,
    slackText ? `\nSlack excerpts:\n${slackText}` : "",
    jiraNote,
    jiraText ? `\nJira issues:\n${jiraText}` : "",
    warehouseNote,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const answer = await runOrchestrated({
      task: "chat",
      instructions,
      input: messages,
      databricks: warehouseNote.includes("query_databricks"),
      web: true,
      deep,
      prefer,
    });
    const sources = [...answer.sources];
    if (linkedPage && !sources.some((source) => source.url === linkedPage.url)) {
      sources.unshift({ title: linkedPage.title, url: linkedPage.url });
    }
    return Response.json({
      reply: answer.text,
      channels: slackText ? channels : [],
      issues: jiraText ? issues : [],
      queries: answer.queries,
      sources,
      searched: answer.searched,
      route: {
        provider: answer.provider,
        model: answer.model,
        reason: answer.reason,
        fellBack: answer.fellBack,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The model request failed.";
    const status = error instanceof ModelError ? error.status : 502;
    return Response.json({ error: message }, { status });
  }
}

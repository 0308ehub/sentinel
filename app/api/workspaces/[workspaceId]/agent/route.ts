import { requireWorkspaceAccess } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { ai } from "@/lib/ai/provider";
import { generatePRD } from "@/server/services/prd-service";
import { synthesizeWorkspace } from "@/server/services/synthesis-service";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are Sentinel Agent, an AI product management copilot embedded inside Sentinel.

Your role is to help product managers:
1. Search and analyze customer evidence (interviews, support tickets, feedback, Slack, email, etc.)
2. Identify and surface recurring pain points across customer interactions
3. Generate prioritized product opportunities and recommendations
4. Write detailed Product Requirements Documents (PRDs)
5. Suggest features, UI changes, and engineering tasks
6. Analyze customer segments and their specific needs
7. Create user workflows and design new product experiences
8. Generate interview guides for user research

When responding:
- Always use tools to ground your answers in actual customer evidence from the workspace
- Be specific and cite evidence — avoid vague generalities
- Be actionable: give concrete recommendations, not just observations
- For PRDs, follow standard PM best practices (problem statement, user stories, acceptance criteria, success metrics)
- For feature suggestions, include priority (High/Medium/Low) and effort estimate
- Present findings in a structured, scannable format

You have access to the live workspace data through your tools. Use them liberally to find the most relevant information.`;

const AGENT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_evidence",
    description: "Semantically search through all customer evidence in the workspace — interviews, support tickets, feedback, emails, Slack threads, etc. Returns the most relevant excerpts.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query describing what you're looking for" },
        limit: { type: "number", description: "Max results to return (default: 8, max: 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_pain_points",
    description: "Retrieve top pain points extracted from customer evidence, ranked by severity and urgency.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of pain points to retrieve (default: 10)" },
        category: { type: "string", description: "Optional filter by category" },
      },
    },
  },
  {
    name: "get_opportunities",
    description: "Get prioritized product opportunities ranked by composite score (impact × confidence ÷ effort).",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of opportunities to retrieve (default: 10)" },
      },
    },
  },
  {
    name: "get_insights",
    description: "Get synthesized insights extracted from the workspace — patterns, themes, competitive intel, user behavior.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of insights to retrieve (default: 10)" },
        type: {
          type: "string",
          description: "Filter by insight type: PAIN_POINT, FEATURE_REQUEST, COMPETITIVE_INTEL, USER_BEHAVIOR, MARKET_TREND",
        },
      },
    },
  },
  {
    name: "view_documents",
    description: "List documents in the workspace with their processing status.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of documents to show (default: 10)" },
        status: { type: "string", description: "Filter by status: PENDING, PARSING, CHUNKING, EMBEDDING, EXTRACTING, COMPLETED, FAILED" },
      },
    },
  },
  {
    name: "synthesize_workspace",
    description: "Trigger AI synthesis to extract pain points, insights, and opportunities from all workspace documents. Run this if the workspace has new documents or no synthesis has been done yet.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "generate_prd",
    description: "Generate a detailed Product Requirements Document for a product opportunity.",
    input_schema: {
      type: "object" as const,
      properties: {
        opportunityId: { type: "string", description: "ID of an existing opportunity to generate PRD for" },
        title: { type: "string", description: "Title/topic if no opportunityId — will generate a PRD from workspace context" },
      },
    },
  },
  {
    name: "suggest_features",
    description: "Generate specific feature suggestions based on the workspace's pain points and opportunities.",
    input_schema: {
      type: "object" as const,
      properties: {
        focus: { type: "string", description: "Specific area or theme to focus the feature suggestions on (e.g., 'onboarding', 'notifications', 'reporting')" },
        count: { type: "number", description: "Number of features to suggest (default: 5)" },
      },
    },
  },
  {
    name: "create_workflow",
    description: "Design a step-by-step user workflow for a new or improved product experience.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "Description of the workflow to design (e.g., 'user onboarding flow', 'customer support escalation process')",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "analyze_segment",
    description: "Analyze pain points and evidence for a specific customer segment or persona.",
    input_schema: {
      type: "object" as const,
      properties: {
        segment: {
          type: "string",
          description: "Customer segment to analyze (e.g., 'enterprise customers', 'new users', 'power users', 'support team')",
        },
      },
      required: ["segment"],
    },
  },
];

type ToolInput = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: ToolInput, workspaceId: string): Promise<{ render: { type: string; data: any }; text: string }> {
  switch (name) {
    case "search_evidence": {
      const query = String(input.query ?? "");
      const limit = Number(input.limit ?? 8);
      const queryEmbedding = await ai.embedText(query);
      const vectorStr = `[${queryEmbedding.join(",")}]`;

      const chunks = await prisma.$queryRaw<Array<{
        id: string; documentId: string; content: string; similarity: number; title: string; sourceType: string;
      }>>`
        SELECT dc.id, dc."documentId", dc.content,
               1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity,
               d.title, d."sourceType"
        FROM "DocumentChunk" dc
        JOIN "Document" d ON d.id = dc."documentId"
        WHERE dc."workspaceId" = ${workspaceId}
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> ${vectorStr}::vector
        LIMIT ${limit}`;

      const items = chunks.map((c) => ({ ...c, similarity: Number(c.similarity) }));
      return {
        render: { type: "search-results", data: items },
        text: `Found ${items.length} relevant evidence items for "${query}"`,
      };
    }

    case "get_pain_points": {
      const limit = Number(input.limit ?? 10);
      const painPoints = await prisma.painPoint.findMany({
        where: { workspaceId, status: "ACTIVE" },
        orderBy: [{ severity: "desc" }, { urgency: "desc" }],
        take: limit,
      });
      return {
        render: { type: "pain-points", data: painPoints },
        text: `Retrieved ${painPoints.length} pain points`,
      };
    }

    case "get_opportunities": {
      const limit = Number(input.limit ?? 10);
      const opportunities = await prisma.opportunity.findMany({
        where: { workspaceId },
        orderBy: { totalScore: "desc" },
        take: limit,
        include: { painPoint: { select: { title: true } } },
      });
      return {
        render: { type: "opportunities", data: opportunities },
        text: `Retrieved ${opportunities.length} opportunities`,
      };
    }

    case "get_insights": {
      const limit = Number(input.limit ?? 10);
      const where: Record<string, unknown> = { workspaceId };
      if (input.type) where.type = input.type;
      const insights = await prisma.insight.findMany({
        where,
        orderBy: { confidence: "desc" },
        take: limit,
      });
      return {
        render: { type: "insights", data: insights },
        text: `Retrieved ${insights.length} insights`,
      };
    }

    case "view_documents": {
      const limit = Number(input.limit ?? 10);
      const where: Record<string, unknown> = { workspaceId };
      if (input.status) where.status = input.status;
      const documents = await prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, title: true, status: true, sourceType: true, createdAt: true, fileType: true },
      });
      return {
        render: { type: "documents", data: documents },
        text: `Retrieved ${documents.length} documents`,
      };
    }

    case "synthesize_workspace": {
      const result = await synthesizeWorkspace(workspaceId);
      const data = {
        painPoints: result.painPoints?.length ?? 0,
        opportunities: result.opportunities?.length ?? 0,
        message: "Synthesis completed successfully",
      };
      return {
        render: { type: "synthesis", data },
        text: `Synthesis complete: ${data.painPoints} pain points, ${data.opportunities} opportunities`,
      };
    }

    case "generate_prd": {
      const prd = await generatePRD({
        workspaceId,
        opportunityId: input.opportunityId as string | undefined,
        userInstruction: input.title as string | undefined,
      });
      const summary = prd.content.split("\n").filter((l) => l.trim() && !l.startsWith("#")).slice(0, 3).join(" ");
      return {
        render: { type: "prd", data: { title: prd.title, executiveSummary: summary, id: prd.id } },
        text: `PRD generated: "${prd.title}"`,
      };
    }

    case "suggest_features": {
      const focus = String(input.focus ?? "");
      const count = Number(input.count ?? 5);

      // Fetch pain points and opportunities for context
      const [painPoints, opportunities] = await Promise.all([
        prisma.painPoint.findMany({ where: { workspaceId, status: "ACTIVE" }, orderBy: { severity: "desc" }, take: 8 }),
        prisma.opportunity.findMany({ where: { workspaceId }, orderBy: { totalScore: "desc" }, take: 5 }),
      ]);

      const context = [
        "Top Pain Points:",
        ...painPoints.map((p) => `- ${p.title} (severity ${p.severity}): ${p.description}`),
        "\nTop Opportunities:",
        ...opportunities.map((o) => `- ${o.title} (score ${Number(o.totalScore).toFixed(0)}): ${o.problemStatement}`),
      ].join("\n");

      const prompt = `Based on these customer pain points and product opportunities, generate ${count} concrete feature suggestions${focus ? ` focused on "${focus}"` : ""}.

${context}

Return a JSON array of features with this shape:
[{"title": "Feature name", "description": "What it does and why it matters", "priority": "High|Medium|Low", "effort": "Small|Medium|Large", "addresses": "Which pain point(s) it resolves"}]

Return only the JSON array, no markdown.`;

      const raw = await ai.generateText({ system: "", messages: [{ role: "user", content: prompt }] });
      const clean = raw.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      const features = JSON.parse(clean);

      return {
        render: { type: "features", data: features },
        text: `Generated ${features.length} feature suggestions${focus ? ` for "${focus}"` : ""}`,
      };
    }

    case "create_workflow": {
      const description = String(input.description ?? "");

      const prompt = `Design a detailed step-by-step user workflow for: "${description}"

Return a JSON array of workflow steps:
[{"step": 1, "title": "Step name", "actor": "User|System|Support", "description": "What happens in this step", "outcome": "Result of this step"}]

Include 5-10 steps. Return only the JSON array, no markdown.`;

      const raw = await ai.generateText({ system: "", messages: [{ role: "user", content: prompt }] });
      const clean = raw.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      const steps = JSON.parse(clean);

      return {
        render: { type: "workflow", data: steps },
        text: `Created workflow for "${description}" with ${steps.length} steps`,
      };
    }

    case "analyze_segment": {
      const segment = String(input.segment ?? "");

      // Get evidence + pain points related to this segment
      const queryEmbedding = await ai.embedText(segment);
      const vectorStr = `[${queryEmbedding.join(",")}]`;

      const chunks = await prisma.$queryRaw<Array<{ id: string; content: string; title: string; similarity: number }>>`
        SELECT dc.id, dc.content, d.title,
               1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
        FROM "DocumentChunk" dc
        JOIN "Document" d ON d.id = dc."documentId"
        WHERE dc."workspaceId" = ${workspaceId}
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> ${vectorStr}::vector
        LIMIT 10`;

      const painPoints = await prisma.painPoint.findMany({
        where: { workspaceId, status: "ACTIVE" },
        orderBy: { severity: "desc" },
        take: 15,
      });

      const context = [
        `Relevant evidence for "${segment}":`,
        ...chunks.slice(0, 5).map((c) => `- ${c.title}: ${c.content.substring(0, 200)}...`),
        "\nAll pain points:",
        ...painPoints.map((p) => `- ${p.title} (S:${p.severity} U:${p.urgency})`),
      ].join("\n");

      const analysis = await ai.generateText({
        system: "",
        messages: [{
          role: "user",
          content: `Analyze what the customer segment "${segment}" needs based on this workspace evidence. Identify their top 3-5 pain points, what they want most, and specific recommendations.\n\n${context}\n\nBe specific and reference the evidence. Format as markdown.`,
        }],
      });

      return {
        render: { type: "text", data: analysis },
        text: `Analyzed "${segment}" segment`,
      };
    }

    default:
      return { render: { type: "text", data: `Unknown tool: ${name}` }, text: `Unknown tool: ${name}` };
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  try {
    await requireWorkspaceAccess(workspaceId);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  let messages: Array<{ role: string; content: string }>;
  try {
    const body = await req.json();
    messages = body.messages ?? [];
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Build Anthropic messages from simple conversation history
        const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const MAX_ITERATIONS = 8;

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const response = await getAnthropicClient().messages.create({
            model: "claude-opus-4-5",
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools: AGENT_TOOLS,
            messages: anthropicMessages,
            stream: true,
          });

          let stopReason = "";
          const toolUses: Array<{ id: string; name: string; inputRaw: string }> = [];
          let currentToolId: string | null = null;
          let currentToolName: string | null = null;
          let currentToolInput = "";
          let textContent = "";
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const assistantContent: unknown[] = [];
          // Track last character emitted to fix missing spaces after sentence-ending punctuation
          let lastChar = "";

          for await (const event of response) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                currentToolId = event.content_block.id;
                currentToolName = event.content_block.name;
                currentToolInput = "";
                emit({
                  type: "tool_start",
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: {},
                });
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                let text = event.delta.text;
                // Inject missing space when a sentence-ending punctuation is immediately
                // followed by an uppercase letter (chunk boundary artifact from the model).
                if (text && lastChar && /[.!?]/.test(lastChar) && /[A-Z]/.test(text[0])) {
                  text = " " + text;
                }
                if (text) lastChar = text[text.length - 1];
                textContent += text;
                emit({ type: "text_delta", content: text });
              } else if (event.delta.type === "input_json_delta" && currentToolId) {
                currentToolInput += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolId && currentToolName) {
                toolUses.push({ id: currentToolId, name: currentToolName, inputRaw: currentToolInput });
                currentToolId = null;
                currentToolName = null;
                currentToolInput = "";
              }
            } else if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason ?? "";
            }
          }

          // Build assistant content for multi-turn — use string for simplicity when there are tool uses
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const assistantPayload: any[] = [];
          if (textContent) {
            assistantPayload.push({ type: "text", text: textContent });
          }
          for (const tu of toolUses) {
            let parsedInput: Record<string, unknown> = {};
            try { parsedInput = JSON.parse(tu.inputRaw || "{}"); } catch { /* ignore */ }
            assistantPayload.push({ type: "tool_use", id: tu.id, name: tu.name, input: parsedInput });
          }

          anthropicMessages.push({ role: "assistant", content: assistantPayload });

          if (stopReason !== "tool_use" || toolUses.length === 0) break;

          // Execute all tool calls and collect results
          const toolResultContent: Anthropic.Messages.ToolResultBlockParam[] = [];

          for (const tu of toolUses) {
            let parsedInput: ToolInput = {};
            try { parsedInput = JSON.parse(tu.inputRaw || "{}"); } catch { /* ignore */ }

            try {
              const result = await executeTool(tu.name, parsedInput, workspaceId);
              emit({ type: "tool_result", id: tu.id, name: tu.name, render: result.render });
              toolResultContent.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: result.text,
              });
            } catch (toolErr) {
              const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
              emit({ type: "tool_result", id: tu.id, name: tu.name, render: { type: "text", data: `Error: ${errMsg}` } });
              toolResultContent.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: `Error: ${errMsg}`,
                is_error: true,
              });
            }
          }

          anthropicMessages.push({ role: "user", content: toolResultContent });
        }

        emit({ type: "done" });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Agent error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

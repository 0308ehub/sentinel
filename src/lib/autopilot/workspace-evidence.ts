export interface FiledEvidence {
  source: "ticket" | "slack";
  title: string;
  body: string;
  author: string;
  url: string;
  occurredAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function when(value: unknown): string {
  const raw = text(value, 40);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
}

function isFiled(node: Record<string, unknown>): boolean {
  if (node.type === "CUSTOMER_PROBLEM" || node.type === "SUPPORT_TICKET") return true;
  if (node.type !== "ENGINEERING_TASK") return false;
  const meta = isRecord(node.metadata) ? node.metadata : {};
  const tags = Array.isArray(node.tags) ? node.tags : [];
  return meta.kind === "bug" || tags.includes("bug");
}

function kindOf(type: unknown): string {
  if (type === "CUSTOMER_PROBLEM") return "Customer problem";
  if (type === "SUPPORT_TICKET") return "Support ticket";
  return "Bug";
}

function filedNode(node: Record<string, unknown>): FiledEvidence | null {
  if (!isFiled(node)) return null;
  const title = text(node.title, 180);
  const id = text(node.id, 120);
  if (!title || !id) return null;
  const meta = isRecord(node.metadata) ? node.metadata : {};
  const page = text(meta.page, 200);
  const detail = text(node.description, 1000) || text(meta.repro, 1000);
  return {
    source: "ticket",
    title,
    body: [kindOf(node.type), page ? `Seen on ${page}.` : "", detail].filter(Boolean).join(" ").slice(0, 1500),
    author: "Kismet",
    url: `kismet://node/${id}`,
    occurredAt: when(node.createdAt),
  };
}

/** Bugs and customer problems saved on the product graph. */
export function evidenceFromGraph(data: unknown): FiledEvidence[] {
  if (!isRecord(data) || !Array.isArray(data.nodes)) return [];
  const found: FiledEvidence[] = [];
  for (const node of data.nodes) {
    if (!isRecord(node)) continue;
    const item = filedNode(node);
    if (item) found.push(item);
  }
  return found.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 20);
}

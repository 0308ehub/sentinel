import { graphStore } from "@/lib/graph/graph-store";
import { readPages } from "@/lib/work-context";
import { CURRENT_USER } from "@/lib/settings";

export async function fileBugFromChat(note: string, productId: string): Promise<{ id: string; title: string } | null> {
  const pages = readPages();
  const latest = pages[0];
  const page = latest ? `${latest.path}\n${latest.title}\n${latest.text}` : "";
  const res = await fetch("/api/issues/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note, page }),
  });
  const body = (await res.json()) as { title?: string; repro?: string; platform?: string };
  if (!res.ok || !body.title) return null;
  const id = graphStore.getState().fileIssue({
    title: body.title,
    repro: body.repro || note,
    platform: body.platform || "Web",
    page: latest?.path,
    ownerId: CURRENT_USER.id,
    productId,
  });
  return { id, title: body.title };
}

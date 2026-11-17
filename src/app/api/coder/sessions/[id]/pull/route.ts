import { coderRouteError, coderUser } from "@/lib/coder/routes";
import { CoderError, coderSessionRow, coderSessionView } from "@/lib/coder/sessions";
import { createPullFromBranch, repoDefaultBranch } from "@/lib/github/client";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await coderUser();
  if (userId instanceof Response) return userId;
  const { id } = await context.params;
  try {
    const [row, view] = await Promise.all([coderSessionRow(userId, id), coderSessionView(userId, id)]);
    if (!view.branch) throw new CoderError("The coding agent has not pushed a branch yet.", 409);
    const lastAgent = [...view.items].reverse().find((item) => item.kind === "agent");
    const body = `Kismet's coding agent made this change.\n\n${lastAgent?.text.slice(0, 4000) ?? ""}`.trim();
    const base = await repoDefaultBranch(row.repo);
    return Response.json(await createPullFromBranch(row.repo, view.branch, base, row.title, body));
  } catch (error) {
    return coderRouteError("open pull request", error);
  }
}

import { getJiraStatus, jiraErrorResponse } from "@/lib/jira/client";

export async function GET() {
  try {
    return Response.json(await getJiraStatus());
  } catch (error) {
    return jiraErrorResponse(error);
  }
}

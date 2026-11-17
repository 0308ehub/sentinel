export async function GET() {
  const available = Boolean(process.env.SLACK_CLIENT_ID?.trim() && process.env.SLACK_CLIENT_SECRET?.trim());
  return Response.json({ available });
}

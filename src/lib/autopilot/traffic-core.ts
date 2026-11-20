const BOT_USER_AGENT =
  /bot\b|spider|crawler|crawl|slurp|headless|phantom|wget|curl\/|python-requests|go-http-client|bytespider|petalbot|ahrefs|semrush|facebookexternalhit|embedly|pinterest|slackbot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|bingpreview|google-inspectiontool/i;

/** Known crawlers. Empty and ordinary browser or server agents are kept. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const value = userAgent?.trim() ?? "";
  if (!value) return false;
  return BOT_USER_AGENT.test(value);
}

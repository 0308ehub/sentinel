export const SNAPSHOT_HTML_MAX_BYTES = 2 * 1024 * 1024;

/** Removes active content while preserving the rendered document's text and inline styles. */
export function sanitizeSnapshotHtml(html: string): string {
  if (new TextEncoder().encode(html).byteLength > SNAPSHOT_HTML_MAX_BYTES) {
    throw new Error("Snapshot HTML is larger than 2 MB.");
  }
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*\/?\s*>/gi, "")
    // A refresh would navigate the frame away; a base tag would retarget every link.
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|action|formaction|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/\s+(href|src|action|formaction|xlink:href)\s*=\s*javascript:[^\s>]*/gi, "");
}

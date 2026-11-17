const LIST_ITEM = /^\s*(?:[-*+]\s+|\d+[.)]\s+)(.*)$/;

export function splitSetupContext(text: string): string[] {
  const items: string[] = [];
  let current: string[] = [];

  function finish() {
    const item = current.join(" ").replace(/\s+/g, " ").trim();
    if (item.length >= 15) items.push(item);
    current = [];
  }

  for (const line of text.trim().split(/\r?\n/)) {
    const listItem = line.match(LIST_ITEM);
    if (!line.trim()) {
      finish();
    } else if (listItem) {
      finish();
      current.push(listItem[1]);
    } else {
      current.push(line.trim());
    }
  }
  finish();
  return items.slice(0, 20);
}

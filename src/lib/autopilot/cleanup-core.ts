export function codeAlreadyRemoved(flag: string, texts: (string | null)[]): boolean {
  return texts.length > 0 && texts.every((text) => text == null || !text.includes(flag));
}

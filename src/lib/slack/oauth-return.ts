// Only plain in-app paths: no scheme, host, backslash, whitespace or control characters,
// which URL parsers strip or reinterpret (e.g. "/\t/evil.com" becomes "//evil.com").
const SAFE_PATH = /^\/(?![/\\])[A-Za-z0-9\-._~/?=&%]*$/;

export function validOAuthReturnPath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length <= 200 && SAFE_PATH.test(value);
}

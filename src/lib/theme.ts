export const THEME_KEY = "kismet-theme";
export type ThemeName = "light" | "dark" | "system";

export function readTheme(): ThemeName {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light" || stored === "system") return stored;
  return "light";
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: ThemeName) {
  const dark = theme === "dark" || (theme === "system" && systemDark());
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem(THEME_KEY, theme);
  document.cookie = `${THEME_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
}

let media: MediaQueryList | null = null;

function onSystemChange() {
  if (readTheme() === "system") applyTheme("system");
}

export function syncTheme() {
  applyTheme(readTheme());
  media?.removeEventListener("change", onSystemChange);
  media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onSystemChange);
}

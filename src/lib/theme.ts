export const THEME_KEY = "kismet-theme";
export type ThemeName = "light" | "dark";

export function readTheme(): ThemeName {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
  document.cookie = `${THEME_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
}

export function syncTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") {
    applyTheme(stored);
    return;
  }
  applyTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
}

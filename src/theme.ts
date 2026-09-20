import { settings, type Theme } from "./storage";

/**
 * "system" leaves the stylesheet's prefers-color-scheme rules in charge;
 * "light"/"dark" stamp data-theme on <html> to override them.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

export function initTheme(): Theme {
  const theme = settings.theme();
  applyTheme(theme);
  return theme;
}

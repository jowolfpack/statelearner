import { settings, type Theme } from "./storage";

/**
 * Dark is the stylesheet's default; data-theme is stamped either way so the
 * document always states the theme it is actually showing.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function initTheme(): Theme {
  const theme = settings.theme();
  applyTheme(theme);
  return theme;
}

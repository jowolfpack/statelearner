import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so `dist/` works from any subpath (GitHub Pages, file://).
  base: "./",
  // Open the browser on `npm run dev`, so start.cmd is a single double-click.
  server: { open: true },
});

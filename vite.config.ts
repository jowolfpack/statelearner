import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so `dist/` works from any subpath (GitHub Pages, file://).
  base: "./",
  // Open the browser on `npm run dev`, so start.cmd is a single double-click.
  // strictPort matters: without it a second instance silently takes 5174 and
  // you end up with two servers and two tabs.
  server: { open: true, strictPort: true },
});

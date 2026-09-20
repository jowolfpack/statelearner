import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Most suites are pure; the smoke test opts into a DOM via an
    // @vitest-environment docblock. The forks pool times out starting a jsdom
    // worker on Windows, so use threads.
    environment: "node",
    pool: "threads",
  },
});

import { defineConfig } from "vitest/config";

// Each workspace with a vitest.config.ts is a project. Tests import the built
// packages through their real package.json exports, so `npm test` builds first.
export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.ts"],
  },
});

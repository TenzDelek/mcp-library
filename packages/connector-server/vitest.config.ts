import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Live tests hit the real library and need LIBRARY_API_KEY; run them via `npm run test:live`.
const live = Boolean(process.env.LIBRARY_API_KEY && process.env.VITEST_LIVE);

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    name: "connector-server",
    include: live ? ["test/live/**/*.test.ts"] : ["test/**/*.test.ts"],
    exclude: live ? ["**/node_modules/**"] : ["test/live/**", "**/node_modules/**"],
  },
});

import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "wrappers/**", "optimization/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
    rules: {
      // stdout is the MCP protocol channel on stdio; all logging goes through the stderr logger.
      "no-console": "error",
    },
  },
  {
    files: ["**/bin/**/*.ts", "**/scripts/**/*.ts", "**/test/**/*.ts", "scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
);

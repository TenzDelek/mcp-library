import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // stdout is the MCP protocol channel on stdio; all logging goes through the stderr logger.
      "no-console": "error",
    },
  },
  {
    files: ["bin/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"],
    rules: { "no-console": "off" },
  },
);

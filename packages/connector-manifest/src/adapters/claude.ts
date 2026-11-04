/**
 * Claude plugin + marketplace at the repo root.
 * The repo root IS the plugin: `.claude-plugin/plugin.json` + `skills/`.
 * MCP servers are declared inline in plugin.json rather than in a root
 * `.mcp.json`, because a root `.mcp.json` doubles as Claude Code's project
 * config and `${user_config.*}` only resolves inside a plugin.
 */
import { json, localServerConfig, type FileSet, type GenerateContext, type WrapperAdapter } from "./types.js";

export const claudeAdapter: WrapperAdapter = {
  id: "claude",
  owns: [".claude-plugin/"],
  emit(ctx: GenerateContext): FileSet {
    const c = ctx.connector;
    const host = c.hosts.claude;
    const local = host.mode === "local";
    const server = local
      ? localServerConfig(ctx, "${user_config.library_api_key}")
      : { type: "http", url: c.server.remote.url };

    const plugin: Record<string, unknown> = {
      name: c.name,
      displayName: c.displayName,
      version: c.version,
      description: c.description,
      author: c.author,
      homepage: c.homepage,
      ...(c.repository && { repository: c.repository }),
      license: c.license,
      keywords: host.keywords,
      mcpServers: { [c.server.name]: server },
      ...(local && {
        userConfig: {
          library_api_key: {
            type: "string",
            title: "WeBuddhist Library API key",
            description: "Issued by the WeBuddhist library team. Stored in your secure credential store and passed only to the local connector process.",
            sensitive: true,
            required: true,
          },
        },
      }),
    };

    const marketplace = {
      name: host.marketplace,
      owner: c.author,
      description: `${c.displayName} for Claude Code, claude.ai and Cowork.`,
      metadata: { version: c.version },
      plugins: [
        {
          name: c.name,
          source: "./",
          description: c.description,
          version: c.version,
          ...(host.category && { category: host.category }),
          tags: host.keywords,
        },
      ],
    };

    return new Map([
      [".claude-plugin/plugin.json", json(plugin)],
      [".claude-plugin/marketplace.json", json(marketplace)],
    ]);
  },
};

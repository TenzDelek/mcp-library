/**
 * Gemini CLI extension at the repo root: gemini-extension.json + GEMINI.md,
 * sharing the root skills/ directory. Installable with
 * `gemini extensions install <github url>`.
 */
import { json, localServerConfig, mdHeader, skillsTable, toolsTable, type FileSet, type GenerateContext, type WrapperAdapter } from "./types.js";

export const geminiAdapter: WrapperAdapter = {
  id: "gemini",
  owns: ["gemini-extension.json", "GEMINI.md"],
  emit(ctx: GenerateContext): FileSet {
    const c = ctx.connector;
    const host = c.hosts.gemini;
    const local = host.mode === "local";
    const envKey = c.server.local.envKey;
    const server = local ? localServerConfig(ctx, `$${envKey}`) : { httpUrl: c.server.remote.url };

    const manifest: Record<string, unknown> = {
      name: c.name,
      version: c.version,
      description: c.description,
      contextFileName: host.contextFileName,
      mcpServers: { [c.server.name]: server },
      ...(local && {
        settings: [
          {
            name: envKey,
            description: "WeBuddhist Library API key (issued by the library team). Passed only to the local connector process.",
            envVar: envKey,
            sensitive: true,
          },
        ],
      }),
    };

    const context = `${mdHeader()}# ${c.displayName}

${c.description}

## How the library is organised

${ctx.instructions}

## Skills

Load the matching skill before answering; each one names the exact tool sequence to use.

${skillsTable(ctx)}

## Tools (MCP server \`${c.server.name}\`)

${toolsTable(ctx)}
`;

    return new Map([
      ["gemini-extension.json", json(manifest)],
      [host.contextFileName, context],
    ]);
  },
};

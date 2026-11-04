import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolConfig } from "./config.js";
import type { LibraryClient } from "@webuddhist/library-client";
import { INSTRUCTIONS } from "./instructions.js";
import { registerTools, type ToolOverrides } from "./tools/index.js";
import { SERVER_NAME, VERSION } from "./version.js";

export interface ServerDeps {
  library: LibraryClient;
  config: ToolConfig;
}


/**
 * Overrides let the optimization loop evaluate candidate prompt text without
 * touching source: server instructions and per-tool descriptions.
 */
export interface ServerOverrides {
  instructions?: string;
  toolDescriptions?: Record<string, string>;
}

/** Transport-agnostic server factory. Entrypoints only pick a transport. */
export function createServer(deps: ServerDeps, overrides: ServerOverrides = {}): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION }, { instructions: overrides.instructions ?? INSTRUCTIONS });
  const toolOverrides: ToolOverrides = { descriptions: overrides.toolDescriptions ?? {} };
  registerTools(server, deps, toolOverrides);
  return server;
}

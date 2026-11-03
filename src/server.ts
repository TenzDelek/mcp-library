import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolConfig } from "./config.js";
import type { LibraryClient } from "./library/client.js";
import { registerTools } from "./tools/index.js";
import { SERVER_NAME, VERSION } from "./version.js";

export interface ServerDeps {
  library: LibraryClient;
  config: ToolConfig;
}

const INSTRUCTIONS = `WeBuddhist Library: Buddhist texts (Tibetan canon and more), their editions, translations, commentaries, segments, alignments, people and recordings.
Id kinds: a *text* is a work; an *edition* is a readable version of a text (read_edition, list_segments need an edition id); a *segment* is a paragraph/verse of an edition.
Typical flow: search_texts or search_content -> get_text (to see editions) -> read_edition / list_segments -> get_aligned_segments to compare with a translation.
Content positions are Unicode code points, end-exclusive. Lists have no totals; follow next_offset while has_more.`;

/** Transport-agnostic server factory. bin/stdio.ts and bin/http.ts only pick a transport. */
export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: VERSION }, { instructions: INSTRUCTIONS });
  registerTools(server, deps);
  return server;
}

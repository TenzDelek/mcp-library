import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { runTool, type ToolDef, type ToolDeps } from "./_shared.js";
import { searchTexts } from "./search-texts.js";
import { getText } from "./get-text.js";
import { readEdition } from "./read-edition.js";
import { searchContent } from "./search-content.js";
import { getSegment } from "./get-segment.js";
import { listSegments } from "./list-segments.js";
import { getAlignedSegments } from "./get-aligned-segments.js";
import { getEdition } from "./get-edition.js";
import { getPerson, searchPersons } from "./persons.js";
import { browseCategories } from "./categories.js";
import { listLanguages, listTags } from "./reference.js";
import { getRecording } from "./get-recording.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: ReadonlyArray<ToolDef<any>> = [
  searchTexts,
  getText,
  readEdition,
  searchContent,
  getSegment,
  listSegments,
  getAlignedSegments,
  getEdition,
  searchPersons,
  getPerson,
  browseCategories,
  listTags,
  listLanguages,
  getRecording,
];

export function registerTools(server: McpServer, deps: ToolDeps): void {
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema as z.ZodRawShape,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      },
      (args: unknown) => runTool(tool, deps, args as never),
    );
  }
}

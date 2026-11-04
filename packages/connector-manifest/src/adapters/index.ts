import { claudeAdapter } from "./claude.js";
import { docsAdapter } from "./docs.js";
import { dshAdapter } from "./dsh.js";
import { geminiAdapter } from "./gemini.js";
import { repoAdapter } from "./repo.js";
import type { WrapperAdapter } from "./types.js";

export const ADAPTERS: readonly WrapperAdapter[] = [repoAdapter, claudeAdapter, geminiAdapter, dshAdapter, docsAdapter];
export { claudeAdapter, geminiAdapter, dshAdapter, docsAdapter, repoAdapter };
export * from "./types.js";

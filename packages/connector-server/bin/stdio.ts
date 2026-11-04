#!/usr/bin/env node
/**
 * stdio entrypoint. Launched by MCP clients (Claude Desktop, Cursor, ...).
 * stdout is the protocol channel; all diagnostics go to stderr.
 *   --check   call /__/health and exit (verifies config + connectivity)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConfigError, loadConfig, redactedConfig } from "../src/config.js";
import { createHttpLibraryClient } from "@webuddhist/library-client";
import { log } from "../src/log.js";
import { createServer } from "../src/server.js";
import { SERVER_NAME, VERSION } from "../src/version.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      log.error(e.message);
      log.error("Set LIBRARY_API_KEY (and optionally LIBRARY_API_URL, LIBRARY_APP_NAME) in the MCP client's env for this server.");
      process.exit(2);
    }
    throw e;
  }
  const library = createHttpLibraryClient(config);

  if (process.argv.includes("--check")) {
    const health = await library.health();
    log.info(`${SERVER_NAME} ${VERSION} config ok`, redactedConfig(config));
    log.info("library health", health);
    // Confirm the key is accepted by hitting one authenticated, cheap endpoint.
    const languages = await library.listLanguages();
    log.info(`API key accepted; ${languages.length} languages available`);
    return;
  }

  const server = createServer({ library, config: { preferredLanguages: config.preferredLanguages } });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info(`${SERVER_NAME} ${VERSION} listening on stdio`, redactedConfig(config));
}

main().catch((err: unknown) => {
  log.error("fatal", { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
  process.exit(1);
});

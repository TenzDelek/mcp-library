#!/usr/bin/env node
/**
 * Streamable HTTP entrypoint (stateless). Phase A: static bearer only;
 * Phase B replaces this with the Auth0 resource server (see docs/adr/0003). For hosted deployments where the
 * library API key must stay server-side.
 *
 * Inbound auth: every request must carry `Authorization: Bearer $MCP_BEARER_TOKEN`.
 * This process is effectively a proxy for the library API key, so it refuses
 * to start without MCP_BEARER_TOKEN. Put a real identity layer (OAuth / IAP)
 * in front of it before exposing it to end users.
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createHttpLibraryClient } from "@webuddhist/library-client";
import { ConfigError, createServer, loadConfig, log, redactedConfig, SERVER_NAME, VERSION } from "@webuddhist/connector-server";

const MCP_PATH = "/mcp";

function bearerOk(req: IncomingMessage, expected: string): boolean {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      log.error(e.message);
      process.exit(2);
    }
    throw e;
  }
  const bearer = process.env.MCP_BEARER_TOKEN;
  if (!bearer || bearer.length < 16) {
    log.error("MCP_BEARER_TOKEN (>= 16 chars) is required for the HTTP entrypoint; refusing to start.");
    process.exit(2);
  }
  const port = Number(process.env.MCP_HTTP_PORT ?? 3000);
  const library = createHttpLibraryClient(config);
  const deps = { library, config: { preferredLanguages: config.preferredLanguages } };

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/healthz") return json(res, 200, { ok: true, name: SERVER_NAME, version: VERSION });
    if (url.pathname !== MCP_PATH) return json(res, 404, { error: "not found" });
    if (!bearerOk(req, bearer)) {
      res.setHeader("WWW-Authenticate", "Bearer");
      return json(res, 401, { error: "unauthorized" });
    }
    // Stateless: a fresh server + transport per request; nothing is kept between calls.
    const server = createServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      log.error("request failed", { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
      if (!res.headersSent) json(res, 500, { error: "internal error" });
    }
  });

  httpServer.listen(port, () => {
    log.info(`${SERVER_NAME} ${VERSION} listening on http://0.0.0.0:${port}${MCP_PATH}`, redactedConfig(config));
  });
}

main().catch((err: unknown) => {
  log.error("fatal", { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
  process.exit(1);
});

/**
 * Drives createServer() through a real MCP Client over an in-memory transport,
 * so tests exercise exactly the interface that MCP clients see.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { createFakeLibraryClient, type FakeLibraryClient, type Seed } from "@webuddhist/library-client/testing";

export interface Harness {
  client: Client;
  fake: FakeLibraryClient;
  /** Calls a tool and returns the parsed JSON payload; throws with the error text on isError. */
  call<T = Record<string, unknown>>(name: string, args?: Record<string, unknown>): Promise<T>;
  /** Calls a tool expecting isError and returns the error text. */
  callError(name: string, args?: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

export async function createHarness(overrides: Partial<Seed> = {}, preferredLanguages = ["en", "bo"]): Promise<Harness> {
  const fake = createFakeLibraryClient(overrides);
  const server = createServer({ library: fake, config: { preferredLanguages } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);

  async function raw(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const content = (result.content as Array<{ type: string; text?: string }>) ?? [];
    const text = content.find((c) => c.type === "text")?.text ?? "";
    return { isError: Boolean(result.isError), text };
  }

  return {
    client,
    fake,
    async call(name, args = {}) {
      const r = await raw(name, args);
      if (r.isError) throw new Error(`tool ${name} returned error: ${r.text}`);
      return JSON.parse(r.text);
    },
    async callError(name, args = {}) {
      const r = await raw(name, args);
      if (!r.isError) throw new Error(`tool ${name} unexpectedly succeeded: ${r.text}`);
      return r.text;
    },
    async close() {
      await client.close();
      await server.close();
    },
  };
}

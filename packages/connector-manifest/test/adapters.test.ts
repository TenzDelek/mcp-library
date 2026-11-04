import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADAPTERS, buildContext, checkFileSet, emitAll, loadConnector, writeFileSet, type Connector } from "../src/index.js";

const connector: Connector = {
  name: "demo-connector",
  displayName: "Demo Connector",
  description: "Demo.",
  version: "1.2.3",
  license: "MIT",
  homepage: "https://github.com/acme/demo-connector",
  repository: "https://github.com/acme/demo-connector",
  author: { name: "Acme" },
  server: {
    name: "demo-library",
    remote: { url: "https://demo.example/mcp" },
    local: { command: "npx", args: ["-y", "@acme/demo-server"], envKey: "DEMO_KEY" },
  },
  skills: { dir: "skills" },
  hosts: {
    claude: { mode: "local", marketplace: "acme", category: "research", keywords: ["demo"] },
    gemini: { mode: "local", contextFileName: "GEMINI.md" },
    dsh: { packageName: "@acme/demo-dsh", engines: ">=0.1.0" },
  },
};

function tempRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "connector-"));
  writeFileSync(join(root, "connector.json"), JSON.stringify(connector));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", version: "0.0.0", workspaces: ["packages/*"] }, null, 2) + "\n");
  mkdirSync(join(root, "skills/demo-skill/references"), { recursive: true });
  writeFileSync(
    join(root, "skills/demo-skill/SKILL.md"),
    `---\nname: demo-skill\ndescription: Demo skill. Use for demos.\nmetadata:\n  tools: search_texts\n---\nCall \`search_texts\`.\n`,
  );
  writeFileSync(join(root, "skills/demo-skill/references/notes.md"), "notes\n");
  return root;
}

function ctxFor(root: string) {
  return buildContext(loadConnector(root), [{ name: "search_texts", title: "Search texts", description: "Find texts. More." }], "Instructions here.");
}

describe("adapters", () => {
  it("emit the expected files with the manifest stamped in", () => {
    const files = emitAll(ctxFor(tempRepo()), ADAPTERS);
    expect([...files.keys()].sort()).toEqual([
      ".claude-plugin/marketplace.json",
      ".claude-plugin/plugin.json",
      "GEMINI.md",
      "docs/install/chatgpt.md",
      "docs/install/claude-code.md",
      "docs/install/claude.md",
      "docs/install/deepseek-harness.md",
      "docs/install/gemini-cli.md",
      "docs/install/skills-cli.md",
      "gemini-extension.json",
      "packages/connector-manifest/connector.schema.json",
      "packages/connector-server/src/version.ts",
      "skills/README.md",
      "wrappers/dsh-bundle/README.md",
      "wrappers/dsh-bundle/cordis.patch.yml",
      "wrappers/dsh-bundle/package.json",
      "wrappers/dsh-bundle/skills/demo-skill/SKILL.md",
      "wrappers/dsh-bundle/skills/demo-skill/references/notes.md",
    ]);
    const plugin = JSON.parse(files.get(".claude-plugin/plugin.json")!);
    expect(plugin).toMatchObject({
      name: "demo-connector",
      version: "1.2.3",
      mcpServers: { "demo-library": { command: "npx", args: ["-y", "@acme/demo-server"], env: { DEMO_KEY: "${user_config.library_api_key}" } } },
      userConfig: { library_api_key: { sensitive: true, required: true } },
    });
    const marketplace = JSON.parse(files.get(".claude-plugin/marketplace.json")!);
    expect(marketplace.plugins[0]).toMatchObject({ name: "demo-connector", source: "./", version: "1.2.3" });
    const gemini = JSON.parse(files.get("gemini-extension.json")!);
    expect(gemini.mcpServers["demo-library"].env).toEqual({ DEMO_KEY: "$DEMO_KEY" });
    expect(gemini.settings[0]).toMatchObject({ envVar: "DEMO_KEY", sensitive: true });
    expect(files.get("GEMINI.md")).toContain("`demo-skill`");
    expect(files.get("GEMINI.md")).toContain("| `search_texts` | Find texts. |");
    expect(files.get("packages/connector-server/src/version.ts")).toContain('VERSION = "1.2.3"');
    expect(files.get("packages/connector-server/src/version.ts")).toContain('SERVER_NAME = "demo-library"');
    const dsh = JSON.parse(files.get("wrappers/dsh-bundle/package.json")!);
    expect(dsh).toMatchObject({ name: "@acme/demo-dsh", dsh: { bundle: { patch: "./cordis.patch.yml" } }, engines: { dsh: ">=0.1.0" } });
  });

  it("remote mode points hosts at the hosted URL and drops the key prompt", () => {
    const root = tempRepo();
    const remote = {
      ...connector,
      hosts: { ...connector.hosts, claude: { ...connector.hosts.claude, mode: "remote" as const }, gemini: { ...connector.hosts.gemini, mode: "remote" as const } },
    };
    writeFileSync(join(root, "connector.json"), JSON.stringify(remote));
    const files = emitAll(ctxFor(root), ADAPTERS);
    const plugin = JSON.parse(files.get(".claude-plugin/plugin.json")!);
    expect(plugin.mcpServers["demo-library"]).toEqual({ type: "http", url: "https://demo.example/mcp" });
    expect(plugin.userConfig).toBeUndefined();
    const gemini = JSON.parse(files.get("gemini-extension.json")!);
    expect(gemini.mcpServers["demo-library"]).toEqual({ httpUrl: "https://demo.example/mcp" });
    expect(gemini.settings).toBeUndefined();
  });

  it("writes, then reports no drift, then reports changed and extra files", () => {
    const root = tempRepo();
    const files = emitAll(ctxFor(root), ADAPTERS);
    const { written, removed } = writeFileSet(root, files, ADAPTERS);
    expect(written.length).toBe(files.size);
    expect(removed).toEqual([]);
    expect(checkFileSet(root, files, ADAPTERS)).toEqual([]);

    writeFileSync(join(root, "GEMINI.md"), "edited by hand\n");
    writeFileSync(join(root, "wrappers/dsh-bundle/stale.txt"), "x");
    expect(checkFileSet(root, files, ADAPTERS)).toEqual(
      expect.arrayContaining([
        { path: "GEMINI.md", kind: "changed", adapter: "gemini" },
        { path: "wrappers/dsh-bundle/stale.txt", kind: "extra", adapter: "dsh" },
      ]),
    );

    const again = writeFileSet(root, files, ADAPTERS);
    expect(again.removed).toEqual(["wrappers/dsh-bundle/stale.txt"]);
    expect(again.written).toEqual(["GEMINI.md"]);
    expect(existsSync(join(root, "wrappers/dsh-bundle/stale.txt"))).toBe(false);
    expect(readFileSync(join(root, "GEMINI.md"), "utf8")).toBe(files.get("GEMINI.md"));
  });
});

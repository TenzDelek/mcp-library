import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkVersions, stampVersions } from "../src/index.js";

describe("version stamping", () => {
  it("updates workspace versions and internal dependency ranges", () => {
    const root = mkdtempSync(join(tmpdir(), "ver-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", version: "0.1.0", workspaces: ["packages/*", "wrappers/x"] }, null, 2) + "\n");
    mkdirSync(join(root, "packages/a"), { recursive: true });
    mkdirSync(join(root, "wrappers/x"), { recursive: true });
    writeFileSync(join(root, "packages/a/package.json"), JSON.stringify({ name: "@webuddhist/a", version: "0.1.0", dependencies: { "@webuddhist/b": "^0.1.0", zod: "^4.0.0" } }, null, 2) + "\n");
    writeFileSync(join(root, "wrappers/x/package.json"), JSON.stringify({ name: "x", version: "0.1.0" }, null, 2) + "\n");

    expect(checkVersions(root, "0.1.0")).toEqual([]);
    expect(checkVersions(root, "0.2.0").length).toBe(3);
    expect(stampVersions(root, "0.2.0").sort()).toEqual(["package.json", "packages/a/package.json", "wrappers/x/package.json"]);
    const a = JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf8"));
    expect(a.version).toBe("0.2.0");
    expect(a.dependencies).toEqual({ "@webuddhist/b": "^0.2.0", zod: "^4.0.0" });
    expect(checkVersions(root, "0.2.0")).toEqual([]);
    expect(stampVersions(root, "0.2.0")).toEqual([]);
  });
});

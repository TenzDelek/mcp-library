import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { FileSet, GenerateContext, ToolInfo, WrapperAdapter } from "./adapters/types.js";
import type { LoadedConnector } from "./load.js";

export function buildContext(loaded: LoadedConnector, tools: ToolInfo[], instructions: string): GenerateContext {
  return { root: loaded.root, connector: loaded.connector, skills: loaded.skills, tools, instructions };
}

/** Runs every adapter; a path produced twice is a bug. */
export function emitAll(ctx: GenerateContext, adapters: readonly WrapperAdapter[]): FileSet {
  const out: FileSet = new Map();
  for (const a of adapters) {
    for (const [path, content] of a.emit(ctx)) {
      if (out.has(path)) throw new Error(`adapter ${a.id} emitted ${path}, already produced by another adapter`);
      out.set(path, content);
    }
  }
  return out;
}

export interface Drift {
  path: string;
  kind: "missing" | "changed" | "extra";
  adapter: string;
}

function listFiles(dir: string, base: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) listFiles(abs, base, out);
    else out.push(relative(base, abs).split(sep).join("/"));
  }
}

function ownedPaths(root: string, owns: string[]): string[] {
  const out: string[] = [];
  for (const o of owns) {
    if (o.endsWith("/")) listFiles(join(root, o), root, out);
    else if (existsSync(join(root, o))) out.push(o);
  }
  return out;
}

/** Compares a fresh emit with the working tree. */
export function checkFileSet(root: string, files: FileSet, adapters: readonly WrapperAdapter[]): Drift[] {
  const drift: Drift[] = [];
  // Which adapter owns which path (for reporting).
  const ownerOf = (path: string): string => adapters.find((a) => a.owns.some((o) => (o.endsWith("/") ? path.startsWith(o) : path === o)))?.id ?? "?";
  for (const [path, content] of files) {
    const abs = join(root, path);
    if (!existsSync(abs)) drift.push({ path, kind: "missing", adapter: ownerOf(path) });
    else if (readFileSync(abs, "utf8") !== content) drift.push({ path, kind: "changed", adapter: ownerOf(path) });
  }
  for (const a of adapters) {
    for (const path of ownedPaths(root, a.owns)) {
      if (!files.has(path)) drift.push({ path, kind: "extra", adapter: a.id });
    }
  }
  return drift;
}

export interface WriteResult {
  written: string[];
  removed: string[];
}

/** Writes the file set and removes stale files inside owned roots. */
export function writeFileSet(root: string, files: FileSet, adapters: readonly WrapperAdapter[]): WriteResult {
  const removed: string[] = [];
  for (const a of adapters) {
    for (const path of ownedPaths(root, a.owns)) {
      if (!files.has(path)) {
        rmSync(join(root, path));
        removed.push(path);
      }
    }
  }
  const written: string[] = [];
  for (const [path, content] of files) {
    const abs = join(root, path);
    if (existsSync(abs) && readFileSync(abs, "utf8") === content) continue;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    written.push(path);
  }
  return { written, removed };
}

/* ---------- version stamping across workspaces ---------- */

const SCOPE = "@webuddhist/";

function workspacePackageFiles(root: string): string[] {
  const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { workspaces?: string[] };
  const files = ["package.json"];
  for (const pattern of rootPkg.workspaces ?? []) {
    if (pattern.endsWith("/*")) {
      const dir = join(root, pattern.slice(0, -2));
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory() && existsSync(join(dir, e.name, "package.json"))) files.push(`${pattern.slice(0, -2)}/${e.name}/package.json`);
      }
    } else if (existsSync(join(root, pattern, "package.json"))) files.push(`${pattern}/package.json`);
  }
  return files;
}

interface PkgJson {
  version?: string;
  dependencies?: Record<string, string>;
  [k: string]: unknown;
}

function stamped(pkg: PkgJson, version: string): PkgJson {
  const next: PkgJson = { ...pkg, version };
  if (pkg.dependencies) {
    next.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).map(([k, v]) => [k, k.startsWith(SCOPE) ? `^${version}` : v]));
  }
  return next;
}

export function checkVersions(root: string, version: string): string[] {
  const problems: string[] = [];
  for (const rel of workspacePackageFiles(root)) {
    const text = readFileSync(join(root, rel), "utf8");
    const pkg = JSON.parse(text) as PkgJson;
    if (JSON.stringify(stamped(pkg, version), null, 2) + "\n" !== JSON.stringify(pkg, null, 2) + "\n") {
      problems.push(`${rel}: version/dependency ranges differ from connector.json version ${version}`);
    }
  }
  return problems;
}

export function stampVersions(root: string, version: string): string[] {
  const changed: string[] = [];
  for (const rel of workspacePackageFiles(root)) {
    const abs = join(root, rel);
    const pkg = JSON.parse(readFileSync(abs, "utf8")) as PkgJson;
    const next = JSON.stringify(stamped(pkg, version), null, 2) + "\n";
    if (next !== readFileSync(abs, "utf8")) {
      writeFileSync(abs, next);
      changed.push(rel);
    }
  }
  return changed;
}

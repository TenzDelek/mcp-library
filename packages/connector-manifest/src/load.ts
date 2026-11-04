import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ConnectorSchema, type Connector } from "./schema.js";
import { scanSkills, type Skill } from "./skills.js";

export interface LoadedConnector {
  root: string;
  connector: Connector;
  skillsDir: string;
  skills: Skill[];
}

/** Walks up from `start` to the directory holding connector.json. */
export function findRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "connector.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`connector.json not found above ${start}`);
    dir = parent;
  }
}

export function loadConnector(root: string = findRoot()): LoadedConnector {
  const raw: unknown = JSON.parse(readFileSync(join(root, "connector.json"), "utf8"));
  const parsed = ConnectorSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "$"}: ${i.message}`).join("; ");
    throw new Error(`connector.json is invalid: ${issues}`);
  }
  const skillsDir = join(root, parsed.data.skills.dir);
  return { root, connector: parsed.data, skillsDir, skills: scanSkills(skillsDir) };
}

/**
 * Scans and validates Agent Skills (https://agentskills.io/specification).
 * A skill is a directory with a SKILL.md whose frontmatter has `name` and
 * `description`. We additionally require `metadata.tools`, the comma-separated
 * list of MCP tool names the skill relies on: that is the contract between the
 * portable skills and the connector server.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

export interface SkillFile {
  /** Path relative to the skill directory, posix separators. */
  path: string;
  content: string;
}

export interface Skill {
  name: string;
  /** Absolute directory. */
  dir: string;
  /** Directory name (should equal name). */
  dirName: string;
  description: string;
  license: string | undefined;
  metadata: Record<string, string>;
  /** Tool names declared in metadata.tools. */
  tools: string[];
  body: string;
  lineCount: number;
  frontmatter: Record<string, unknown>;
  /** Every file in the skill directory, SKILL.md included. */
  files: SkillFile[];
}

export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SKILL_LINES = 500;
export const MAX_DESCRIPTION = 1024;

function walk(dir: string, base: string, out: SkillFile[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, base, out);
    else out.push({ path: relative(base, abs).split(sep).join("/"), content: readFileSync(abs, "utf8") });
  }
}

/** Returns every skill under `skillsDir`, sorted by directory name. Directories without SKILL.md are ignored. */
export function scanSkills(skillsDir: string): Skill[] {
  if (!existsSync(skillsDir)) return [];
  const skills: Skill[] = [];
  for (const entry of readdirSync(skillsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const dir = join(skillsDir, entry.name);
    const skillMd = join(dir, "SKILL.md");
    if (!existsSync(skillMd) || !statSync(skillMd).isFile()) continue;
    const text = readFileSync(skillMd, "utf8");
    const fm = parseFrontmatter(text);
    const data = fm?.data ?? {};
    const metadataRaw = data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata) ? (data.metadata as Record<string, unknown>) : {};
    const metadata = Object.fromEntries(Object.entries(metadataRaw).map(([k, v]) => [k, String(v)]));
    const files: SkillFile[] = [];
    walk(dir, dir, files);
    skills.push({
      name: typeof data.name === "string" ? data.name : "",
      dir,
      dirName: entry.name,
      description: typeof data.description === "string" ? data.description : "",
      license: typeof data.license === "string" ? data.license : undefined,
      metadata,
      tools: (metadata.tools ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      body: fm?.body ?? "",
      lineCount: text.split(/\r?\n/).length,
      frontmatter: data,
      files: files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
    });
  }
  return skills;
}

export function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

export interface ValidateOptions {
  /** When given, metadata.tools and backticked tool references are checked against it. */
  knownTools?: string[];
}

/** Returns human-readable problems; an empty array means the skill is valid. */
export function validateSkill(skill: Skill, opts: ValidateOptions = {}): string[] {
  const issues: string[] = [];
  const at = `skills/${skill.dirName}/SKILL.md`;
  if (!skill.name) issues.push(`${at}: frontmatter must declare name`);
  else {
    if (!SKILL_NAME_RE.test(skill.name) || skill.name.length > 64) issues.push(`${at}: name "${skill.name}" must be 1-64 chars of lowercase letters, digits and single hyphens`);
    if (skill.name !== skill.dirName) issues.push(`${at}: name "${skill.name}" must equal the directory name "${skill.dirName}"`);
  }
  if (!skill.description) issues.push(`${at}: frontmatter must declare description`);
  else if (skill.description.length > MAX_DESCRIPTION) issues.push(`${at}: description is ${skill.description.length} chars; max ${MAX_DESCRIPTION}`);
  if (skill.lineCount > MAX_SKILL_LINES) issues.push(`${at}: ${skill.lineCount} lines; keep SKILL.md under ${MAX_SKILL_LINES} (move detail to references/)`);
  if (skill.tools.length === 0) issues.push(`${at}: metadata.tools must list at least one connector tool`);

  const known = opts.knownTools;
  if (known) {
    for (const t of skill.tools) {
      if (!known.includes(t)) {
        const near = known.find((k) => levenshtein(k, t) <= 2);
        issues.push(`${at}: metadata.tools names unknown tool "${t}"${near ? ` (did you mean "${near}"?)` : ""}`);
      }
    }
    const declared = new Set(skill.tools);
    const seen = new Set<string>();
    for (const m of skill.body.matchAll(/`([a-z][a-z0-9_]*)`/g)) {
      const token = m[1]!;
      if (seen.has(token)) continue;
      seen.add(token);
      if (known.includes(token)) {
        if (!declared.has(token)) issues.push(`${at}: body uses \`${token}\` but metadata.tools does not declare it`);
      } else if (token.includes("_")) {
        const near = known.find((k) => levenshtein(k, token) <= 2);
        if (near) issues.push(`${at}: body mentions \`${token}\`, which is not a tool; did you mean \`${near}\`?`);
      }
    }
  }

  const present = new Set(skill.files.map((f) => f.path));
  for (const m of skill.body.matchAll(/\]\(((?:references|scripts|assets)\/[^)#\s]+)\)/g)) {
    if (!present.has(m[1]!)) issues.push(`${at}: links to missing file ${m[1]}`);
  }
  for (const m of skill.body.matchAll(/(?:^|\s)((?:references|scripts|assets)\/[\w./-]+)/gm)) {
    if (!present.has(m[1]!)) issues.push(`${at}: references missing file ${m[1]}`);
  }
  return issues;
}

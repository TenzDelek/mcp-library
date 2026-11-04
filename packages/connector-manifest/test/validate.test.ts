import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { levenshtein, parseFrontmatter, scanSkills, validateSkill } from "../src/index.js";

const KNOWN = ["search_texts", "get_text", "get_segment"];

function skillDir(name: string, content: string, extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "skills-"));
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), content);
  for (const [rel, text] of Object.entries(extra)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return root;
}

const good = `---
name: good-skill
description: Does a thing. Use when asked.
metadata:
  tools: search_texts, get_text
---
Call \`search_texts\` then \`get_text\`. See [examples](references/examples.md).
`;

describe("parseFrontmatter", () => {
  it("splits frontmatter and body", () => {
    const fm = parseFrontmatter(good)!;
    expect(fm.data.name).toBe("good-skill");
    expect(fm.body).toContain("Call `search_texts`");
    expect(parseFrontmatter("no frontmatter")).toBeNull();
  });
});

describe("scanSkills + validateSkill", () => {
  it("accepts a valid skill", () => {
    const root = skillDir("good-skill", good, { "references/examples.md": "# ex" });
    const [skill] = scanSkills(root);
    expect(skill!.tools).toEqual(["search_texts", "get_text"]);
    expect(skill!.files.map((f) => f.path)).toEqual(["SKILL.md", "references/examples.md"]);
    expect(validateSkill(skill!, { knownTools: KNOWN })).toEqual([]);
  });
  it("flags name/dir mismatch, unknown and undeclared tools, near-miss names and missing files", () => {
    const bad = `---
name: other-name
description: x
metadata:
  tools: search_text
---
Use \`get_segment\` and \`get_segments\`. See [ref](references/missing.md).
`;
    const root = skillDir("bad-skill", bad);
    const issues = validateSkill(scanSkills(root)[0]!, { knownTools: KNOWN }).join("\n");
    expect(issues).toMatch(/must equal the directory name/);
    expect(issues).toMatch(/unknown tool "search_text" \(did you mean "search_texts"\?\)/);
    expect(issues).toMatch(/body uses `get_segment` but metadata.tools does not declare it/);
    expect(issues).toMatch(/`get_segments`, which is not a tool; did you mean `get_segment`/);
    expect(issues).toMatch(/missing file references\/missing.md/);
  });
  it("ignores directories without SKILL.md", () => {
    const root = skillDir("good-skill", good, { "references/examples.md": "" });
    mkdirSync(join(root, "_shared"));
    writeFileSync(join(root, "_shared", "notes.md"), "x");
    expect(scanSkills(root).map((s) => s.name)).toEqual(["good-skill"]);
  });
});

describe("levenshtein", () => {
  it("counts edits", () => {
    expect(levenshtein("get_segment", "get_segments")).toBe(1);
    expect(levenshtein("search_text", "search_texts")).toBe(1);
    expect(levenshtein("abc", "xyz")).toBe(3);
  });
});

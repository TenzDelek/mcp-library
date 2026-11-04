import { parse } from "yaml";

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Parses YAML frontmatter; returns null when the file has none or it isn't a map. */
export function parseFrontmatter(text: string): Frontmatter | null {
  const m = FM.exec(text);
  if (!m) return null;
  const data: unknown = parse(m[1] ?? "") ?? {};
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return { data: data as Record<string, unknown>, body: m[2] ?? "" };
}

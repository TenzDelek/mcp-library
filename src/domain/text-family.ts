/**
 * A text's family: the root original (following `translation_of` upward) and
 * every translation hanging off it. The Flutter client does the same walk.
 */
import type { LibraryClient } from "../library/client.js";
import type { TextOutput } from "../library/schemas.js";
import { resolveMany } from "./resolve.js";

const MAX_DEPTH = 10;

export interface TextFamily {
  root: TextOutput;
  /** Translations of the root, resolved (bounded). Excludes the root itself. */
  translations: TextOutput[];
  /** Ids of translations that were not resolved because of the cap. */
  unresolved_translation_ids: string[];
}

export async function getTextFamily(
  getText: LibraryClient["getText"],
  start: TextOutput,
  cap = 10,
): Promise<TextFamily> {
  let root = start;
  const seen = new Set<string>([start.id]);
  for (let depth = 0; depth < MAX_DEPTH && root.translation_of; depth++) {
    if (seen.has(root.translation_of)) break;
    seen.add(root.translation_of);
    try {
      root = await getText(root.translation_of);
    } catch {
      break;
    }
  }
  const ids = root.translations.filter((id) => id !== start.id);
  const resolved = await resolveMany(ids, getText, { cap });
  const translations = ids.map((id) => resolved.get(id)).filter((t): t is TextOutput => Boolean(t));
  if (start.id !== root.id) translations.unshift(start);
  const unresolved = ids.filter((id) => !resolved.has(id));
  return { root, translations, unresolved_translation_ids: unresolved };
}

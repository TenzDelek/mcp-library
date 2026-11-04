/**
 * The contract between the portable skills and the connector server: every
 * tool a skill names must exist, and every tool a skill uses must be declared.
 * Runs against the real repo root.
 */
import { describe, expect, it } from "vitest";
import { SERVER_NAME, TOOLS } from "@webuddhist/connector-server";
import { loadConnector, validateSkill } from "../src/index.js";

const loaded = loadConnector(new URL("../../../", import.meta.url).pathname);
const knownTools = TOOLS.map((t) => t.name);

describe("skills ↔ server contract", () => {
  it("finds the shipped skills", () => {
    expect(loaded.skills.map((s) => s.name)).toEqual(["build-reading-list", "cite-buddhist-text", "compare-translations"]);
  });
  for (const skill of loaded.skills) {
    it(`${skill.name} is valid and only uses real tools`, () => {
      expect(validateSkill(skill, { knownTools })).toEqual([]);
      expect(skill.tools.length).toBeGreaterThan(0);
      expect(skill.lineCount).toBeLessThanOrEqual(500);
    });
  }
  it("connector.json server name matches the server", () => {
    expect(loaded.connector.server.name).toBe(SERVER_NAME);
  });
});

/**
 * Regenerates every per-store wrapper from connector.json + skills/.
 *   tsx scripts/generate-wrappers.ts          write files, remove stale ones
 *   tsx scripts/generate-wrappers.ts --check  exit 1 on any drift (CI)
 * Needs a build first (`tsc -b`): it imports the built packages.
 */
import {
  ADAPTERS,
  buildContext,
  checkFileSet,
  checkVersions,
  emitAll,
  loadConnector,
  stampVersions,
  validateSkill,
  writeFileSet,
} from "@webuddhist/connector-manifest";
import { INSTRUCTIONS, SERVER_NAME, TOOLS } from "@webuddhist/connector-server";

const check = process.argv.includes("--check");
const loaded = loadConnector();
const { root, connector, skills } = loaded;

const problems: string[] = [];
if (connector.server.name !== SERVER_NAME) {
  problems.push(`connector.json server.name "${connector.server.name}" != connector-server SERVER_NAME "${SERVER_NAME}"`);
}
if (skills.length === 0) problems.push(`no skills found under ${connector.skills.dir}/`);
const knownTools = TOOLS.map((t) => t.name);
for (const skill of skills) problems.push(...validateSkill(skill, { knownTools }));
if (problems.length) {
  console.error("Cannot generate:\n  " + problems.join("\n  "));
  process.exit(1);
}

const ctx = buildContext(loaded, TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description })), INSTRUCTIONS);
const files = emitAll(ctx, ADAPTERS);

if (check) {
  const drift = checkFileSet(root, files, ADAPTERS);
  const versions = checkVersions(root, connector.version);
  if (drift.length === 0 && versions.length === 0) {
    console.log(`generate:check ok (${files.size} files, ${skills.length} skills, version ${connector.version})`);
    process.exit(0);
  }
  for (const d of drift) console.error(`drift [${d.adapter}] ${d.kind}: ${d.path}`);
  for (const v of versions) console.error(`drift [versions] ${v}`);
  console.error("\nRun `npm run generate` and commit the result.");
  process.exit(1);
}

const stampedFiles = stampVersions(root, connector.version);
const { written, removed } = writeFileSet(root, files, ADAPTERS);
for (const f of stampedFiles) console.log(`stamped  ${f}`);
for (const f of written) console.log(`wrote    ${f}`);
for (const f of removed) console.log(`removed  ${f}`);
console.log(`generate ok: ${files.size} files from ${skills.length} skills (version ${connector.version})`);

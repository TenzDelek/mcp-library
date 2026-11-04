# ADR-0002: `connector.json` + a generator seam with one adapter per store

**Status:** Accepted
**Date:** 2026-11-04
**Deciders:** WeBuddhist engineering

## Context

Each host manifest repeats the same facts (name, version, description, server command or URL, skill list) in its own syntax. Hand-maintaining four of them guarantees drift. Versions must also agree across every workspace `package.json` and the server's `version.ts`.

## Decision

- `connector.json` at the repo root is the single source of truth, validated by a zod schema in `packages/connector-manifest` (`connector.schema.json` is generated from it for editor support). The skill list is **derived by scanning `skills/`**, never listed.
- The generator is a seam: `WrapperAdapter { id, owns, emit(ctx) → FileSet }`. `emit` is a pure function of `{connector, skills, tools, instructions}` and is snapshot-tested. Adapters: `repo` (version.ts, schema), `claude`, `gemini`, `dsh`, `docs` (skill catalogue and install pages).
- `owns` names the paths an adapter controls. `npm run generate` writes the file set and removes stale files inside owned roots; `npm run generate:check` (CI) fails on any missing, changed or extra file, and on any workspace `package.json` whose version or internal `@webuddhist/*` ranges disagree with `connector.json`.
- Skills declare the tools they use in `metadata.tools`. The generator and a contract test refuse a skill that names a tool the server does not have, uses a tool it did not declare, references a near-miss name (edit distance ≤ 2) or links to a missing file.

## Consequences

- Hosts never disagree with each other or with the server; renaming a tool fails the build until every skill is updated.
- A new host is one adapter file plus tests; nothing else changes.
- Tool descriptions and server instructions are inputs to the generator, so the optimization loop can propose changes to them through the same PR path as skills.

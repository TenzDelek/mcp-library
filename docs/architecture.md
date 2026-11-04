# Architecture

The repository is the source hub for the **Buddhist Creator Connector**. Four zones, one source:

```
 connector.json ─┐                                  skills/<name>/SKILL.md   (portable core, hand-written;
                 ├─► packages/connector-manifest ◄──┘ metadata.tools names the server tools each skill uses)
                 │        emit(ctx) → files, one adapter per store
   ┌─────────────┼───────────────┬──────────────────┬──────────────────┐
   ▼             ▼               ▼                  ▼                  ▼
.claude-plugin  gemini-extension.json  wrappers/dsh-bundle  skills/README.md  packages/connector-server/src/version.ts
(+marketplace)  + GEMINI.md            (npm package)        docs/install/*

 skills ──use tool names──► packages/connector-server (15 tools, createServer(deps, overrides), stdio bin)
                                        │ LibraryClient seam
                               packages/library-client (schemas, HTTP adapter, LibraryError, ./testing fake)

 apps/remote: hosted Streamable HTTP entrypoint (Phase B: Auth0 resource server, Cloud Run)
 evals/ + apps/eval-runner + optimization/ (Phase D): GEPA proposes skill and prompt changes as PRs
```

| Zone | Where | Status |
|---|---|---|
| Portable core: skills + MCP server | `skills/`, `packages/connector-server`, `packages/library-client` | shipped (Phase A) |
| Per-store wrappers, generated | root manifests, `wrappers/dsh-bundle`, `docs/install` | shipped (Phase A); DSH rows are a stub |
| Hosts | Claude Code / claude.ai / Cowork, Gemini CLI, skills CLI, ChatGPT, DeepSeek Harness | local mode now; remote mode after Phase B |
| Optimization loop | `evals/`, `apps/eval-runner`, `optimization/` | Phase D |

## Deep modules and their seams

1. **`LibraryClient`** (`packages/library-client/src/client.ts`): one typed method per library endpoint. Adapters: `createHttpLibraryClient` (production), `createFakeLibraryClient` (tests, from `@webuddhist/library-client/testing`). Everything about headers, retries, parsing and error mapping is hidden behind it; the API key is only ever read inside the HTTP adapter.
2. **Connector manifest → wrappers** (`packages/connector-manifest`): interface `WrapperAdapter.emit(ctx) → FileSet`; four adapters. Generated files are committed and drift-checked.
3. **Tool catalogue** (`packages/connector-server/src/tools`): the interface the skills and hosts see. `createServer(deps, overrides)` accepts replacement instructions and tool descriptions so the optimization loop can evaluate candidates without editing source.

## Day-to-day commands

| Command | What it does |
|---|---|
| `npm run build` | `tsc -b` across workspaces in dependency order |
| `npm test` | builds, then runs every workspace's tests against the in-memory fake |
| `npm run test:live` | hits the real library; needs `LIBRARY_API_KEY` in `.env` |
| `npm run generate` | regenerates every host manifest from `connector.json` + `skills/` |
| `npm run generate:check` | CI drift check |
| `npm run verify` | drift check + `claude plugin validate .` |
| `npm run check` | starts the stdio server once and confirms the key works |
| `npm run inspect` | MCP Inspector against the local server |

## Adding things

- **A skill**: create `skills/<name>/SKILL.md` with `name`, `description` and `metadata.tools`; run `npm run generate`; the contract test enforces the tool names.
- **A tool**: add a `defineTool` file under `packages/connector-server/src/tools`, register it in `tools/index.ts`, add a harness test; update any skill that should use it.
- **A host**: add an adapter in `packages/connector-manifest/src/adapters`, list it in `ADAPTERS`, add a snapshot test and an install page.
- **A version**: change `connector.json.version`, run `npm run generate` (stamps every `package.json` and `version.ts`), tag `v<version>`.

See the ADRs in `docs/adr/` for the reasoning behind the layout and the generator.

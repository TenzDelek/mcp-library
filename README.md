# Buddhist Creator Connector
<img width="3002" height="892" alt="image" src="https://github.com/user-attachments/assets/7e15f91b-f35c-4de6-9326-5178b4319e74" />

Give AI assistants a trustworthy way into the **WeBuddhist Library**: find Buddhist texts (Tibetan canon, translations, commentaries, chants and recordings), read them, quote them with exact citations, and compare an original with its translation side by side.

It ships as a *connector* for every major host and as portable [Agent Skills](https://agentskills.io), all generated from one source in this repository:

| Host | What you install | Guide |
|---|---|---|
| Claude Code | plugin from this repo's marketplace | [docs/install/claude-code.md](docs/install/claude-code.md) |
| claude.ai, Claude Desktop, Cowork | custom connector (hosted URL, Phase B) | [docs/install/claude.md](docs/install/claude.md) |
| ChatGPT | custom connector (hosted URL, Phase B) | [docs/install/chatgpt.md](docs/install/chatgpt.md) |
| Gemini CLI | extension from this repo | [docs/install/gemini-cli.md](docs/install/gemini-cli.md) |
| DeepSeek Harness | `@webuddhist/buddhist-creator-dsh` bundle | [docs/install/deepseek-harness.md](docs/install/deepseek-harness.md) |
| Any agent via the skills CLI | `npx skills add Webuddhist-tech/buddhist-creator-connector` | [docs/install/skills-cli.md](docs/install/skills-cli.md) |

## Skills

| Skill | Use it when |
|---|---|
| `cite-buddhist-text` | quote a passage verbatim with text, edition, segment and span |
| `compare-translations` | show the original and a translation aligned segment by segment |
| `build-reading-list` | build a cited reading list for a topic, category, tag, author or language |

The full catalogue with the tools each skill uses is in [skills/README.md](skills/README.md).

## The server

`@webuddhist/connector-server` exposes the library's read-only API as 15 MCP tools (search, read, segments, alignments, people, categories, tags, recordings). The library API key never leaves the process that holds it: locally it comes from your host's secure config; in hosted mode it stays on the server.

```bash
npm install && npm run build
cp .env.example .env            # add LIBRARY_API_KEY
npm run check                   # health + key check
npm run inspect                 # MCP Inspector
```

## Repository layout

```
connector.json              single source of truth (name, version, server, host knobs)
skills/                     portable skills (SKILL.md folders)
.claude-plugin/ GEMINI.md gemini-extension.json   generated host manifests (repo root is the plugin/extension)
wrappers/dsh-bundle/        generated DeepSeek Harness bundle
packages/library-client     typed client for the library API + in-memory fake
packages/connector-server   MCP tools, createServer, stdio entrypoint
packages/connector-manifest connector.json schema, skills scanner, wrapper generators
apps/remote                 hosted entrypoint (Streamable HTTP; Auth0 in Phase B)
docs/                       architecture, ADRs, generated install guides
evals/                      eval tasks for the optimization loop (Phase D)
```

Run `npm run generate` after changing `connector.json` or a skill; CI fails if a generated file is stale. See [docs/architecture.md](docs/architecture.md) and the ADRs in [docs/adr](docs/adr/).

## Development

```bash
npm run build            # tsc -b
npm test                 # all workspaces, in-memory fake
npm run test:live        # real library, needs LIBRARY_API_KEY
npm run lint
npm run generate:check   # wrapper drift
npm run verify           # drift + claude plugin validate
```

Node 24 (`.nvmrc`), npm workspaces, TypeScript, zod, vitest.

## Status

Phase A (this release): skills, server, generated wrappers in **local mode** (the host runs the connector on your machine with your key). Phase B adds the hosted connector with WeBuddhist sign-in (Auth0) so claude.ai and ChatGPT can connect. Phase C completes the DeepSeek Harness bundle. Phase D adds evals and the GEPA optimization loop that proposes skill improvements as pull requests.

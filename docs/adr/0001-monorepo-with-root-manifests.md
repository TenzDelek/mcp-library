# ADR-0001: One source repo, npm workspaces, host manifests at the repo root

**Status:** Accepted
**Date:** 2026-11-04
**Deciders:** WeBuddhist engineering

## Context

The Buddhist Creator Connector must ship to several hosts that each want a different package shape: Claude Code / claude.ai (plugin: `.claude-plugin/plugin.json` + `skills/`), Gemini CLI (extension: `gemini-extension.json` + `skills/` + `GEMINI.md`), the skills CLI (`npx skills add owner/repo`, which scans a repo for `SKILL.md` folders), DeepSeek Harness (an npm package declaring `dsh.bundle`), and ChatGPT / claude.ai connectors (a remote MCP URL). The MCP server, the skills and an optimization loop all evolve together.

## Decision

- A single repository holds everything, as **npm workspaces**: `packages/library-client` (API port + HTTP adapter + fake), `packages/connector-server` (tools + `createServer`, stdio bin), `packages/connector-manifest` (schema, skills scanner, wrapper generators), `apps/remote` (hosted entrypoint), later `apps/eval-runner` and a Python `optimization/` directory outside npm.
- The **repo root is simultaneously the Claude plugin, the Claude marketplace and the Gemini extension**: their manifests are generated at the root and all of them read the one `skills/` directory. No skills are copied for these hosts.
- The **DSH bundle** is the one wrapper generated as its own package (`wrappers/dsh-bundle`) because its format requires a `package.json` of its own; it carries a copy of the skills.
- There is **no `.mcp.json` at the root**. The plugin declares its MCP server inline in `plugin.json`, because a root `.mcp.json` doubles as Claude Code's *project* MCP config where `${user_config.*}` does not resolve.
- There is **no top-level `bin/`** directory: claude.ai and Cowork refuse plugins that have one. Executables live under packages.

## Options considered

| Option | Complexity | Fit |
|---|---|---|
| A. Root manifests + shared `skills/` (chosen) | Low | Works for GitHub installs of Claude and Gemini without any build; skills CLI finds exactly one copy of each skill |
| B. `wrappers/<store>/` with copied skills | Medium | Gemini can only install such a layout from a release archive, not from the GitHub URL; the skills CLI may list skills twice |
| C. One repository per host | High | Diverges immediately; the point of the hub is one source |

## Consequences

- Installing the plugin or extension clones the whole repo (no `node_modules`, a few MB). A slim Gemini release archive and a `git-subdir` marketplace source are the escape hatches if it grows.
- Every generated file is committed and checked for drift in CI, so the manifests never disagree with `connector.json` or `skills/`.
- Adding a skill is adding a folder; adding a host is adding an adapter (see ADR-0002).

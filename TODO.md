# TODO

What is left after Phase A (restructure, skills, generated wrappers, CI). The full design is in `~/.claude/plans/we-are-planning-on-imperative-trinket.md` (local) and summarised in [docs/architecture.md](docs/architecture.md).

## Blocked on the owner

- [ ] **npm publish.** `npm login` (current token returns E401), confirm the `@webuddhist` scope is yours (or pick another and change `connector.json` + package names), then:
      `npm publish -w packages/library-client -w packages/connector-server --access public`.
      Until then the Claude plugin and Gemini extension cannot start the connector (`npx -y @webuddhist/connector-server`).
- [ ] **Auth0 (Phase B prerequisite).** In the `dev-pecha-esukhai.us.auth0.com` tenant: create an API whose identifier is the connector URL (`https://connector.webuddhist.com/mcp`), scope `library:read`; enable Dynamic Client Registration (Claude "Register automatically" and ChatGPT need it); allow `offline_access`.
- [ ] **DNS / hosting.** Decide the final hostname for `connector.json` → `server.remote.url` (currently `connector.webuddhist.com`) and the Cloud Run project.
- [ ] **DeepSeek Harness (Phase C prerequisite).** Install DSH once and dump a profile with `@deepseek-ai/dsh-mcp-client` configured (`dsh --profile web --dump-config`) so the MCP row schema in `wrappers/dsh-bundle/cordis.patch.yml` can be confirmed.
- [ ] **Library team questions.** Semantics of `search_type: similar` and of `/segments/{id}/related` vs alignments; is critical > diplomatic > collated the right edition preference when only a text id is given; does `X-Application` scope categories/tags.
- [ ] **Repo visibility.** The repository is public; confirm that is intended (it was created private).

## Phase A follow-ups

- [ ] Verify a real install once the packages are on npm: `/plugin marketplace add Webuddhist-tech/buddhist-creator-connector` → `/plugin install buddhist-creator-connector@webuddhist` (key prompt, tools listed); `gemini extensions install https://github.com/Webuddhist-tech/buddhist-creator-connector`; `npx skills add Webuddhist-tech/buddhist-creator-connector` lists exactly 3 skills.
- [ ] Run the three skills end to end in Claude Code against the live library and fix wording that leads the model astray (quote accuracy, citation format).
- [ ] Add `claude plugin validate --strict` once CI's Claude Code version is ≥ 2.1.281 (MCP entry checks); drop `continue-on-error`.
- [ ] Record new fixtures for `get_full_content` paths (`npm run record-fixtures`) when the library changes.

## Phase B — hosted connector + Auth0 + Cloud Run

- [ ] `apps/remote`: rewrite `src/main.ts` on Express (`createMcpExpressApp` or plain express 5): `GET /healthz`, `GET /readyz`, `mcpAuthMetadataRouter` for `/.well-known/oauth-protected-resource/mcp`, `ALL /mcp` behind `requireBearerAuth`, stateless `StreamableHTTPServerTransport` per request.
- [ ] `auth/auth0.ts`: `OAuthTokenVerifier` with `jose` (`createRemoteJWKSet` + `jwtVerify`, issuer `https://<domain>/`, audience = connector URL) → `AuthInfo`.
- [ ] `auth/static.ts`: dev-only bearer verifier (`AUTH_MODE=static`), refuses `NODE_ENV=production`.
- [ ] `config.ts` for the app: `AUTH_MODE`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `PUBLIC_URL`, `PORT`, `MCP_DEV_BEARER_TOKEN`; tests for `createApp` with the static verifier (401 shape, `WWW-Authenticate` header, happy path).
- [ ] Dockerfile (multi-stage, `node:24-slim`, `npm ci` → `tsc -b` → `npm prune --omit=dev`), `.github/workflows/deploy.yml` (WIF → Artifact Registry → `gcloud run deploy`, secrets from Secret Manager).
- [ ] Switch `connector.json` hosts to `"mode": "remote"`, run `npm run generate`, verify `.claude-plugin/plugin.json` has `{type: "http", url}` and `gemini-extension.json` has `httpUrl`.
- [ ] Verify with MCP Inspector OAuth flow, then add as a custom connector in claude.ai and in ChatGPT; negative tests (no token → 401 with `resource_metadata`, wrong audience → 401).
- [ ] `docs/install/auth0-setup.md` and ADR-0003 (Auth0 resource server).
- [ ] Per-user rate limiting keyed by `sub` (follow-up).

## Phase C — DSH bundle + releases

- [ ] Replace the placeholder rows in the `dsh` adapter (`packages/connector-manifest/src/adapters/dsh.ts`) with the confirmed `@deepseek-ai/dsh-mcp-client` schema; decide how skills reach DSH.
- [ ] `.github/workflows/release.yml` on tag `v*`: assert tag == `connector.json` version → build → `npm publish` (library-client, connector-server, dsh bundle, with provenance) → slim Gemini extension zip (manifest + GEMINI.md + skills) as a GitHub release asset.
- [ ] Verify `dsh plugin --profile x add @webuddhist/buddhist-creator-dsh` loads the bundle and lists the tools.
- [ ] Consider a `git-subdir` marketplace source if the repo clone size becomes a complaint.

## Phase D — evals + GEPA optimization loop

- [ ] Author `evals/tasks/cite-buddhist-text.jsonl` (15–20 tasks, ids and quotes taken from the live library, titles stored beside ids; train/val/test splits). Schema is in [evals/README.md](evals/README.md).
- [ ] `apps/eval-runner`: `runTask({skillText, instructions, task})` on an Anthropic SDK tool loop against `createServer(deps, {instructions})` over `InMemoryTransport` with the real library; deterministic scorers (expected ids, `must_quote` verbatim, tool path) + optional LLM rubric; `feedback` text for GEPA; CLI `eval-run --skill-md … --tasks … --json`, `--lint`, `--verify-tasks`. Read the `claude-api` skill before implementing.
- [ ] `optimization/` (uv, `gepa` pinned): `evaluate.py` shells out to `eval-run`; `run.py` calls `gepa.optimize_anything(seed_candidate={"skill_md", "instructions"}, …)`; writes `out/<skill>/<run>/{candidates, scores.jsonl, best.md}`.
- [ ] `scripts/promote-candidate.ts`: write `best.md` into `skills/<skill>/SKILL.md` on branch `gepa/<skill>/<run>`, run `npm run generate`, open a PR with the score table (humans review; nothing auto-merges).
- [ ] `.github/workflows/optimize.yml` (`workflow_dispatch`, secrets: `ANTHROPIC_API_KEY`, `LIBRARY_API_KEY`, reflection-model key).
- [ ] ADR-0004 (eval runner choice: Anthropic SDK loop now, Claude Agent SDK `plugins: [{type: "local"}]` as a later fidelity check).
- [ ] Later: second candidate component = tool descriptions (already supported by `createServer` overrides).

## Housekeeping

- [ ] Add `CHANGELOG.md` and a version bump checklist (`connector.json` → `npm run generate` → tag).
- [ ] Add `.github/dependabot.yml` for npm and GitHub Actions.
- [ ] Package READMEs for `library-client` and `connector-server` (npm listing pages).
- [ ] Decide whether `apps/remote` keeps the static-bearer mode after Phase B or becomes dev-only.

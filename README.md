# @webuddhist/mcp-library

An [MCP](https://modelcontextprotocol.io) server that gives AI agents read-only access to the
WeBuddhist Library (OpenPecha API v2): Buddhist texts, their editions, translations, commentaries,
segments, alignments, people, categories and audio recordings.

Only GET endpoints are exposed. The library API key never leaves this server: it is read from the
environment, sent as `X-API-Key`, and is never logged, returned in tool output, or included in error text.

## Requirements

- Node.js 20 or newer
- A library API key (ask the WeBuddhist library team)

## Install and build

```bash
npm install
npm run build
```

Check that the key and connectivity work (prints the health response, never the key):

```bash
LIBRARY_API_KEY=... npm run check
```

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `LIBRARY_API_KEY` | yes | | API key sent as `X-API-Key` |
| `LIBRARY_API_URL` | no | `https://library-prod.webuddhist.com` | Base URL |
| `LIBRARY_APP_NAME` | no | `webuddhist` | Sent as `X-Application` (required by the categories/tags endpoints) |
| `LIBRARY_PREFERRED_LANGUAGES` | no | `en,bo` | Order used to pick one title/name when several languages exist |
| `LIBRARY_TIMEOUT_MS` | no | `30000` | Per-request timeout (content requests get at least 60 s) |
| `MCP_BEARER_TOKEN` | HTTP only | | Token clients must present to the HTTP entrypoint |
| `MCP_HTTP_PORT` | HTTP only | `3000` | HTTP listen port |

Copy `.env.example` to `.env` for local development. `.env` is git-ignored.

## Connect an MCP client (stdio)

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "webuddhist-library": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-library/dist/bin/stdio.js"],
      "env": { "LIBRARY_API_KEY": "your-key-here" }
    }
  }
}
```

**Cursor**: this repo ships `.cursor/mcp.json`, which launches the built server and forwards
`LIBRARY_API_KEY` from your shell environment. Export the key in your shell profile; do not paste it
into the file.

**Claude Code**:

```bash
claude mcp add webuddhist-library -e LIBRARY_API_KEY=your-key-here -- node /absolute/path/to/mcp-library/dist/bin/stdio.js
```

Try it with the MCP Inspector:

```bash
LIBRARY_API_KEY=... npm run inspect
```

## Tools

Ids come in three kinds. A **text** is a work. An **edition** is a concrete readable version of a text
(content, segments and alignments hang off editions). A **segment** is a paragraph or verse of an
edition. Positions in content are Unicode code points, end-exclusive. Lists have no totals: follow
`next_offset` while `has_more` is true.

| Tool | What it does |
|---|---|
| `search_texts` | Find texts by title and filters (language, category, tags, author, BDRC/Wikidata id) |
| `get_text` | One text with titles, contributors, editions, translations, commentaries, optional family |
| `read_edition` | Read a window of an edition's content; accepts an edition id or a text id |
| `get_full_content` | Whole text of an edition in one call: pages all segments, spans first start to last end, restores line breaks |
| `search_content` | Full-text search inside editions, with context and segment ids |
| `get_segment` | One segment with its text, optionally with related segments in another language |
| `list_segments` | Page through an edition's segments with their text |
| `get_aligned_segments` | Side-by-side aligned segments between two editions (lists targets if none given) |
| `get_edition` | Edition metadata, aligned editions, recordings; optional TOC, pagination, notes, marks, download URL |
| `search_persons` | Find people by name or BDRC/Wikidata id |
| `get_person` | One person and the texts they contributed to |
| `browse_categories` | Walk the category tree |
| `list_tags` | All tags |
| `list_languages` | All language codes |
| `get_recording` | Recording metadata and a temporary audio URL |

Every tool is read-only. Upstream failures come back as tool errors with actionable text
(bad key, not found, invalid parameters, rate limit, upstream outage, schema drift).

## Hosted mode (Streamable HTTP)

`bin/http.ts` serves the same tools over Streamable HTTP at `/mcp`, stateless. Because it holds
the library key, it refuses to start without `MCP_BEARER_TOKEN` and rejects requests that do not
carry `Authorization: Bearer <token>`. Put a real identity layer (OAuth or an identity-aware proxy)
in front of it before exposing it to end users.

```bash
LIBRARY_API_KEY=... MCP_BEARER_TOKEN=$(openssl rand -hex 24) npm run dev:http
```

## Development

```bash
npm run typecheck
npm run lint
npm test            # unit + tool tests against an in-memory fake of the library
npm run test:live   # needs LIBRARY_API_KEY; hits the real library
npm run record-fixtures   # needs LIBRARY_API_KEY; records real responses for the contract test
```

Layout:

- `src/library/client.ts` is the single seam: the `LibraryClient` interface. `http-client.ts` is the
  production adapter, `test/fakes/fake-library-client.ts` the test adapter.
- `src/tools/*` are plain functions of `(deps, input)`; `src/server.ts` registers them on an `McpServer`.
- `bin/stdio.ts` and `bin/http.ts` only choose a transport.

## Security notes

- The key is read once in `src/config.ts` and handed only to the HTTP adapter.
- Error messages are built from status + path + a short body excerpt, never from request headers.
- `src/` may not write to stdout (`no-console` lint rule); logs go to stderr.
- Never commit `.env`; `.env.example` lists variable names only.

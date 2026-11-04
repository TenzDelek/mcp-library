/** Skill catalogue and per-host install pages with real names and URLs stamped in. */
import { mdHeader, skillsTable, type FileSet, type GenerateContext, type WrapperAdapter } from "./types.js";

export const docsAdapter: WrapperAdapter = {
  id: "docs",
  owns: ["skills/README.md", "docs/install/"],
  emit(ctx: GenerateContext): FileSet {
    const c = ctx.connector;
    const repo = c.repository ?? c.homepage;
    const ghPath = repo.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
    const npx = `${c.server.local.command} ${c.server.local.args.join(" ")}`;
    const envKey = c.server.local.envKey;
    const h = mdHeader();

    const files: FileSet = new Map();

    files.set(
      "skills/README.md",
      `${h}# Skills

Portable [Agent Skills](https://agentskills.io) for the ${c.displayName}. Each skill names the connector tools it uses; the contract test in \`packages/connector-manifest/test\` keeps those names in sync with the server.

${skillsTable(ctx)}

## Install the skills alone

\`\`\`bash
npx skills add ${ghPath}
\`\`\`

The skills need the connector's tools to be useful: see [docs/install](../docs/install/) for connecting the server in your host.
`,
    );

    files.set(
      "docs/install/claude-code.md",
      `${h}# Claude Code

The repository is a Claude Code plugin (skills + MCP server) and its own marketplace.

\`\`\`text
/plugin marketplace add ${ghPath}
/plugin install ${c.name}@${c.hosts.claude.marketplace}
\`\`\`

${c.hosts.claude.mode === "local" ? `Claude Code will prompt for your WeBuddhist Library API key and store it in your secure credential store. The plugin then runs the connector locally with \`${npx}\`.` : `The plugin connects to the hosted connector at ${c.server.remote.url}; sign in with your WeBuddhist account when prompted.`}

Validate a local checkout before publishing:

\`\`\`bash
claude plugin validate .
\`\`\`
`,
    );

    files.set(
      "docs/install/claude.md",
      `${h}# Claude (claude.ai, desktop, mobile) and Cowork

Custom connectors are remote MCP servers. Go to **Customize → Connectors → Add custom connector**, name it "${c.displayName}" and enter:

\`\`\`text
${c.server.remote.url}
\`\`\`

Choose **OAuth** and sign in with your WeBuddhist account. Team and Enterprise admins add it under **Organization settings → Connectors** instead.

> Until the hosted connector is live, use Claude Code with the plugin (see claude-code.md); claude.ai cannot reach a connector running on your machine.
`,
    );

    files.set(
      "docs/install/chatgpt.md",
      `${h}# ChatGPT

ChatGPT custom connectors need a public MCP server with OAuth. In **Settings → Connectors** (developer mode or a workspace admin, depending on plan) add:

\`\`\`text
${c.server.remote.url}
\`\`\`

Authentication: OAuth (discovered automatically from the server's metadata). Sign in with your WeBuddhist account when prompted.

The skills in this repository are not loaded by ChatGPT; paste the relevant SKILL.md body into a Project's instructions if you want the same guidance there.
`,
    );

    files.set(
      "docs/install/gemini-cli.md",
      `${h}# Gemini CLI

The repository is a Gemini CLI extension (skills + MCP server + \`${c.hosts.gemini.contextFileName}\`).

\`\`\`bash
gemini extensions install ${repo}
\`\`\`

${c.hosts.gemini.mode === "local" ? `Gemini CLI will ask for \`${envKey}\` (your WeBuddhist Library API key) and keep it in the system keychain. The extension runs the connector locally with \`${npx}\`.` : `The extension connects to the hosted connector at ${c.server.remote.url}.`}

Update later with \`gemini extensions update ${c.name}\`.
`,
    );

    files.set(
      "docs/install/deepseek-harness.md",
      `${h}# DeepSeek Harness (DSH)

\`\`\`bash
dsh plugin --profile <name> add ${c.hosts.dsh.packageName}
\`\`\`

The bundle lives in \`wrappers/dsh-bundle\` and is published to npm on each release. Its MCP client row is a placeholder until the \`@deepseek-ai/dsh-mcp-client\` row schema is confirmed on a real DSH install; see the bundle README.
`,
    );

    files.set(
      "docs/install/skills-cli.md",
      `${h}# Skills CLI (any agent)

Install the skills into any agent the [skills CLI](https://skills.sh) supports (Claude Code, Cursor, Codex, Windsurf, …):

\`\`\`bash
npx skills add ${ghPath}
# or pick one
npx skills add ${ghPath} --skill ${ctx.skills[0]?.name ?? "<skill>"}
\`\`\`

Then connect the server in your agent's MCP settings. Locally:

\`\`\`json
{ "mcpServers": { "${c.server.name}": { "command": "${c.server.local.command}", "args": ${JSON.stringify(c.server.local.args)}, "env": { "${envKey}": "<your key>" } } }
\`\`\`

Hosted (once live): \`${c.server.remote.url}\` with OAuth.
`,
    );

    return files;
  },
};

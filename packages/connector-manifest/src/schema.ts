import { z } from "zod";

const kebab = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and single hyphens only");
const semver = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, "semver x.y.z");
const mode = z.enum(["local", "remote"]);

/** The single source of truth for every per-store wrapper. */
export const ConnectorSchema = z.object({
  $schema: z.string().optional(),
  name: kebab,
  displayName: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  version: semver,
  license: z.string().min(1),
  homepage: z.url(),
  repository: z.url().optional(),
  author: z.object({ name: z.string().min(1), url: z.url().optional(), email: z.string().optional() }),
  server: z.object({
    /** MCP server key in every host config; must equal SERVER_NAME in connector-server. */
    name: kebab,
    remote: z.object({ url: z.url() }),
    local: z.object({
      command: z.string().min(1),
      args: z.array(z.string()),
      /** Environment variable the local server reads the library API key from. */
      envKey: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    }),
  }),
  skills: z.object({ dir: z.string().default("skills") }).default({ dir: "skills" }),
  hosts: z.object({
    claude: z.object({
      mode,
      /** Marketplace name users see in plugin ids (plugin@marketplace). */
      marketplace: kebab,
      category: z.string().optional(),
      keywords: z.array(z.string()).default([]),
    }),
    gemini: z.object({ mode, contextFileName: z.string().default("GEMINI.md") }),
    dsh: z.object({ packageName: z.string().min(1), engines: z.string().min(1) }),
  }),
});

export type Connector = z.infer<typeof ConnectorSchema>;

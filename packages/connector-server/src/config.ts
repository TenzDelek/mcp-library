import { z } from "zod";

const EnvSchema = z.object({
  LIBRARY_API_KEY: z.string().min(1, "LIBRARY_API_KEY is required"),
  LIBRARY_API_URL: z.url().default("https://library-prod.webuddhist.com"),
  LIBRARY_APP_NAME: z.string().min(1).default("webuddhist"),
  LIBRARY_PREFERRED_LANGUAGES: z.string().default("en,bo"),
  LIBRARY_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export interface Config {
  /** Base URL of the library API, without trailing slash. */
  baseUrl: string;
  /** Secret. Only createHttpLibraryClient may read this field. */
  apiKey: string;
  /** Sent as X-Application on every request. */
  appName: string;
  /** Order used when flattening LocalizedString values, e.g. ["en", "bo"]. */
  preferredLanguages: string[];
  timeoutMs: number;
}

/** The subset of Config that tool handlers receive. Deliberately excludes the API key. */
export type ToolConfig = Pick<Config, "preferredLanguages">;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ConfigError(`Invalid configuration: ${issues}`);
  }
  const e = parsed.data;
  return {
    baseUrl: e.LIBRARY_API_URL.replace(/\/+$/, ""),
    apiKey: e.LIBRARY_API_KEY,
    appName: e.LIBRARY_APP_NAME,
    preferredLanguages: e.LIBRARY_PREFERRED_LANGUAGES.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    timeoutMs: e.LIBRARY_TIMEOUT_MS,
  };
}

/** Safe to log. */
export function redactedConfig(config: Config): Record<string, unknown> {
  return {
    baseUrl: config.baseUrl,
    apiKey: "****",
    appName: config.appName,
    preferredLanguages: config.preferredLanguages,
    timeoutMs: config.timeoutMs,
  };
}

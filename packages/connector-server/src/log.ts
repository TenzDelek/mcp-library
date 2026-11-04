/**
 * stderr-only logger. On the stdio transport stdout is the JSON-RPC channel,
 * so nothing in src/ may ever write to stdout (ESLint enforces no-console).
 * Never pass headers or config objects here; use redactedConfig() for config.
 */
type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;

function write(level: Level, msg: string, extra?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${msg}${
    extra ? " " + JSON.stringify(extra) : ""
  }\n`;
  process.stderr.write(line);
}

export const log = {
  debug: (msg: string, extra?: Record<string, unknown>) => write("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => write("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => write("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write("error", msg, extra),
};

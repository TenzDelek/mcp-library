export type LibraryErrorKind =
  | "unauthorized"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "upstream"
  | "network"
  | "bad_response";

/**
 * The only error type that crosses the LibraryClient seam.
 * Constructed from status + method + path + a short, body-derived detail.
 * Never from request headers, Request objects, or fetch `cause` chains
 * (those can embed the API key).
 */
export class LibraryError extends Error {
  readonly kind: LibraryErrorKind;
  readonly status: number | undefined;
  readonly method: string;
  readonly path: string;
  readonly detail: string | undefined;

  constructor(args: {
    kind: LibraryErrorKind;
    method: string;
    path: string;
    status?: number;
    detail?: string;
  }) {
    const statusPart = args.status !== undefined ? ` (HTTP ${args.status})` : "";
    const detailPart = args.detail ? `: ${args.detail}` : "";
    super(`${args.kind}${statusPart} on ${args.method} ${args.path}${detailPart}`);
    this.name = "LibraryError";
    this.kind = args.kind;
    this.status = args.status;
    this.method = args.method;
    this.path = args.path;
    this.detail = args.detail;
  }
}

export function isLibraryError(e: unknown): e is LibraryError {
  return e instanceof LibraryError;
}

export function isNotFound(e: unknown): boolean {
  return isLibraryError(e) && e.kind === "not_found";
}

const MAX_DETAIL = 300;

/** Extracts a short human-readable detail from an error body, preferring FastAPI's `detail`. */
export function detailFromBody(bodyText: string): string | undefined {
  if (!bodyText) return undefined;
  try {
    const json: unknown = JSON.parse(bodyText);
    if (json && typeof json === "object" && "detail" in json) {
      const d = (json as { detail: unknown }).detail;
      if (typeof d === "string") return d.slice(0, MAX_DETAIL);
      if (Array.isArray(d)) {
        const parts = d
          .map((item) => {
            if (item && typeof item === "object") {
              const loc = Array.isArray((item as { loc?: unknown }).loc)
                ? ((item as { loc: unknown[] }).loc.filter((x) => x !== "query" && x !== "path").join(".") || "")
                : "";
              const msg = typeof (item as { msg?: unknown }).msg === "string" ? (item as { msg: string }).msg : "";
              return loc ? `${loc}: ${msg}` : msg;
            }
            return "";
          })
          .filter(Boolean);
        if (parts.length) return parts.join("; ").slice(0, MAX_DETAIL);
      }
    }
  } catch {
    // not JSON
  }
  return bodyText.slice(0, MAX_DETAIL);
}

export function libraryErrorFromStatus(status: number, method: string, path: string, bodyText: string): LibraryError {
  const detail = detailFromBody(bodyText);
  const kind: LibraryErrorKind =
    status === 401 || status === 403
      ? "unauthorized"
      : status === 404
        ? "not_found"
        : status === 422 || status === 400
          ? "validation"
          : status === 429
            ? "rate_limited"
            : "upstream";
  // Never echo the server's 401/403 body: some gateways reflect the offending header.
  return new LibraryError({ kind, method, path, status, detail: kind === "unauthorized" ? undefined : detail });
}

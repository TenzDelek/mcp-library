import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import { LibraryError } from "../../src/library/errors.js";
import { createHttpLibraryClient, type FetchLike } from "../../src/library/http-client.js";

const SECRET = "sk-test-SECRET-KEY-123";
const config: Config = {
  baseUrl: "https://lib.example",
  apiKey: SECRET,
  appName: "webuddhist",
  preferredLanguages: ["en"],
  timeoutMs: 5000,
};

function response(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(status === 204 ? null : text, { status, headers: { "content-type": "application/json", ...headers } });
}

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(handler);
  return { fetchImpl: fn as unknown as FetchLike, fn };
}

describe("createHttpLibraryClient", () => {
  it("sends X-API-Key and X-Application and encodes query params", async () => {
    const { fetchImpl, fn } = mockFetch(() => response(200, { items: [], has_more: false, offset: 0, limit: 20 }));
    const lib = createHttpLibraryClient(config, fetchImpl);
    await lib.listTexts({ title: "heart", tag_ids: ["a", "b"], limit: 20, offset: 0, language: undefined });
    const [url, init] = fn.mock.calls[0]!;
    expect(url).toBe("https://lib.example/v2/texts?title=heart&tag_id=a%2Cb&limit=20&offset=0");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe(SECRET);
    expect(headers["X-Application"]).toBe("webuddhist");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("parses JSON-encoded string content and passes both span bounds", async () => {
    const { fetchImpl, fn } = mockFetch(() => response(200, JSON.stringify("བཅོམ་")));
    const lib = createHttpLibraryClient(config, fetchImpl);
    expect(await lib.getEditionContent("E1", { start: 0, end: 5 })).toBe("བཅོམ་");
    expect(fn.mock.calls[0]![0]).toBe("https://lib.example/v2/editions/E1/content?span_start=0&span_end=5");
  });

  it("maps statuses to LibraryError kinds and never leaks the key", async () => {
    const cases: Array<[number, string, string]> = [
      [401, "unauthorized", `{"detail":"bad key ${SECRET}"}`],
      [403, "unauthorized", ""],
      [404, "not_found", '{"detail":"Text not found"}'],
      [422, "validation", '{"detail":[{"loc":["query","title"],"msg":"String should have at least 2 characters","type":"x"}]}'],
      [500, "upstream", "oops"],
    ];
    for (const [status, kind, body] of cases) {
      const { fetchImpl } = mockFetch(() => response(status, body));
      const lib = createHttpLibraryClient(config, fetchImpl);
      const err = await lib.getText("T1").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(LibraryError);
      const le = err as LibraryError;
      expect(le.kind).toBe(kind);
      expect(le.status).toBe(status);
      expect(le.message).not.toContain(SECRET);
      expect(le.detail ?? "").not.toContain(SECRET);
      if (status === 422) expect(le.detail).toBe("title: String should have at least 2 characters");
    }
  });

  it("retries once on 429 honouring Retry-After, then gives up", async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      const { fetchImpl, fn } = mockFetch(() => {
        n++;
        return response(429, "", { "retry-after": "1" });
      });
      const lib = createHttpLibraryClient(config, fetchImpl);
      const p = lib.listTags();
      const settled = p.catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(1000);
      const err = await settled;
      expect(fn).toHaveBeenCalledTimes(2);
      expect((err as LibraryError).kind).toBe("rate_limited");
      expect(n).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers when the retry succeeds", async () => {
    let n = 0;
    const { fetchImpl } = mockFetch(() => (n++ === 0 ? response(503, "", { "retry-after": "0" }) : response(200, [{ code: "bo", name: "Tibetan" }])));
    const lib = createHttpLibraryClient(config, fetchImpl);
    expect(await lib.listLanguages()).toEqual([{ code: "bo", name: "Tibetan" }]);
  });

  it("reports schema drift as bad_response with issue paths", async () => {
    const { fetchImpl } = mockFetch(() => response(200, { id: "T1", title: { en: "x" } /* missing language, category_id */ }));
    const lib = createHttpLibraryClient(config, fetchImpl);
    const err = (await lib.getText("T1").catch((e: unknown) => e)) as LibraryError;
    expect(err.kind).toBe("bad_response");
    expect(err.detail).toContain("language");
  });

  it("wraps network failures without exposing the request", async () => {
    const { fetchImpl } = mockFetch(() => {
      const e = new TypeError("fetch failed");
      (e as { cause?: unknown }).cause = { code: "ECONNREFUSED", headers: { "X-API-Key": SECRET } };
      throw e;
    });
    const lib = createHttpLibraryClient(config, fetchImpl);
    const err = (await lib.health().catch((e: unknown) => e)) as LibraryError;
    expect(err.kind).toBe("network");
    expect(err.detail).toBe("TypeError ECONNREFUSED");
    expect(err.message).not.toContain(SECRET);
  });

  it("captures the audio redirect Location without following it", async () => {
    const { fetchImpl, fn } = mockFetch(() => new Response(null, { status: 307, headers: { location: "https://signed.example/a.mp3" } }));
    const lib = createHttpLibraryClient(config, fetchImpl);
    expect(await lib.getRecordingAudioUrl("R1")).toBe("https://signed.example/a.mp3");
    expect(fn.mock.calls[0]![1].redirect).toBe("manual");
  });
});

// Minimal Upstash Redis REST client (Week 5 stretch, Phase 3). SERVER-ONLY. No npm dependency: plain fetch.
// Upstash REST API: POST <url> with a JSON array ["SET","key","value",...] -> {"result": ...} or {"error": "..."};
// POST <url>/pipeline with [[...],[...]] -> [{"result": ...}, ...].
// Errors never include the URL, the token, keys or values: only a short reason code.

if (typeof window !== "undefined") {
  throw new Error("lib/whatsapp-bot/upstash is server-only and must not be imported in browser code.");
}

export type RedisArg = string | number;

export interface RedisClient {
  command(args: RedisArg[]): Promise<unknown>;
  pipeline(commands: RedisArg[][]): Promise<unknown[]>;
}

export class RedisUnavailableError extends Error {
  reason: string;
  constructor(reason: string) {
    super("Redis unavailable: " + reason);
    this.name = "RedisUnavailableError";
    this.reason = reason;
    Object.setPrototypeOf(this, RedisUnavailableError.prototype); // keeps instanceof working when compiled to ES5
  }
}

export interface UpstashClientOptions {
  url: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 2500;

export function createUpstashClient(options: UpstashClientOptions): RedisClient {
  const base = options.url.replace(/\/+$/, "");
  const token = options.token;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const doFetch = options.fetchImpl || fetch;

  async function post(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    let res: Response;
    try {
      res = await doFetch(base + path, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      throw new RedisUnavailableError(err instanceof Error && err.name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new RedisUnavailableError("http_" + res.status);
    try {
      return await res.json();
    } catch {
      throw new RedisUnavailableError("bad_response");
    }
  }

  function unwrap(reply: unknown): unknown {
    if (!reply || typeof reply !== "object") throw new RedisUnavailableError("bad_response");
    const r = reply as { result?: unknown; error?: unknown };
    if (r.error !== undefined) throw new RedisUnavailableError("command_error");
    return r.result === undefined ? null : r.result;
  }

  return {
    command: async function (args) {
      return unwrap(await post("", args.map(String)));
    },
    pipeline: async function (commands) {
      const reply = await post("/pipeline", commands.map(function (c) { return c.map(String); }));
      if (!Array.isArray(reply) || reply.length !== commands.length) throw new RedisUnavailableError("bad_response");
      return reply.map(unwrap);
    },
  };
}

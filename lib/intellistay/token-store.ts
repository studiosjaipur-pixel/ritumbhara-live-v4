import { createHash } from "crypto";
import type { IntellistayConfig } from "./config";

// Intellistay access-token cache in Upstash Redis. SERVER-ONLY.
//
// Why: the Intellistay TEST login takes ~6 s, and serverless instances rarely live long enough to reuse a token kept
// in memory, so /api/guest-messages/ask logged in on almost every request and missed the Hospitality OS 4 s budget.
//
// - Caches ONLY the access token (and when it expires), never booking or guest data.
// - The value expires in Redis at the same moment the client stops trusting it (TOKEN_TTL_MS, 50 min).
// - Uses the Upstash database the website already has (UPSTASH_REDIS_REST_URL / _TOKEN) through its REST API, with
//   its own few lines of fetch, so Guest Messages code imports nothing from the WhatsApp bot.
// - One key per Intellistay base URL + username, prefixed with the deployment environment like the bot's keys
//   ("production:…", "preview:…"), so Preview never uses Production's token.
// - Every Redis error is thrown to the client, which treats the cache as a miss and logs in normally.

if (typeof window !== "undefined") {
  throw new Error("lib/intellistay/token-store is server-only and must not be imported in browser code.");
}

export interface CachedToken {
  token: string;
  expiresAtMs: number;
}

export interface IntellistayTokenStore {
  get(): Promise<CachedToken | null>;
  set(token: string, expiresAtMs: number): Promise<void>;
  clear(): Promise<void>;
}

// One Redis command (["GET", key] ...) returning its result. Upstash REST or a test fake.
export interface RedisCommandClient {
  command(args: (string | number)[]): Promise<unknown>;
}

export class TokenCacheUnavailableError extends Error {
  reason: string;
  constructor(reason: string) {
    super("Token cache unavailable: " + reason);
    this.name = "TokenCacheUnavailableError";
    this.reason = reason;
    Object.setPrototypeOf(this, TokenCacheUnavailableError.prototype);
  }
}

export const TOKEN_CACHE_TIMEOUT_MS = 1000; // keeps a slow Redis well inside the OS 4 s budget

// Minimal Upstash REST client: POST the command as a JSON array, read { result } or { error }.
export function createUpstashCommandClient(options: { url: string; token: string; timeoutMs?: number; fetchImpl?: typeof fetch }): RedisCommandClient {
  const base = options.url.replace(/\/+$/, "");
  const doFetch = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || TOKEN_CACHE_TIMEOUT_MS;
  return {
    command: async function (args) {
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
      let res: Response;
      try {
        res = await doFetch(base, {
          method: "POST",
          headers: { Authorization: "Bearer " + options.token, "Content-Type": "application/json" },
          body: JSON.stringify(args.map(String)),
          redirect: "manual",
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (err) {
        throw new TokenCacheUnavailableError(err instanceof Error && err.name === "AbortError" ? "timeout" : "network");
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new TokenCacheUnavailableError("http_" + res.status);
      let reply: { result?: unknown; error?: unknown };
      try { reply = await res.json(); } catch { throw new TokenCacheUnavailableError("bad_response"); }
      if (!reply || typeof reply !== "object" || reply.error !== undefined) throw new TokenCacheUnavailableError("command_error");
      return reply.result === undefined ? null : reply.result;
    },
  };
}

// Same rule as the WhatsApp bot's keys: production / preview from VERCEL_ENV, anything else is development.
export function tokenCacheNamespace(env: Record<string, string | undefined>): string {
  const v = (env.VERCEL_ENV || "").trim().toLowerCase();
  return v === "production" || v === "preview" ? v : "development";
}

export function intellistayTokenKey(namespace: string, config: Pick<IntellistayConfig, "baseUrl" | "username">): string {
  const id = createHash("sha256").update(config.baseUrl + "|" + config.username, "utf8").digest("hex").slice(0, 16);
  return namespace + ":intellistay:token:" + id;
}

export function createRedisTokenStore(redis: RedisCommandClient, key: string, nowMs: () => number = Date.now): IntellistayTokenStore {
  return {
    get: async function () {
      const raw = await redis.command(["GET", key]);
      if (typeof raw !== "string") return null;
      let v: { t?: unknown; e?: unknown };
      try { v = JSON.parse(raw); } catch { return null; }
      if (!v || typeof v.t !== "string" || v.t.length < 10 || typeof v.e !== "number") return null;
      return v.e > nowMs() ? { token: v.t, expiresAtMs: v.e } : null;
    },
    set: async function (token, expiresAtMs) {
      const ttlMs = Math.floor(expiresAtMs - nowMs());
      if (ttlMs <= 0) return;
      await redis.command(["SET", key, JSON.stringify({ t: token, e: expiresAtMs }), "PX", ttlMs]);
    },
    clear: async function () {
      await redis.command(["DEL", key]);
    },
  };
}

// The token store for an Intellistay config, or undefined when Upstash is not configured (then: memory only).
export function redisTokenStoreFromEnv(config: IntellistayConfig, env: Record<string, string | undefined>): IntellistayTokenStore | undefined {
  const url = (env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token || url.indexOf("https://") !== 0) return undefined;
  return createRedisTokenStore(createUpstashCommandClient({ url: url, token: token }), intellistayTokenKey(tokenCacheNamespace(env), config));
}

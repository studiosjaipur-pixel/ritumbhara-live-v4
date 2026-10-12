import { createHash, timingSafeEqual } from "crypto";
import { maskPhoneNumber } from "./address";
import { isBotEnabled, redisNamespaceFor, type RedisNamespace } from "./config";
import { createConversationStore, createStoreKeys } from "./store";
import { createUpstashClient, RedisUnavailableError, type RedisClient } from "./upstash";

// Week 6 Stretch 2, Phase A: automatic WhatsApp follow-up CHECK endpoint (dry run only). SERVER-ONLY.
//
// The leads Sheet (Apps Script) decides WHICH leads are due a follow-up. For each one it asks this endpoint, which
// owns the bot's Redis state, whether a follow-up could be sent:
//   1. the feature is switched on (WHATSAPP_FOLLOW_UP_ENABLED=true) and the caller has the shared secret,
//   2. the guest has not opted out (the same STOP record the inbound bot writes),
//   3. this lead has not already been checked (a one-time Redis claim per Lead ID).
// Phase A has NO sending code: nothing here calls Twilio or any other service, and a request for mode "live" is
// refused. The dry-run claim uses its own key (wa:fu-dry:<LeadID>, kept 24 hours), so a dry run can never block a
// later real follow-up (wa:fu:<LeadID>, used only once live sending exists).

if (typeof window !== "undefined") {
  throw new Error("lib/whatsapp-bot/follow-up is server-only and must not be imported in browser code.");
}

export const FOLLOW_UP_MAX_BODY_BYTES = 4096;
export const FOLLOW_UP_MIN_SECRET_LENGTH = 32;
export const FOLLOW_UP_DRY_RUN_TTL_SECONDS = 24 * 60 * 60;

const LEAD_ID = /^L-[0-9A-F]{10}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

type Env = Record<string, string | undefined>;
export type FollowUpLogFn = (event: string, meta?: Record<string, string | number | boolean>) => void;

export interface FollowUpConfig {
  secret: string;
  upstashRedisRestUrl: string;
  upstashRedisRestToken: string;
  redisNamespace: RedisNamespace;
  botEnabled: boolean; // live sending will require the inbound bot (STOP handling) to be on
}

export type FollowUpConfigResult =
  | { status: "disabled" }
  | { status: "invalid"; problems: string[] } // names and reasons only, never values
  | { status: "ready"; config: FollowUpConfig };

export type FollowUpCheckResult = "would_send" | "opted_out" | "duplicate";

function read(env: Env, name: string): string {
  const v = env[name];
  return typeof v === "string" ? v.trim() : "";
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// OFF unless WHATSAPP_FOLLOW_UP_ENABLED is exactly "true" (case-insensitive). Does not depend on the inbound bot
// being enabled, so dry runs work while the bot or Hospitality OS is paused.
export function getFollowUpConfig(env: Env = process.env): FollowUpConfigResult {
  if (read(env, "WHATSAPP_FOLLOW_UP_ENABLED").toLowerCase() !== "true") return { status: "disabled" };
  const problems: string[] = [];
  const secret = read(env, "WHATSAPP_FOLLOW_UP_SECRET");
  if (!secret) problems.push("WHATSAPP_FOLLOW_UP_SECRET is not set");
  else if (secret.length < FOLLOW_UP_MIN_SECRET_LENGTH) problems.push("WHATSAPP_FOLLOW_UP_SECRET must be at least " + FOLLOW_UP_MIN_SECRET_LENGTH + " characters");
  const url = read(env, "UPSTASH_REDIS_REST_URL");
  if (!url) problems.push("UPSTASH_REDIS_REST_URL is not set");
  else if (!isHttpsUrl(url)) problems.push("UPSTASH_REDIS_REST_URL must be an https URL");
  const token = read(env, "UPSTASH_REDIS_REST_TOKEN");
  if (!token) problems.push("UPSTASH_REDIS_REST_TOKEN is not set");
  if (problems.length) return { status: "invalid", problems: problems };
  return {
    status: "ready",
    config: { secret: secret, upstashRedisRestUrl: url, upstashRedisRestToken: token, redisNamespace: redisNamespaceFor(env), botEnabled: isBotEnabled(env) },
  };
}

// Constant-time comparison of the presented secret with the configured one (both hashed to equal length first).
export function secretMatches(presented: string, expected: string): boolean {
  const a = createHash("sha256").update(presented, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b) && presented.length === expected.length;
}

export interface FollowUpDeps {
  getConfig: () => FollowUpConfigResult;
  createRedis: (config: FollowUpConfig) => RedisClient;
  now: () => Date;
  log: FollowUpLogFn;
}

const defaultLog: FollowUpLogFn = function (event, meta) {
  console.warn("[wa-follow-up] " + event + (meta ? " " + JSON.stringify(meta) : ""));
};

const defaultDeps: FollowUpDeps = {
  getConfig: function () { return getFollowUpConfig(); },
  createRedis: function (config) { return createUpstashClient({ url: config.upstashRedisRestUrl, token: config.upstashRedisRestToken }); },
  now: function () { return new Date(); },
  log: defaultLog,
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export function createFollowUpHandler(overrides?: Partial<FollowUpDeps>) {
  const deps: FollowUpDeps = Object.assign({}, defaultDeps, overrides || {});

  return async function handleFollowUpRequest(req: Request): Promise<Response> {
    // 1. Feature switch and configuration. When off, the endpoint behaves as if it did not exist.
    const configResult = deps.getConfig();
    if (configResult.status === "disabled") return json(404, { ok: false, error: "disabled" });
    if (configResult.status === "invalid") {
      deps.log("follow_up_config_invalid", { problems: configResult.problems.join("; ") });
      return json(503, { ok: false, error: "misconfigured" });
    }
    const config = configResult.config;

    // 2. Shared secret (Authorization: Bearer <secret>), checked before anything is read.
    const auth = req.headers.get("authorization") || "";
    const presented = /^Bearer\s+(.+)$/i.exec(auth);
    if (!presented || !secretMatches(presented[1].trim(), config.secret)) {
      deps.log("follow_up_unauthorized");
      return json(401, { ok: false, error: "unauthorized" });
    }

    // 3. Body: small JSON object only.
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (contentType.indexOf("application/json") !== 0) return json(415, { ok: false, error: "unsupported_media_type" });
    if (Number(req.headers.get("content-length") || "0") > FOLLOW_UP_MAX_BODY_BYTES) return json(413, { ok: false, error: "too_large" });
    const raw = await req.text();
    if (raw.length > FOLLOW_UP_MAX_BODY_BYTES) return json(413, { ok: false, error: "too_large" });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(400, { ok: false, error: "bad_request", field: "body" });
      body = parsed as Record<string, unknown>;
    } catch {
      return json(400, { ok: false, error: "bad_json" });
    }

    // 4. Fields (the response names the failing field, never its value).
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    const phone = typeof body.phone === "string" ? body.phone : "";
    const mode = typeof body.mode === "string" ? body.mode : "";
    if (!LEAD_ID.test(leadId)) return json(400, { ok: false, error: "bad_request", field: "leadId" });
    if (!E164.test(phone)) return json(400, { ok: false, error: "bad_request", field: "phone" });
    if (mode === "live") {
      deps.log("follow_up_live_refused", { lead: leadId });
      return json(409, { ok: false, error: "live_not_available" }); // Phase A: no sending code exists
    }
    if (mode !== "dry_run") return json(400, { ok: false, error: "bad_request", field: "mode" });

    const meta = { lead: leadId, to: maskPhoneNumber(phone), mode: mode };
    try {
      const client = deps.createRedis(config);
      // 5. Opt-out: the same record the inbound bot writes on STOP. An opted-out guest is never claimed.
      const store = createConversationStore(client, config.redisNamespace);
      let result: FollowUpCheckResult;
      if (await store.isOptedOut(phone)) {
        result = "opted_out";
      } else {
        // 6. One claim per lead (atomic SET NX). The dry-run key is separate from the live key.
        const key = createStoreKeys(config.redisNamespace).followUpDryRun(leadId);
        const claimed = await client.command(["SET", key, JSON.stringify({ at: deps.now().toISOString(), mode: mode }), "NX", "EX", FOLLOW_UP_DRY_RUN_TTL_SECONDS]);
        result = claimed === "OK" ? "would_send" : "duplicate";
      }
      deps.log("follow_up_checked", Object.assign({ result: result }, meta));
      return json(200, { ok: true, mode: mode, leadId: leadId, result: result, liveReady: false, botEnabled: config.botEnabled });
    } catch (err) {
      const redis = err instanceof RedisUnavailableError;
      deps.log(redis ? "follow_up_redis_unavailable" : "follow_up_error", Object.assign({ reason: redis ? (err as RedisUnavailableError).reason : "unexpected" }, meta));
      return json(503, { ok: false, error: redis ? "redis_unavailable" : "internal_error" });
    }
  };
}

export const handleFollowUpRequest = createFollowUpHandler();

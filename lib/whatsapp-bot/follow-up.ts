import { createHash, timingSafeEqual } from "crypto";
import { maskPhoneNumber } from "./address";
import { getBotConfig, isBotEnabled, redisNamespaceFor, type RedisNamespace } from "./config";
import { createConversationStore, createStoreKeys } from "./store";
import { createUpstashClient, RedisUnavailableError, type RedisClient } from "./upstash";
import { sendWhatsAppTemplate, type TwilioSendResult, type WhatsAppTemplateMessage } from "../twilio/send";

// Week 6 Stretch 2: automatic WhatsApp follow-up endpoint. SERVER-ONLY.
//
// The leads Sheet (Apps Script) decides WHICH leads are due a follow-up. For each one it calls this endpoint, which
// owns the bot's Redis state:
//   1. the feature is switched on (WHATSAPP_FOLLOW_UP_ENABLED=true) and the caller has the shared secret,
//   2. the guest has not opted out (the same STOP record the inbound bot writes),
//   3. this lead has not already been handled (a one-time Redis claim per Lead ID).
//
// mode "dry_run" (Phase A, unchanged): no message. Claim wa:fu-dry:<LeadID>, kept 24 hours, so a dry run never
// blocks a later real follow-up.
//
// mode "live": sends ONE approved WhatsApp template through Twilio. OFF unless ALL of these hold, otherwise 409:
//   - WHATSAPP_FOLLOW_UP_LIVE_ENABLED=true (its own switch, separate from WHATSAPP_FOLLOW_UP_ENABLED),
//   - the inbound bot is on and fully configured (WHATSAPP_BOT_ENABLED=true), so a guest's STOP reply is recorded,
//   - TWILIO_ACCOUNT_SID and the approved template WHATSAPP_FOLLOW_UP_CONTENT_SID (HX…) are set,
//   - WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES, if set, maps template variables only to guest-safe fields.
// The permanent claim wa:fu:<LeadID> (no expiry) is taken BEFORE Twilio is called and is never released, not even
// when the send fails, so a lead can never get a second automatic message. A second claim on the guest's number
// (wa:fu-phone:<E164>, 30 days) stops one guest with several Lead IDs getting more than one automatic message. The guest only ever receives the
// approved template; the only lead data that can reach it are the mapped guest-safe fields (destination, property,
// check-in, check-out). Lead ID, score, priority, source, Ref, notes and secrets are never sent to Twilio.

if (typeof window !== "undefined") {
  throw new Error("lib/whatsapp-bot/follow-up is server-only and must not be imported in browser code.");
}

export const FOLLOW_UP_MAX_BODY_BYTES = 4096;
export const FOLLOW_UP_MIN_SECRET_LENGTH = 32;
export const FOLLOW_UP_DRY_RUN_TTL_SECONDS = 24 * 60 * 60;
// Live: after one automatic follow-up, the same guest number gets no other automatic follow-up for this long, even
// for a different Lead ID (a guest can have several enquiries).
export const FOLLOW_UP_PHONE_COOLDOWN_SECONDS = 30 * 24 * 60 * 60;

// Lead fields that may be put into the guest's template. Nothing else from the Sheet can ever reach a guest.
export const GUEST_SAFE_FIELDS = ["destination", "property", "checkIn", "checkOut"] as const;
export type GuestSafeField = (typeof GUEST_SAFE_FIELDS)[number];

const LEAD_ID = /^L-[0-9A-F]{10}$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const ACCOUNT_SID = /^AC[0-9a-fA-F]{32}$/;
const CONTENT_SID = /^HX[0-9a-fA-F]{32}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Env = Record<string, string | undefined>;
export type FollowUpLogFn = (event: string, meta?: Record<string, string | number | boolean>) => void;

export type LiveOffReason = "live_flag_off" | "bot_disabled" | "live_misconfigured";

export interface FollowUpLiveConfig {
  accountSid: string;
  authToken: string;
  from: string; // E.164 sender (WHATSAPP_BOT_TO)
  contentSid: string;
  variables: Array<[string, GuestSafeField]>; // template variable number -> lead field
}

export type FollowUpLiveStatus =
  | { status: "off"; reason: LiveOffReason; problems: string[] } // names and reasons only, never values
  | { status: "ready"; config: FollowUpLiveConfig };

export interface FollowUpConfig {
  secret: string;
  upstashRedisRestUrl: string;
  upstashRedisRestToken: string;
  redisNamespace: RedisNamespace;
  botEnabled: boolean;
  live: FollowUpLiveStatus;
}

export type FollowUpConfigResult =
  | { status: "disabled" }
  | { status: "invalid"; problems: string[] } // names and reasons only, never values
  | { status: "ready"; config: FollowUpConfig };

export type FollowUpCheckResult = "would_send" | "opted_out" | "duplicate";
export type FollowUpLiveResult = "sent" | "opted_out" | "duplicate" | "send_failed";

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

// "1=destination,2=checkIn" -> [["1","destination"],["2","checkIn"]]. Unknown fields or bad numbers are problems.
export function parseContentVariables(raw: string): { variables: Array<[string, GuestSafeField]>; problems: string[] } {
  const variables: Array<[string, GuestSafeField]> = [];
  const problems: string[] = [];
  const seen: Record<string, boolean> = {};
  raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (pair) {
    const m = /^([1-9]\d?)\s*=\s*([A-Za-z]+)$/.exec(pair);
    if (!m || (GUEST_SAFE_FIELDS as readonly string[]).indexOf(m[2]) === -1) {
      problems.push("WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES may only map 1-99 to " + GUEST_SAFE_FIELDS.join(", "));
      return;
    }
    if (seen[m[1]]) { problems.push("WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES uses a variable number twice"); return; }
    seen[m[1]] = true;
    variables.push([m[1], m[2] as GuestSafeField]);
  });
  return { variables: variables, problems: problems };
}

// Live sending: every requirement must hold, otherwise it is off (fail closed) with the first failing reason.
export function getFollowUpLiveStatus(env: Env): FollowUpLiveStatus {
  if (read(env, "WHATSAPP_FOLLOW_UP_LIVE_ENABLED").toLowerCase() !== "true") return { status: "off", reason: "live_flag_off", problems: [] };
  const bot = getBotConfig(env);
  if (bot.status === "disabled") return { status: "off", reason: "bot_disabled", problems: ["WHATSAPP_BOT_ENABLED is not true"] };
  if (bot.status === "invalid") return { status: "off", reason: "bot_disabled", problems: bot.problems };
  const problems: string[] = [];
  const accountSid = read(env, "TWILIO_ACCOUNT_SID");
  if (!ACCOUNT_SID.test(accountSid)) problems.push("TWILIO_ACCOUNT_SID must be set to a valid Account SID for live follow-ups");
  const contentSid = read(env, "WHATSAPP_FOLLOW_UP_CONTENT_SID");
  if (!CONTENT_SID.test(contentSid)) problems.push("WHATSAPP_FOLLOW_UP_CONTENT_SID must be set to the approved template's Content SID (HX…)");
  const parsed = parseContentVariables(read(env, "WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES"));
  problems.push.apply(problems, parsed.problems);
  if (problems.length) return { status: "off", reason: "live_misconfigured", problems: problems };
  return {
    status: "ready",
    config: { accountSid: accountSid, authToken: bot.config.twilioAuthToken, from: bot.config.botTo, contentSid: contentSid, variables: parsed.variables },
  };
}

// OFF unless WHATSAPP_FOLLOW_UP_ENABLED is exactly "true" (case-insensitive). Dry runs do not depend on the inbound
// bot being enabled; live sends do (see getFollowUpLiveStatus).
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
    config: {
      secret: secret, upstashRedisRestUrl: url, upstashRedisRestToken: token, redisNamespace: redisNamespaceFor(env),
      botEnabled: isBotEnabled(env), live: getFollowUpLiveStatus(env),
    },
  };
}

// Constant-time comparison of the presented secret with the configured one (both hashed to equal length first).
export function secretMatches(presented: string, expected: string): boolean {
  const a = createHash("sha256").update(presented, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b) && presented.length === expected.length;
}

function isRealIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  return d.getUTCFullYear() === +s.slice(0, 4) && d.getUTCMonth() === +s.slice(5, 7) - 1 && d.getUTCDate() === +s.slice(8, 10);
}

// A guest-safe text value: short, single line, no links, emails or long digit runs (phone numbers). WhatsApp also
// rejects template variables with new lines, tabs or more than 4 consecutive spaces.
function safeText(v: string): boolean {
  return v.length >= 1 && v.length <= 60 && !/[\u0000-\u001F\u007F<>{}]/.test(v) && !/ {4,}/.test(v) &&
    !/https?:|www\.|@/i.test(v) && !/\d{5,}/.test(v);
}

// The template variables for one lead, built ONLY from the mapped guest-safe fields. Returns the first field that
// is missing or not guest-safe (by name, never its value).
export function buildTemplateVariables(variables: Array<[string, GuestSafeField]>, body: Record<string, unknown>):
  { ok: true; values: Record<string, string> } | { ok: false; field: GuestSafeField } {
  const values: Record<string, string> = {};
  for (let i = 0; i < variables.length; i++) {
    const field = variables[i][1];
    const raw = typeof body[field] === "string" ? (body[field] as string).trim() : "";
    if (field === "checkIn" || field === "checkOut") {
      if (!isRealIsoDate(raw)) return { ok: false, field: field };
      values[variables[i][0]] = +raw.slice(8, 10) + " " + MONTHS[+raw.slice(5, 7) - 1] + " " + raw.slice(0, 4); // "10 Dec 2026"
    } else {
      if (!safeText(raw)) return { ok: false, field: field };
      values[variables[i][0]] = raw;
    }
  }
  return { ok: true, values: values };
}

export interface FollowUpDeps {
  getConfig: () => FollowUpConfigResult;
  createRedis: (config: FollowUpConfig) => RedisClient;
  sendTemplate: (msg: WhatsAppTemplateMessage) => Promise<TwilioSendResult>;
  now: () => Date;
  log: FollowUpLogFn;
}

const defaultLog: FollowUpLogFn = function (event, meta) {
  console.warn("[wa-follow-up] " + event + (meta ? " " + JSON.stringify(meta) : ""));
};

const defaultDeps: FollowUpDeps = {
  getConfig: function () { return getFollowUpConfig(); },
  createRedis: function (config) { return createUpstashClient({ url: config.upstashRedisRestUrl, token: config.upstashRedisRestToken }); },
  sendTemplate: function (msg) { return sendWhatsAppTemplate(msg); },
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
    const liveReady = config.live.status === "ready";

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
    if (mode === "live") return handleLive(config, leadId, phone, body);
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
      return json(200, { ok: true, mode: mode, leadId: leadId, result: result, liveReady: liveReady, botEnabled: config.botEnabled });
    } catch (err) {
      const redis = err instanceof RedisUnavailableError;
      deps.log(redis ? "follow_up_redis_unavailable" : "follow_up_error", Object.assign({ reason: redis ? (err as RedisUnavailableError).reason : "unexpected" }, meta));
      return json(503, { ok: false, error: redis ? "redis_unavailable" : "internal_error" });
    }
  };

  async function handleLive(config: FollowUpConfig, leadId: string, phone: string, body: Record<string, unknown>): Promise<Response> {
    const meta = { lead: leadId, to: maskPhoneNumber(phone), mode: "live" };
    // a. Live must be explicitly on, with the inbound bot on and the template configured. Fail closed.
    if (config.live.status !== "ready") {
      deps.log("follow_up_live_refused", Object.assign({ reason: config.live.reason }, meta));
      if (config.live.problems.length) deps.log("follow_up_live_config_problems", { problems: config.live.problems.join("; ") });
      return json(409, { ok: false, error: "live_not_available", reason: config.live.reason });
    }
    const live = config.live.config;

    // b. Template variables from guest-safe fields only, validated before anything is claimed.
    const vars = buildTemplateVariables(live.variables, body);
    if (!vars.ok) return json(400, { ok: false, error: "bad_request", field: vars.field });

    let client: RedisClient;
    let key: string;
    try {
      client = deps.createRedis(config);
      // c. Opt-out first: an opted-out guest is never claimed and never contacted.
      if (await createConversationStore(client, config.redisNamespace).isOptedOut(phone)) {
        deps.log("follow_up_checked", Object.assign({ result: "opted_out" }, meta));
        return json(200, { ok: true, mode: "live", leadId: leadId, result: "opted_out", liveReady: true, botEnabled: config.botEnabled });
      }
      // d. Permanent claim (no expiry), taken BEFORE Twilio is called. Already claimed -> nothing is sent.
      key = createStoreKeys(config.redisNamespace).followUp(leadId);
      const claimed = await client.command(["SET", key, JSON.stringify({ state: "sending", at: deps.now().toISOString() }), "NX"]);
      if (claimed !== "OK") {
        deps.log("follow_up_checked", Object.assign({ result: "duplicate" }, meta));
        return json(200, { ok: true, mode: "live", leadId: leadId, result: "duplicate", liveReady: true, botEnabled: config.botEnabled });
      }
      // e. One automatic follow-up per guest number per cooldown, whatever the Lead ID. If this number already got
      //    one, this lead stays claimed (never sent) and the answer is duplicate.
      const phoneClaim = await client.command(["SET", createStoreKeys(config.redisNamespace).followUpPhone(phone),
        JSON.stringify({ lead: leadId, at: deps.now().toISOString() }), "NX", "EX", FOLLOW_UP_PHONE_COOLDOWN_SECONDS]);
      if (phoneClaim !== "OK") {
        await client.command(["SET", key, JSON.stringify({ state: "skipped", at: deps.now().toISOString(), reason: "phone_recently_contacted" })]);
        deps.log("follow_up_checked", Object.assign({ result: "duplicate", reason: "phone_recently_contacted" }, meta));
        return json(200, { ok: true, mode: "live", leadId: leadId, result: "duplicate", reason: "phone_recently_contacted", liveReady: true, botEnabled: config.botEnabled });
      }
    } catch (err) {
      const redis = err instanceof RedisUnavailableError;
      deps.log(redis ? "follow_up_redis_unavailable" : "follow_up_error", Object.assign({ reason: redis ? (err as RedisUnavailableError).reason : "unexpected" }, meta));
      return json(503, { ok: false, error: redis ? "redis_unavailable" : "internal_error" });
    }

    // f. Send the approved template. Whatever happens, the claim stays (it is only updated, never deleted).
    let sent: TwilioSendResult;
    try {
      sent = await deps.sendTemplate({ accountSid: live.accountSid, authToken: live.authToken, from: live.from, to: phone, contentSid: live.contentSid, contentVariables: vars.values });
    } catch {
      sent = { ok: false, reason: "internal", systemic: true };
    }
    const record = sent.ok
      ? { state: "sent", at: deps.now().toISOString(), sid: sent.sid }
      : { state: "failed", at: deps.now().toISOString(), reason: sent.reason };
    try {
      await client.command(["SET", key, JSON.stringify(record)]); // no NX/EX: overwrite our own claim, still permanent
    } catch {
      deps.log("follow_up_claim_update_failed", meta); // the "sending" claim remains, which still blocks a resend
    }

    if (sent.ok) {
      deps.log("follow_up_sent", Object.assign({ sid: sent.sid }, meta));
      return json(200, { ok: true, mode: "live", leadId: leadId, result: "sent", messageSid: sent.sid, liveReady: true, botEnabled: config.botEnabled });
    }
    const failMeta: Record<string, string | number | boolean> = Object.assign({ reason: sent.reason, systemic: sent.systemic }, meta);
    if (sent.code !== undefined) failMeta.twilioCode = sent.code;
    deps.log("follow_up_send_failed", failMeta);
    const out: Record<string, unknown> = { ok: true, mode: "live", leadId: leadId, result: "send_failed", reason: sent.reason, systemic: sent.systemic, liveReady: true, botEnabled: config.botEnabled };
    if (sent.code !== undefined) out.twilioCode = sent.code;
    return json(200, out);
  }
}

export const handleFollowUpRequest = createFollowUpHandler();

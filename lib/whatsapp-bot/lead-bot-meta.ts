import { createHash, createHmac, timingSafeEqual } from "crypto";
import { normalizePhoneNumber, maskPhoneNumber } from "./address";
import { DEFAULT_GROQ_MODEL, redisNamespaceFor, type WhatsAppBotConfig } from "./config";
import { createConversationHandler } from "./conversation";
import type { MessageHandler } from "./webhook";
import type { WhatsAppInboundMessage } from "./types";

// Lead qualification bot for messages that arrived on the META WhatsApp number. SERVER-ONLY.
//
// Runs ALONGSIDE the Twilio entry point (/api/whatsapp/inbound, unchanged). Meta delivers messages to the OS; the OS
// (after verifying Meta's signature and ruling out staff and known guests) forwards the message here as JSON,
// signed with LEAD_BOT_OS_SECRET:
//   X-Ritumbhara-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, t + "." + rawBody)>   (±5 minutes)
// The same conversation handler as the Twilio bot runs (Redis de-duplication by Meta message id, opt-out, rate
// limit, lock, state machine, qualified lead / handoff delivery). The reply texts go back to the OS, which sends them
// through Meta. Nothing here reads or uses any Twilio setting.
//
// OFF (404) unless WHATSAPP_BOT_META_ENABLED is exactly "true".

if (typeof window !== "undefined") {
  throw new Error("lib/whatsapp-bot/lead-bot-meta is server-only and must not be imported in browser code.");
}

type Env = Record<string, string | undefined>;
export const MAX_RAW_BODY_BYTES = 16 * 1024;
export const MAX_BODY_CHARS = 1000;
export const MAX_SKEW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;

function read(env: Env, name: string): string {
  const v = env[name];
  return typeof v === "string" ? v.trim() : "";
}

export type MetaBotConfigResult =
  | { status: "disabled" }
  | { status: "invalid"; problems: string[] }
  | { status: "ready"; config: WhatsAppBotConfig; secret: string };

export function getMetaLeadBotConfig(env: Env = process.env): MetaBotConfigResult {
  if (read(env, "WHATSAPP_BOT_META_ENABLED").toLowerCase() !== "true") return { status: "disabled" };
  const problems: string[] = [];
  const req = (name: string) => { const v = read(env, name); if (!v) problems.push(name + " is not set"); return v; };
  const secret = req("LEAD_BOT_OS_SECRET");
  if (secret && secret.length < MIN_SECRET_LENGTH) problems.push("LEAD_BOT_OS_SECRET must be at least 32 characters");
  const botTo = normalizePhoneNumber(req("WHATSAPP_META_BOT_TO"));
  if (read(env, "WHATSAPP_META_BOT_TO") && !botTo) problems.push("WHATSAPP_META_BOT_TO must be a phone number in international format");
  const handoff = normalizePhoneNumber(req("WHATSAPP_HANDOFF_NUMBER"));
  if (read(env, "WHATSAPP_HANDOFF_NUMBER") && !handoff) problems.push("WHATSAPP_HANDOFF_NUMBER must be a phone number in international format");
  const redisUrl = req("UPSTASH_REDIS_REST_URL");
  const redisToken = req("UPSTASH_REDIS_REST_TOKEN");
  if (problems.length || !botTo || !handoff) return { status: "invalid", problems };
  return {
    status: "ready",
    secret,
    config: {
      enabled: true,
      twilioAuthToken: "", // not used on this path
      // Only its host is used (the "site" field of qualified leads/handoffs).
      twilioWebhookUrl: read(env, "LEAD_BOT_META_PUBLIC_URL") || "https://www.ritumbhara.com/api/whatsapp/lead-bot",
      twilioAccountSid: null,
      botTo,
      handoffNumber: handoff,
      groqApiKey: read(env, "GROQ_API_KEY") || null,
      groqModel: read(env, "GROQ_MODEL") || DEFAULT_GROQ_MODEL,
      upstashRedisRestUrl: redisUrl,
      upstashRedisRestToken: redisToken,
      redisNamespace: redisNamespaceFor(env),
    },
  };
}

export function verifyOsSignature(secret: string, rawBody: string, header: string | null, nowSeconds: number): boolean {
  try {
    const m = /^t=(\d{9,11}),v1=([0-9a-f]{64})$/.exec((header || "").trim());
    if (!m || !secret) return false;
    if (Math.abs(nowSeconds - Number(m[1])) > MAX_SKEW_SECONDS) return false;
    const expected = Buffer.from(createHmac("sha256", secret).update(m[1] + "." + rawBody, "utf8").digest("hex"), "utf8");
    const given = Buffer.from(m[2], "utf8");
    return expected.length === given.length && timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

// The shared Redis store only accepts Twilio-shaped ids (SM + 32 hex). A Meta message id ("wamid.…") is mapped to a
// stable id of that shape, so a retried Meta delivery is still recognised as a duplicate without changing the store.
export function storeMessageId(metaMessageId: string): string {
  return "SM" + createHash("sha256").update("meta:" + metaMessageId, "utf8").digest("hex").slice(0, 32);
}

type LogFn = (event: string, meta?: Record<string, string | number | boolean>) => void;

export interface MetaLeadBotDeps {
  getConfig: () => MetaBotConfigResult;
  handleMessage: MessageHandler;
  now: () => number; // ms
  log: LogFn;
}

const defaultDeps: MetaLeadBotDeps = {
  getConfig: () => getMetaLeadBotConfig(process.env),
  handleMessage: createConversationHandler(),
  now: () => Date.now(),
  log: (event, meta) => console.warn("[wa-lead-bot-meta] " + event + (meta ? " " + JSON.stringify(meta) : "")),
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export function createMetaLeadBotHandler(overrides?: Partial<MetaLeadBotDeps>) {
  const deps: MetaLeadBotDeps = Object.assign({}, defaultDeps, overrides || {});
  return async function handleMetaLeadBot(req: Request): Promise<Response> {
    const cfg = deps.getConfig();
    if (cfg.status === "disabled") return json(404, { ok: false, error: "disabled" });
    if (cfg.status === "invalid") {
      deps.log("config_invalid", { problems: cfg.problems.join("; ") });
      return json(503, { ok: false, error: "not_configured" });
    }
    if ((req.headers.get("content-type") || "").toLowerCase().indexOf("application/json") !== 0) return json(415, { ok: false });
    if (Number(req.headers.get("content-length") || "0") > MAX_RAW_BODY_BYTES) return json(413, { ok: false });
    const raw = await req.text();
    if (raw.length > MAX_RAW_BODY_BYTES) return json(413, { ok: false });
    if (!verifyOsSignature(cfg.secret, raw, req.headers.get("x-ritumbhara-signature"), Math.floor(deps.now() / 1000))) {
      deps.log("signature_rejected");
      return json(403, { ok: false });
    }
    let input: any;
    try { input = JSON.parse(raw); } catch { return json(400, { ok: false }); }
    const messageId = typeof input?.messageId === "string" ? input.messageId.trim() : "";
    const from = normalizePhoneNumber(typeof input?.from === "string" ? input.from : "");
    if (!/^[A-Za-z0-9._=:-]{6,200}$/.test(messageId) || !from) return json(400, { ok: false });
    const rawText = typeof input.text === "string" ? input.text.trim() : "";
    const numMedia = Math.min(Math.max(Number(input.numMedia) || 0, 0), 10);
    const bodyStatus = !rawText ? "empty" : rawText.length > MAX_BODY_CHARS ? "too_long" : "ok";
    const message: WhatsAppInboundMessage = {
      messageSid: storeMessageId(messageId),
      accountSid: "",
      from,
      to: cfg.config.botTo,
      body: bodyStatus === "ok" ? rawText : "",
      numMedia,
      profileName: typeof input.profileName === "string" ? input.profileName.trim().slice(0, 100) || null : null,
      waId: from.replace(/\D/g, ""),
      bodyStatus,
    };
    try {
      const result = await deps.handleMessage(message, cfg.config);
      deps.log("message_handled", { from: maskPhoneNumber(from), status: bodyStatus });
      return json(200, { ok: true, replies: result.reply ? [result.reply] : [] });
    } catch (err) {
      deps.log("internal_error", { kind: err instanceof Error ? err.name : typeof err });
      return json(500, { ok: false });
    }
  };
}

export const handleMetaLeadBot = createMetaLeadBotHandler();

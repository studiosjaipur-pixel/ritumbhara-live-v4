import { normalizePhoneNumber } from "./address";

// Configuration for the Week 5 WhatsApp qualification bot (stretch). SERVER-ONLY.
// Every value comes from environment variables; nothing secret is hard-coded, and the human handoff number is
// configured (WHATSAPP_HANDOFF_NUMBER), not written into the bot.
//
// The bot is OFF unless WHATSAPP_BOT_ENABLED is exactly "true". When it is off, nothing else is required.
// Never import this module from a client component: it reads server-only secrets.

if (typeof window !== "undefined") {
  throw new Error("lib/whatsapp-bot/config is server-only and must not be imported in browser code.");
}

export const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

type Env = Record<string, string | undefined>;

export interface WhatsAppBotConfig {
  enabled: true;
  twilioAuthToken: string;
  twilioWebhookUrl: string; // exact URL configured in Twilio; used for signature verification
  twilioAccountSid: string | null; // optional extra check of the webhook's AccountSid
  botTo: string; // E.164 number the bot answers on (Sandbox number during development)
  handoffNumber: string; // E.164 human/team number given to the guest at handoff
  groqApiKey: string | null; // optional: without it the bot runs on deterministic parsing only
  groqModel: string;
  upstashRedisRestUrl: string;
  upstashRedisRestToken: string;
}

export type BotConfigResult =
  | { status: "disabled" }
  | { status: "invalid"; problems: string[] } // variable names and reasons only, never values
  | { status: "ready"; config: WhatsAppBotConfig };

function read(env: Env, name: string): string {
  const value = env[name];
  return typeof value === "string" ? value.trim() : "";
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// True only when WHATSAPP_BOT_ENABLED is "true" (case-insensitive). Anything else, including unset, is off.
export function isBotEnabled(env: Env = process.env): boolean {
  return read(env, "WHATSAPP_BOT_ENABLED").toLowerCase() === "true";
}

// Reads and validates the bot configuration. Never throws and never includes secret values in its result.
export function getBotConfig(env: Env = process.env): BotConfigResult {
  if (!isBotEnabled(env)) return { status: "disabled" };

  const problems: string[] = [];
  function required(name: string): string {
    const value = read(env, name);
    if (!value) problems.push(name + " is not set");
    return value;
  }

  const twilioAuthToken = required("TWILIO_AUTH_TOKEN");
  const twilioWebhookUrl = required("TWILIO_WEBHOOK_URL");
  if (twilioWebhookUrl && !isHttpsUrl(twilioWebhookUrl)) problems.push("TWILIO_WEBHOOK_URL must be an https URL");
  if (twilioWebhookUrl.indexOf("#") !== -1) problems.push("TWILIO_WEBHOOK_URL must not contain a #fragment");

  const accountSidRaw = read(env, "TWILIO_ACCOUNT_SID");
  if (accountSidRaw && !/^AC[0-9a-fA-F]{32}$/.test(accountSidRaw)) problems.push("TWILIO_ACCOUNT_SID is not a valid Account SID");

  // Accepts "whatsapp:+14155238886" or "+14155238886".
  const botToRaw = required("WHATSAPP_BOT_TO");
  const botTo = normalizePhoneNumber(botToRaw.replace(/^whatsapp:/i, ""));
  if (botToRaw && !botTo) problems.push("WHATSAPP_BOT_TO must be a phone number in international format");

  const handoffRaw = required("WHATSAPP_HANDOFF_NUMBER");
  const handoffNumber = normalizePhoneNumber(handoffRaw);
  if (handoffRaw && !handoffNumber) problems.push("WHATSAPP_HANDOFF_NUMBER must be a phone number in international format");

  const groqApiKey = read(env, "GROQ_API_KEY") || null; // optional fallback extractor
  const groqModel = read(env, "GROQ_MODEL") || DEFAULT_GROQ_MODEL;

  const upstashRedisRestUrl = required("UPSTASH_REDIS_REST_URL");
  if (upstashRedisRestUrl && !isHttpsUrl(upstashRedisRestUrl)) problems.push("UPSTASH_REDIS_REST_URL must be an https URL");
  const upstashRedisRestToken = required("UPSTASH_REDIS_REST_TOKEN");

  if (problems.length > 0 || !botTo || !handoffNumber) return { status: "invalid", problems: problems };

  return {
    status: "ready",
    config: {
      enabled: true,
      twilioAuthToken: twilioAuthToken,
      twilioWebhookUrl: twilioWebhookUrl,
      twilioAccountSid: accountSidRaw || null,
      botTo: botTo,
      handoffNumber: handoffNumber,
      groqApiKey: groqApiKey,
      groqModel: groqModel,
      upstashRedisRestUrl: upstashRedisRestUrl,
      upstashRedisRestToken: upstashRedisRestToken,
    },
  };
}

// Safe description of the configuration for logs: which settings are present, never their values.
export function describeBotConfig(env: Env = process.env): Record<string, boolean | string> {
  return {
    enabled: isBotEnabled(env),
    TWILIO_AUTH_TOKEN: !!read(env, "TWILIO_AUTH_TOKEN"),
    TWILIO_WEBHOOK_URL: !!read(env, "TWILIO_WEBHOOK_URL"),
    TWILIO_ACCOUNT_SID: !!read(env, "TWILIO_ACCOUNT_SID"),
    WHATSAPP_BOT_TO: !!read(env, "WHATSAPP_BOT_TO"),
    WHATSAPP_HANDOFF_NUMBER: !!read(env, "WHATSAPP_HANDOFF_NUMBER"),
    GROQ_API_KEY: !!read(env, "GROQ_API_KEY"),
    GROQ_MODEL: read(env, "GROQ_MODEL") ? "custom" : "default",
    UPSTASH_REDIS_REST_URL: !!read(env, "UPSTASH_REDIS_REST_URL"),
    UPSTASH_REDIS_REST_TOKEN: !!read(env, "UPSTASH_REDIS_REST_TOKEN"),
  };
}

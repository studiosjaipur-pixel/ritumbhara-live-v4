import { verifyTwilioSignature } from "../twilio/signature";
import { twimlEmpty, twimlMessage } from "../twilio/twiml";
import { formatPhoneForDisplay, maskPhoneNumber, parseWhatsAppAddress } from "./address";
import { getBotConfig, type BotConfigResult, type WhatsAppBotConfig } from "./config";
import { createConversationHandler } from "./conversation";
import { MESSAGES, internalFailure } from "./messages";
import type { InboundBodyStatus, WhatsAppInboundMessage } from "./types";

// Twilio WhatsApp inbound webhook handling (Week 5 stretch). SERVER-ONLY. Framework-independent:
// takes a standard Request, returns a standard Response, so app/api/whatsapp/inbound/route.ts stays thin.
//
// Order of checks (nothing about the message is acted on before the signature is verified):
//   1. Bot switch. Off (the default) -> empty TwiML; the request body is not even read.
//   2. Configuration complete? Otherwise 503 (setting names logged, never values).
//   3. Content-Type and size limits on the raw body.
//   4. X-Twilio-Signature over the raw form body, against TWILIO_WEBHOOK_URL (never the request's Host). -> 403
//   5. AccountSid (when TWILIO_ACCOUNT_SID is set) and To (must equal WHATSAPP_BOT_TO). -> 403
//   6. MessageSid and From format. -> 400
//   7. Body: trimmed and length-checked. Empty/media-only and over-long text is never passed on (body = "",
//      bodyStatus says why), so the handler can still apply de-duplication and opt-out before replying.
//   8. Message handler (conversation.ts): MessageSid de-duplication, opt-out, rate limit, per-sender lock and
//      the deterministic state machine, all backed by Redis. No AI.

if (typeof window !== "undefined") {
  throw new Error("lib/whatsapp-bot/webhook is server-only and must not be imported in browser code.");
}

export const MAX_RAW_BODY_BYTES = 16 * 1024; // a Twilio inbound webhook is a few KB at most
export const MAX_BODY_CHARS = 1000; // longest guest message the bot will process
const MESSAGE_SID = /^(SM|MM)[0-9a-fA-F]{32}$/;
const ACCOUNT_SID = /^AC[0-9a-fA-F]{32}$/;

// Fixed replies (texts live in messages.ts).
export const REPLIES = {
  textRequired: MESSAGES.textRequired,
  tooLong: MESSAGES.tooLong,
  fallback: internalFailure,
};

// Sanitized logging: event name plus a few non-sensitive fields only. Never the body, the full phone number,
// the signature, tokens or environment values.
export type LogFn = (event: string, meta?: Record<string, string | number | boolean>) => void;

export const defaultLog: LogFn = function (event, meta) {
  console.warn("[wa-inbound] " + event + (meta ? " " + JSON.stringify(meta) : ""));
};

function sidPrefix(sid: string): string {
  return sid ? sid.slice(0, 6) + "…" : "";
}

// What the message handler returns: one reply message, or no reply.
export interface InboundResult {
  reply: string | null;
}

export type MessageHandler = (message: WhatsAppInboundMessage, config: WhatsAppBotConfig) => Promise<InboundResult>;

export interface InboundDeps {
  getConfig: () => BotConfigResult;
  handleMessage: MessageHandler;
  log: LogFn;
}

const defaultDeps: InboundDeps = {
  getConfig: function () { return getBotConfig(process.env); },
  handleMessage: createConversationHandler(),
  log: defaultLog,
};

function plain(status: number): Response {
  return new Response(null, { status: status, headers: { "Cache-Control": "no-store" } });
}

function field(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  return typeof value === "string" ? value : "";
}

export function createInboundWebhookHandler(overrides?: Partial<InboundDeps>) {
  const deps: InboundDeps = Object.assign({}, defaultDeps, overrides || {});

  return async function handleInboundWebhook(req: Request): Promise<Response> {
    let verified = false;
    let handoffNumber = ""; // display form
    try {
      // 1. Bot switch. When off, nothing else runs and the body is not read.
      const configResult = deps.getConfig();
      if (configResult.status === "disabled") return twimlEmpty();
      if (configResult.status === "invalid") {
        deps.log("config_invalid", { problems: configResult.problems.join("; ") });
        return plain(503);
      }
      const config = configResult.config;
      handoffNumber = formatPhoneForDisplay(config.handoffNumber);

      // 2. Raw body limits (unauthenticated requests learn nothing from these).
      const contentType = (req.headers.get("content-type") || "").toLowerCase();
      if (contentType.indexOf("application/x-www-form-urlencoded") !== 0) return plain(415);
      const declared = Number(req.headers.get("content-length") || "0");
      if (declared > MAX_RAW_BODY_BYTES) return plain(413);
      const raw = await req.text();
      if (raw.length > MAX_RAW_BODY_BYTES) return plain(413);

      // 3. Signature over the raw form parameters and the configured URL.
      const params = new URLSearchParams(raw);
      const signatureOk = verifyTwilioSignature({
        url: config.twilioWebhookUrl,
        params: params,
        signature: req.headers.get("x-twilio-signature"),
        authToken: config.twilioAuthToken,
      });
      if (!signatureOk) {
        deps.log("signature_rejected");
        return plain(403);
      }
      verified = true;

      // 4. Account and destination.
      const accountSid = field(params, "AccountSid");
      if (config.twilioAccountSid && accountSid !== config.twilioAccountSid) {
        deps.log("account_rejected");
        return plain(403);
      }
      const to = parseWhatsAppAddress(field(params, "To"));
      if (!to || to !== config.botTo) {
        deps.log("destination_rejected");
        return plain(403);
      }

      // 5. Required fields.
      const messageSid = field(params, "MessageSid");
      const from = parseWhatsAppAddress(field(params, "From"));
      if (!MESSAGE_SID.test(messageSid) || !from || (accountSid && !ACCOUNT_SID.test(accountSid))) {
        deps.log("malformed_request", { sid: sidPrefix(messageSid) });
        return plain(400);
      }

      // 6. Message text. Text over MAX_BODY_CHARS (and empty/media-only messages) is never passed on.
      const rawText = field(params, "Body").trim();
      const numMediaRaw = parseInt(field(params, "NumMedia") || "0", 10);
      const numMedia = isFinite(numMediaRaw) && numMediaRaw > 0 ? Math.min(numMediaRaw, 10) : 0;
      const bodyStatus: InboundBodyStatus = !rawText ? "empty" : rawText.length > MAX_BODY_CHARS ? "too_long" : "ok";
      const body = bodyStatus === "ok" ? rawText : "";
      const meta = { sid: sidPrefix(messageSid), from: maskPhoneNumber(from), chars: rawText.length, media: numMedia, status: bodyStatus };

      const profileName = field(params, "ProfileName").trim().slice(0, 100) || null;
      const waId = field(params, "WaId").replace(/\D/g, "").slice(0, 20) || null;
      const message: WhatsAppInboundMessage = {
        messageSid: messageSid,
        accountSid: accountSid,
        from: from,
        to: to,
        body: body,
        numMedia: numMedia,
        profileName: profileName,
        waId: waId,
        bodyStatus: bodyStatus,
      };

      // 7. Handler: de-duplication, opt-out, rate limit, lock, state machine.
      const result = await deps.handleMessage(message, config);
      deps.log("message_handled", meta);
      return result.reply ? twimlMessage(result.reply) : twimlEmpty();
    } catch (err) {
      deps.log("internal_error", { verified: verified, kind: err instanceof Error ? err.name : typeof err });
      // Only a verified Twilio request gets a reply; anything else gets a bare 500.
      return verified && handoffNumber ? twimlMessage(REPLIES.fallback(handoffNumber)) : plain(500);
    }
  };
}

export const handleInboundWebhook = createInboundWebhookHandler();

import { createHash } from "crypto";
import { waitUntil } from "@vercel/functions";
import { ESCALATION_ACK_NOT_STORED, ESCALATION_ACK_STORED } from "../../config/guestMessages.config";
import { getIntellistayConfig, type IntellistayConfig, type IntellistayConfigResult } from "../intellistay/config";
import { createIntellistayClient, IntellistayError, type IntellistayClient } from "../intellistay/client";
import { redisTokenStoreFromEnv, type IntellistayTokenStore } from "../intellistay/token-store";
import type { NormalizedBooking } from "../intellistay/types";
import { normalizePhoneNumber } from "../whatsapp-bot/address";
import { stayFacts } from "./facts";
import { answerFaq, classifyGuestMessage, intentNeedsBooking } from "./faq";
import { getGuestMessagesApiConfig, json, readAuthorizedJson, type ApiConfigResult } from "./http";
import { postGuestEnvelope, type GuestEnvelope, type SinkResult } from "./queue";
import { istToday } from "./triggers";
import type { EscalationReason, GuestEscalation } from "./types";

// Week 7 Stretch 1 + 2: POST /api/guest-messages/ask. SERVER-ONLY.
//
// Body: { question, phone?, bookingCode?, channel?, messageId?, requireBooking? }
//   question    the guest's message (1-500 characters)
//   phone       the guest's number (E.164). With bookingCode, or alone when it matches exactly one current booking,
//               it identifies the guest's Intellistay booking, so answers can use that stay's configured facts.
//   messageId   optional ID of the incoming message (e.g. a Twilio MessageSid): makes a retried escalation idempotent.
//   requireBooking  optional, true = only handle the message if the phone matches a current Intellistay booking.
//               Used by the Hospitality OS WhatsApp webhook for senders it does not know, so that guests asking about
//               their stay reach this assistant while everyone else (website leads) keeps going to the lead bot. When no
//               booking is verified (or Intellistay cannot be read) it returns { outcome: "not_guest" }: nothing is
//               answered, stored or emailed, and the caller continues its normal flow.
// Returns { outcome: "answered", reply } or { outcome: "escalated", reason, escalationId, stored, reply }
// (with bookingVerified: true when requireBooking was set), or { outcome: "not_guest" }.
// An escalation is written to the "Guest Escalations" tab and emailed to the team. The guest is only told someone
// will reply when the escalation was actually stored, EXCEPT with requireBooking (the OS WhatsApp path, 4 s budget):
// there the booking is verified first, the reply is sent at once and the escalation is stored in the background
// (stored: null, delivery: "background"; a failure is logged as escalation_not_stored). Nothing is ever changed in
// Intellistay.
//
// Not wired into this website's own WhatsApp bot (lib/whatsapp-bot), so Week 5/6 behaviour is unchanged. The Hospitality
// OS WhatsApp webhook calls it with requireBooking for senders it does not know (see above).

if (typeof window !== "undefined") {
  throw new Error("lib/guest-messages/assistant is server-only and must not be imported in browser code.");
}

export const MAX_QUESTION_LENGTH = 500;
const BOOKING_CODE = /^[A-Za-z0-9/_-]{1,40}$/;
const MESSAGE_ID = /^[A-Za-z0-9_-]{6,64}$/;
const CHANNEL = /^[a-z_]{2,20}$/;

export type AskLogFn = (event: string, meta?: Record<string, string | number | boolean>) => void;

export interface AskDeps {
  getApiConfig: () => ApiConfigResult;
  getIntellistayConfig: () => IntellistayConfigResult;
  createClient: (config: IntellistayConfig) => IntellistayClient;
  deliver: (envelope: GuestEnvelope) => Promise<SinkResult>;
  // Keeps work running after the response is sent (Vercel waitUntil). Used only for requireBooking escalations.
  defer: (task: Promise<unknown>) => void;
  now: () => Date;
  elapsedMs: () => number; // monotonic clock for timing logs only
  log: AskLogFn;
}

// One Intellistay client per settings, reused while this server instance is warm, so its access token (kept in the
// client's memory, as before) is reused instead of logging in on every request. The client already refreshes the
// token before TOKEN_TTL_MS and logs in again on a 401. Bookings are still read fresh on every request.
//
// The token is also cached in the production Upstash Redis (UPSTASH_REDIS_REST_URL / _TOKEN, already used by the
// WhatsApp bot), so a new instance skips the ~6 s Intellistay login too. Token only, never bookings; when Redis is
// not configured or fails, the client simply logs in as before. Used by this ask route only.
export function askTokenStore(config: IntellistayConfig, env: Record<string, string | undefined> = process.env): IntellistayTokenStore | undefined {
  return redisTokenStoreFromEnv(config, env);
}

let sharedClient: { key: string; client: IntellistayClient } | null = null;
export function sharedIntellistayClient(config: IntellistayConfig): IntellistayClient {
  const key = createHash("sha256").update(JSON.stringify(config), "utf8").digest("hex");
  if (!sharedClient || sharedClient.key !== key) {
    sharedClient = { key: key, client: createIntellistayClient({ config: config, tokenStore: askTokenStore(config) }) };
  }
  return sharedClient.client;
}

const defaultDeps: AskDeps = {
  getApiConfig: function () { return getGuestMessagesApiConfig(); },
  getIntellistayConfig: function () { return getIntellistayConfig(); },
  createClient: function (config) { return sharedIntellistayClient(config); },
  deliver: function (envelope) { return postGuestEnvelope(envelope); },
  defer: function (task) { waitUntil(task); },
  now: function () { return new Date(); },
  elapsedMs: function () { return performance.now(); },
  log: function (event, meta) { console.warn("[guest-assistant] " + event + (meta ? " " + JSON.stringify(meta) : "")); },
};

function cleanQuestion(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]+/g, " ").trim();
  return s && s.length <= MAX_QUESTION_LENGTH ? s : null;
}

export function escalationIdFor(parts: string[]): string {
  return "E-" + createHash("sha256").update(parts.join("|"), "utf8").digest("hex").slice(0, 10).toUpperCase();
}

// The guest's booking: bookingCode + phone must both match; or, with phone only, exactly one booking that has not
// ended yet. Anything ambiguous returns null (the FAQ then escalates rather than answering for the wrong stay).
export function findGuestBooking(bookings: NormalizedBooking[], phone: string | null, bookingCode: string | null, today: string): NormalizedBooking | null {
  if (!phone) return null;
  const mine = bookings.filter(function (b) { return b.guest.phone === phone; });
  if (bookingCode) {
    const code = bookingCode.toLowerCase();
    const m = mine.filter(function (b) { return (b.bookingCode || "").toLowerCase() === code; });
    return m.length === 1 ? m[0] : null;
  }
  const current = mine.filter(function (b) { return b.checkOutDate >= today; });
  return current.length === 1 ? current[0] : null;
}

export function createGuestAskHandler(overrides?: Partial<AskDeps>) {
  const deps: AskDeps = Object.assign({}, defaultDeps, overrides || {});

  return async function handleAskRequest(req: Request): Promise<Response> {
    const startedMs = deps.elapsedMs();
    const ms = function () { return Math.round(deps.elapsedMs() - startedMs); };
    const auth = await readAuthorizedJson(req, deps.getApiConfig, deps.log);
    if (!auth.ok) return auth.response;
    const body = auth.body;

    const question = cleanQuestion(body.question);
    if (!question) return json(400, { ok: false, error: "bad_request", field: "question" });
    let phone: string | null = null;
    if (body.phone !== undefined && body.phone !== null) {
      phone = typeof body.phone === "string" && /^\+[1-9]\d{7,14}$/.test(body.phone) ? normalizePhoneNumber(body.phone) : null;
      if (!phone) return json(400, { ok: false, error: "bad_request", field: "phone" });
    }
    let bookingCode: string | null = null;
    if (body.bookingCode !== undefined && body.bookingCode !== null) {
      if (typeof body.bookingCode !== "string" || !BOOKING_CODE.test(body.bookingCode.trim())) return json(400, { ok: false, error: "bad_request", field: "bookingCode" });
      bookingCode = body.bookingCode.trim();
    }
    const channel = typeof body.channel === "string" && CHANNEL.test(body.channel) ? body.channel : "api";
    if (body.messageId !== undefined && (typeof body.messageId !== "string" || !MESSAGE_ID.test(body.messageId))) return json(400, { ok: false, error: "bad_request", field: "messageId" });
    const messageId = typeof body.messageId === "string" ? body.messageId : null;
    if (body.requireBooking !== undefined && typeof body.requireBooking !== "boolean") return json(400, { ok: false, error: "bad_request", field: "requireBooking" });
    const requireBooking = body.requireBooking === true;
    if (requireBooking && !phone) return json(400, { ok: false, error: "bad_request", field: "phone" });

    const now = deps.now();
    const today = istToday(now);
    const classification = classifyGuestMessage(question);

    // Look up the guest's booking when the answer depends on which stay it is, or when the caller requires one.
    let booking: NormalizedBooking | null = null;
    let lookup = "not_needed";
    if (requireBooking || intentNeedsBooking(classification)) {
      lookup = "no_guest_details";
      if (phone) {
        const cfg = deps.getIntellistayConfig();
        if (cfg.status !== "ready") {
          lookup = "intellistay_misconfigured";
        } else {
          try {
            const r = await deps.createClient(cfg.config).fetchNormalizedBookings();
            booking = findGuestBooking(r.bookings, phone, bookingCode, today);
            lookup = booking ? "found" : "not_found";
          } catch (err) {
            lookup = "intellistay_" + (err instanceof IntellistayError ? err.reason : "error");
          }
        }
      }
    }

    // Not a verified guest: hand the message back untouched (nothing answered, stored or emailed).
    if (requireBooking && !booking) {
      deps.log("not_guest", { lookup: lookup, channel: channel, ms: ms() });
      return json(200, { ok: true, outcome: "not_guest" });
    }
    const verified = requireBooking ? { bookingVerified: true } : {};

    const answer = answerFaq(classification, { facts: stayFacts(booking), booking: booking });
    if (answer.kind === "answer") {
      deps.log("answered", { intent: answer.intent, lookup: lookup, channel: channel, ms: ms() });
      return json(200, Object.assign({ ok: true, outcome: "answered", intent: answer.intent, reply: answer.text }, verified));
    }

    // Escalate: minimum useful context for the team, no other guest data.
    const reason: EscalationReason = answer.reason;
    const escalation: GuestEscalation = {
      escalationId: escalationIdFor(messageId ? ["msg", messageId] : ["q", phone || "-", bookingCode || "-", question, today]),
      reason: reason,
      question: question,
      guestPhone: phone,
      bookingCode: booking ? booking.bookingCode : null,
      intent: answer.intent,
      channel: channel,
      receivedAt: now.toISOString(),
    };
    // Stores the escalation (Guest Escalations row + team email via Apps Script, ~5 s) and logs the result. Never rejects.
    const deliverAndLog = async function (mode: "inline" | "background"): Promise<boolean> {
      let ok = false;
      let failure = "";
      try {
        const r = await deps.deliver({ type: "guest_escalation", escalation: escalation });
        ok = r.ok;
        if (!r.ok) failure = r.reason;
      } catch {
        failure = "network";
      }
      deps.log(ok ? "escalated" : "escalation_not_stored", { reason: reason, id: escalation.escalationId, lookup: lookup, channel: channel, failure: failure || "none", delivery: mode, ms: ms() });
      return ok;
    };

    // Hospitality OS WhatsApp path (requireBooking): the OS waits only 4 s, and Apps Script alone takes ~5 s, so the
    // guest gets the "passed to our team" reply as soon as the booking is verified, and the escalation is stored and
    // emailed in the background. The escalation ID is fixed (from messageId), so a retry cannot create a second row.
    // A background failure is logged as escalation_not_stored. Every other caller keeps the store-first rule below.
    if (requireBooking) {
      deps.defer(deliverAndLog("background"));
      deps.log("escalation_ack_sent", { reason: reason, id: escalation.escalationId, lookup: lookup, channel: channel, ms: ms() });
      return json(200, Object.assign({
        ok: true, outcome: "escalated", reason: reason, intent: answer.intent, escalationId: escalation.escalationId,
        stored: null, delivery: "background", reply: ESCALATION_ACK_STORED,
      }, verified));
    }

    const stored = await deliverAndLog("inline");
    return json(200, Object.assign({
      ok: true, outcome: "escalated", reason: reason, intent: answer.intent, escalationId: escalation.escalationId,
      stored: stored, reply: stored ? ESCALATION_ACK_STORED : ESCALATION_ACK_NOT_STORED,
    }, verified));
  };
}

export const handleGuestAsk = createGuestAskHandler();

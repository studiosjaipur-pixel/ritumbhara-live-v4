import { createHash } from "crypto";
import { ESCALATION_ACK_NOT_STORED, ESCALATION_ACK_STORED } from "../../config/guestMessages.config";
import { getIntellistayConfig, type IntellistayConfig, type IntellistayConfigResult } from "../intellistay/config";
import { createIntellistayClient, IntellistayError, type IntellistayClient } from "../intellistay/client";
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
// Body: { question, phone?, bookingCode?, channel?, messageId? }
//   question    the guest's message (1-500 characters)
//   phone       the guest's number (E.164). With bookingCode, or alone when it matches exactly one current booking,
//               it identifies the guest's Intellistay booking, so answers can use that stay's configured facts.
//   messageId   optional ID of the incoming message (e.g. a Twilio MessageSid): makes a retried escalation idempotent.
// Returns { outcome: "answered", reply } or { outcome: "escalated", reason, escalationId, stored, reply }.
// An escalation is written to the "Guest Escalations" tab and emailed to the team. The guest is only told someone
// will reply when the escalation was actually stored. Nothing is ever changed in Intellistay.
//
// Not yet wired into the live WhatsApp bot (lib/whatsapp-bot), so Week 5/6 behaviour is unchanged; the bot (or the
// team) can call this route once it is approved.

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
  now: () => Date;
  log: AskLogFn;
}

const defaultDeps: AskDeps = {
  getApiConfig: function () { return getGuestMessagesApiConfig(); },
  getIntellistayConfig: function () { return getIntellistayConfig(); },
  createClient: function (config) { return createIntellistayClient({ config: config }); },
  deliver: function (envelope) { return postGuestEnvelope(envelope); },
  now: function () { return new Date(); },
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

    const now = deps.now();
    const today = istToday(now);
    const classification = classifyGuestMessage(question);

    // Look up the guest's booking only when the answer depends on which stay it is.
    let booking: NormalizedBooking | null = null;
    let lookup = "not_needed";
    if (intentNeedsBooking(classification)) {
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

    const answer = answerFaq(classification, { facts: stayFacts(booking), booking: booking });
    if (answer.kind === "answer") {
      deps.log("answered", { intent: answer.intent, lookup: lookup, channel: channel });
      return json(200, { ok: true, outcome: "answered", intent: answer.intent, reply: answer.text });
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
    let stored = false;
    let failure = "";
    try {
      const r = await deps.deliver({ type: "guest_escalation", escalation: escalation });
      stored = r.ok;
      if (!r.ok) failure = r.reason;
    } catch {
      failure = "network";
    }
    deps.log(stored ? "escalated" : "escalation_not_stored", { reason: reason, id: escalation.escalationId, lookup: lookup, channel: channel, failure: failure || "none" });
    return json(200, {
      ok: true, outcome: "escalated", reason: reason, intent: answer.intent, escalationId: escalation.escalationId,
      stored: stored, reply: stored ? ESCALATION_ACK_STORED : ESCALATION_ACK_NOT_STORED,
    });
  };
}

export const handleGuestAsk = createGuestAskHandler();

import type { NormalizedBooking } from "../intellistay/types";
import { stayFacts } from "./facts";
import { guestsText, renderGuestMessage } from "./templates";
import type { GuestEscalation, GuestMessageQueueItem, PlannedMessage } from "./types";

// Week 7: the team queue. SERVER-ONLY.
//
// Queue items and escalations go to the SAME Google Apps Script web app and leads Sheet the team already uses
// (Week 5/6), as two new tabs: "Guest Messages" and "Guest Escalations". The Sheet is the queue: the team reviews
// READY messages, sends them, and sets Status to SENT. Nothing here contacts a guest.
//
// Idempotency: each item has a fixed ID (messageId / escalationId) and the Apps Script ignores an ID it already has
// (it may only move an existing message forward, e.g. QUEUED -> READY). A failed delivery is reported, not hidden;
// it is retried by the next run because nothing was stored.
//
// Settings (server-only, never NEXT_PUBLIC_): GUEST_MESSAGES_SINK_URL (the Apps Script /exec URL, normally the same
// deployment as QUALIFIED_LEAD_SINK_URL) and GUEST_MESSAGES_SINK_SECRET (must match the Script Property of the same
// name). Apps Script cannot read request headers, so the secret travels in the JSON body, server to server.

if (typeof window !== "undefined") {
  throw new Error("lib/guest-messages/queue is server-only and must not be imported in browser code.");
}

export const SINK_ATTEMPT_TIMEOUT_MS = 8000;
const ALLOWED_PREFIX = "https://script.google.com/";

export type SinkFailure = "not_configured" | "timeout" | "network" | "http_4xx" | "http_5xx" | "busy" | "rejected" | "bad_response";

export type SinkResult =
  | { ok: true; status: "stored" | "duplicate" | "updated"; emailStatus?: "SENT" | "FAILED" | "UNKNOWN" }
  | { ok: false; reason: SinkFailure };

export type GuestEnvelope =
  | { type: "guest_message"; message: GuestMessageQueueItem }
  | { type: "guest_escalation"; escalation: GuestEscalation };

export interface SinkOptions {
  url?: string | null;
  secret?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

// The PMS room label shown to the TEAM when the room is not mapped to a website property.
function roomLabel(booking: NormalizedBooking): string | null {
  const r = booking.rooms[0];
  if (!r) return null;
  const parts = [r.roomTypeName, r.roomNo ? "room " + r.roomNo : null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function buildQueueItem(planned: PlannedMessage, booking: NormalizedBooking, now: Date): GuestMessageQueueItem {
  const facts = stayFacts(booking);
  return {
    messageId: planned.messageId,
    type: planned.type,
    status: planned.status,
    reason: planned.reason,
    scheduledDate: planned.scheduledDate,
    sendBy: planned.sendBy,
    bookingId: booking.bookingId,
    bookingCode: booking.bookingCode,
    checkIn: booking.checkInDate,
    checkOut: booking.checkOutDate,
    nights: booking.nights,
    guests: guestsText(booking.adults, booking.children),
    property: facts.propertyName || roomLabel(booking),
    guestName: booking.guest.firstName,
    guestPhone: booking.guest.phone,
    specialRequest: booking.specialRequest ? "yes" : "no",
    bookingSource: booking.source,
    message: renderGuestMessage({ type: planned.type, booking: booking, facts: facts }),
    createdAt: now.toISOString(),
  };
}

export async function postGuestEnvelope(envelope: GuestEnvelope, options?: SinkOptions): Promise<SinkResult> {
  const o = options || {};
  const url = o.url !== undefined ? o.url : process.env.GUEST_MESSAGES_SINK_URL;
  const secret = o.secret !== undefined ? o.secret : process.env.GUEST_MESSAGES_SINK_SECRET;
  if (!url || !secret || url.indexOf(ALLOWED_PREFIX) !== 0) return { ok: false, reason: "not_configured" };
  const doFetch = o.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, o.timeoutMs || SINK_ATTEMPT_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ secret: secret }, envelope)),
        redirect: "follow", // Apps Script answers with a 302 to script.googleusercontent.com
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "timeout" : "network" };
    }
    if (res.status >= 500) return { ok: false, reason: "http_5xx" };
    if (!res.ok) return { ok: false, reason: "http_4xx" };
    let reply: { ok?: unknown; stored?: unknown; duplicate?: unknown; updated?: unknown; emailStatus?: unknown; error?: unknown };
    try {
      reply = JSON.parse(await res.text());
    } catch (err) {
      return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "timeout" : "bad_response" };
    }
    if (!reply || typeof reply !== "object") return { ok: false, reason: "bad_response" };
    const emailStatus = reply.emailStatus === "SENT" ? "SENT" : reply.emailStatus === "FAILED" ? "FAILED" : "UNKNOWN";
    if (reply.ok === true && reply.stored === true) return { ok: true, status: "stored", emailStatus: emailStatus };
    if (reply.ok === true && reply.duplicate === true) return { ok: true, status: reply.updated === true ? "updated" : "duplicate" };
    if (reply.ok === false && reply.error === "busy") return { ok: false, reason: "busy" };
    return { ok: false, reason: reply.ok === false ? "rejected" : "bad_response" };
  } finally {
    clearTimeout(timer);
  }
}

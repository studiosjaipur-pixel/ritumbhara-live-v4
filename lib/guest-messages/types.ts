import type { GuestMessageType } from "../../config/guestMessages.config";

// Week 7: team queue types (Guest Messages tab) and escalation types (Guest Escalations tab).

// QUEUED  created ahead of its scheduled date (lookahead); becomes READY on the day.
// READY   due now: the team should review and send it.
// SENT    the team sent it (set by the team in the Sheet).
// SKIPPED due, but must not be sent (booking cancelled, no-show, unknown status...).
// FAILED  due, but cannot be sent as created (e.g. no usable guest phone), or the team's send failed.
export const QUEUE_STATUSES = ["QUEUED", "READY", "SENT", "SKIPPED", "FAILED"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export type SkipReason = "status_cancelled" | "status_not_eligible" | "status_unknown";
export type FailReason = "no_guest_phone";

// One planned message, before anything is stored. Contains guest data: never log it whole.
export interface PlannedMessage {
  messageId: string; // GM- + 12 hex: fixed for (booking, type, scheduled date), so re-runs never duplicate
  type: GuestMessageType;
  status: "QUEUED" | "READY" | "SKIPPED" | "FAILED";
  reason: SkipReason | FailReason | null;
  scheduledDate: string; // YYYY-MM-DD, India time
  // Last day (India time) the message may still be sent: the end of its window (scheduled date + grace, capped).
  // After it the message has lapsed: the Sheet marks it SKIPPED (expired) and never shows it in the digest again.
  sendBy: string;
  bookingId: string;
}

// What is sent to the Guest Messages tab. Only what the team needs to send the message.
export interface GuestMessageQueueItem {
  messageId: string;
  type: GuestMessageType;
  status: PlannedMessage["status"];
  reason: string | null;
  scheduledDate: string;
  sendBy: string; // YYYY-MM-DD: do not send after this day
  bookingId: string;
  bookingCode: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: string | null; // "2 adults, 1 child"
  property: string | null; // website property name when the room is mapped, else the PMS room type/number
  guestName: string | null; // first name only
  guestPhone: string | null; // E.164
  specialRequest: "yes" | "no";
  bookingSource: string | null;
  message: string; // the text for the team to send
  createdAt: string; // ISO UTC
}

export const ESCALATION_REASONS = [
  "HUMAN_REQUESTED", // the guest asked for a person
  "BOOKING_CHANGE", // dates, guests, room, early check-in / late checkout...
  "CANCELLATION",
  "PAYMENT", // payments, refunds, invoices, prices
  "URGENT_ISSUE", // something broken, a complaint, an emergency
  "MISSING_INFORMATION", // a supported question, but the answer is not configured for this stay
  "UNSUPPORTED_QUESTION", // not a question the FAQ covers
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export interface GuestEscalation {
  escalationId: string; // E- + 10 hex
  reason: EscalationReason;
  question: string; // the guest's message, trimmed to 500 characters
  guestPhone: string | null; // E.164, so the team can reply
  bookingCode: string | null; // only when the guest's booking was verified
  intent: string | null; // the FAQ topic it matched, if any
  channel: string; // where the question came from, e.g. "whatsapp"
  receivedAt: string; // ISO UTC
}

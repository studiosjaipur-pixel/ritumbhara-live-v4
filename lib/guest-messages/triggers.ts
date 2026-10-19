import { createHash } from "crypto";
import {
  BLOCKED_STATUS_NAME_PATTERN, CANCELLED_STATUS_IDS, ELIGIBLE_STATUS_IDS, GUEST_MESSAGE_LOOKAHEAD_DAYS, GUEST_MESSAGE_TYPES, STATUS_NAME_TO_ID,
  guestMessageTiming, type GuestMessageType, type MessageTiming,
} from "../../config/guestMessages.config";
import type { NormalizedBooking } from "../intellistay/types";
import type { PlannedMessage, SkipReason } from "./types";

// Week 7: deterministic trigger logic. Pure: the same bookings and the same "today" always give the same plan.
//
// For each booking and message type, the scheduled date is the anchor date (check-in or checkout) plus the
// configured offset, and the message may be created from that date until the end of its grace period:
//   - PRE_ARRIVAL never on or after the check-in date,
//   - CHECK_IN and CHECKOUT never after the checkout date.
// Inside that window the message is READY (or SKIPPED/FAILED); up to LOOKAHEAD days before it, QUEUED.
// Outside it, nothing is created: past bookings and missed windows are left alone, never messaged late.
// The window's last day travels with every message as `sendBy`, so the team queue (Apps Script) can expire a
// message that was queued but not sent in time, instead of showing it later.
//
// The message ID is a hash of (booking ID, type, scheduled date), so every run produces the same ID for the same
// scheduled event and the queue can ignore repeats. If the stay dates change, the scheduled date and the ID change.

export interface TriggerOptions {
  today: string; // YYYY-MM-DD, India time
  timing?: Record<GuestMessageType, MessageTiming>;
  lookaheadDays?: number;
  eligibleStatusIds?: Record<GuestMessageType, number[]>;
}

export function addDays(day: string, n: number): string {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

// Today's date in India (UTC+05:30), as YYYY-MM-DD.
export function istToday(now: Date): string {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function messageIdFor(bookingId: string, type: GuestMessageType, scheduledDate: string): string {
  return "GM-" + createHash("sha256").update(bookingId + "|" + type + "|" + scheduledDate, "utf8").digest("hex").slice(0, 12).toUpperCase();
}

// The booking's status as one ID we can trust, or null when it is unknown. Fail-safe:
//   - ID and name both present: the name must be a recognised status name (STATUS_NAME_TO_ID) for the SAME ID;
//     an unrecognised name ("Tentative") or a contradiction (ID 1 with "CheckedOut") gives null.
//   - Only an ID: that ID. Only a name: the ID its recognised name stands for, else null.
// Null always means "do not message" (status_unknown).
export function resolvedStatusId(booking: NormalizedBooking): number | null {
  const name = (booking.statusName || "").trim().toLowerCase();
  const nameId = name && Object.prototype.hasOwnProperty.call(STATUS_NAME_TO_ID, name) ? STATUS_NAME_TO_ID[name] : null;
  if (booking.statusId !== null) {
    if (!name) return booking.statusId;
    return nameId === booking.statusId ? booking.statusId : null;
  }
  return nameId;
}

// Null when the booking may get this message type; otherwise why not. Checked in this order, most cautious first:
// a cancelled-looking name or a cancelled/no-show/void ID always blocks; then the status must resolve to one trusted
// ID that is eligible for this message type. Anything else is skipped and never queued.
export function statusSkipReason(booking: NormalizedBooking, type: GuestMessageType, eligible: Record<GuestMessageType, number[]> = ELIGIBLE_STATUS_IDS): SkipReason | null {
  if (booking.statusName && BLOCKED_STATUS_NAME_PATTERN.test(booking.statusName)) return "status_cancelled";
  if (booking.statusId !== null && CANCELLED_STATUS_IDS.indexOf(booking.statusId) !== -1) return "status_cancelled";
  const id = resolvedStatusId(booking);
  if (id === null) return "status_unknown";
  if (CANCELLED_STATUS_IDS.indexOf(id) !== -1) return "status_cancelled";
  return eligible[type].indexOf(id) === -1 ? "status_not_eligible" : null;
}

// The [first, last] dates on which this message may be created, or null if the window is empty.
export function messageWindow(booking: NormalizedBooking, type: GuestMessageType, timing: Record<GuestMessageType, MessageTiming> = guestMessageTiming): { scheduled: string; last: string } | null {
  const t = timing[type];
  const anchor = t.anchor === "checkIn" ? booking.checkInDate : booking.checkOutDate;
  const scheduled = addDays(anchor, t.offsetDays);
  let last = addDays(scheduled, Math.max(0, t.graceDays));
  const limit = type === "PRE_ARRIVAL" ? addDays(booking.checkInDate, -1) : booking.checkOutDate;
  if (last > limit) last = limit;
  if (scheduled > last) return null;
  return { scheduled: scheduled, last: last };
}

export function planMessages(bookings: NormalizedBooking[], options: TriggerOptions): PlannedMessage[] {
  const today = options.today;
  const timing = options.timing || guestMessageTiming;
  const lookahead = Math.max(0, options.lookaheadDays === undefined ? GUEST_MESSAGE_LOOKAHEAD_DAYS : options.lookaheadDays);
  const eligible = options.eligibleStatusIds || ELIGIBLE_STATUS_IDS;
  const horizon = addDays(today, lookahead);
  const out: PlannedMessage[] = [];

  bookings.forEach(function (booking) {
    GUEST_MESSAGE_TYPES.forEach(function (type) {
      const w = messageWindow(booking, type, timing);
      if (!w) return;
      const due = today >= w.scheduled && today <= w.last;
      const upcoming = !due && w.scheduled > today && w.scheduled <= horizon;
      if (!due && !upcoming) return;

      const skip = statusSkipReason(booking, type, eligible);
      // Ahead of time, only bookings that would be messaged are queued (a cancelled one is simply not shown).
      if (upcoming && skip) return;
      const base = { messageId: messageIdFor(booking.bookingId, type, w.scheduled), type: type, scheduledDate: w.scheduled, sendBy: w.last, bookingId: booking.bookingId };
      if (skip) out.push(Object.assign({ status: "SKIPPED" as const, reason: skip }, base));
      else if (upcoming) out.push(Object.assign({ status: "QUEUED" as const, reason: null }, base));
      else if (!booking.guest.phone) out.push(Object.assign({ status: "FAILED" as const, reason: "no_guest_phone" as const }, base));
      else out.push(Object.assign({ status: "READY" as const, reason: null }, base));
    });
  });
  return out;
}

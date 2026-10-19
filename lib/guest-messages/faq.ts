import { BLOCKED_STATUS_NAME_PATTERN, CANCELLED_STATUS_IDS, GUEST_CONTACT } from "../../config/guestMessages.config";
import { resolvedStatusId } from "./triggers";
import type { NormalizedBooking } from "../intellistay/types";
import type { StayFacts } from "./facts";
import { formatDay } from "./templates";
import type { EscalationReason } from "./types";

// Week 7 Stretch 1: FAQ replies. Pure (no I/O).
//
// The FAQ answers ONLY from configured facts (facts.ts: the website's own property, booking-engine and location
// config) or the guest's verified Intellistay booking. When the topic is supported but the fact is not configured
// for this stay, it escalates (MISSING_INFORMATION) instead of guessing. It never says "no" to an amenity just
// because it is not listed (unverified lists are intentionally empty), and never invents Wi-Fi details, parking,
// policies or facilities.
//
// Escalation always wins over the FAQ for: asking for a person, urgent problems/complaints, cancellations,
// payments/refunds/prices and booking changes (dates, guests, early check-in, late checkout...).

export type FaqIntent =
  | "check_in_time" | "check_out_time" | "booking_status" | "location" | "contact" | "amenity" | "wifi_details";

export type Classification =
  | { kind: "escalate"; reason: EscalationReason; intent: FaqIntent | null }
  | { kind: "faq"; intent: FaqIntent; amenity?: string };

export interface FaqContext {
  facts: StayFacts;
  booking: NormalizedBooking | null; // only when the guest's booking was verified
}

export type FaqAnswer =
  | { kind: "answer"; intent: FaqIntent; text: string }
  | { kind: "escalate"; intent: FaqIntent | null; reason: EscalationReason };

// Lower case, letters/digits/spaces only ("Check-in?" -> "check in").
export function normalizeQuestion(text: string): string {
  return (text || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9ऀ-ॿ]+/g, " ").replace(/\s+/g, " ").trim();
}

const HUMAN = /\b(human|real person|a person|someone|somebody|agent|staff|team member|manager|owner|representative|call me|speak to|speak with|talk to|talk with)\b/;
const URGENT = /\b(emergency|urgent|not working|doesnt work|does not work|broken|leak|leaking|no water|no hot water|no power|power cut|no electricity|locked out|cant get in|unsafe|dirty|complain|complaint|smell|smells)\b/;
const CANCEL = /\bcancel/;
const PAYMENT = /\b(refund|refunds|payment|payments|pay|paid|invoice|receipt|bill|charge|charged|price|prices|cost|tariff|deposit|upi|card|gst)\b/;
const CHANGE = /\b(change|modify|extend|extension|reschedule|rescheduling|postpone|prepone|early check ?in|check ?in early|late check ?out|check ?out late|add (a |an |one )?(guest|person|bed)|extra (bed|guest|person|night)|upgrade|different room|another room|shift (my|the|our)|move (my|the|our))\b/;
const WIFI_DETAILS = /\b(wi ?fi|internet)\b.*\b(password|code|login|pass|name|network)\b|\b(password|code)\b.*\b(wi ?fi|internet)\b/;
const TIME_WORDS = /\b(time|timing|timings|when|what time|from|by|until|till|hour|hours)\b/;
const CHECK_IN = /\bcheck ?in\b/;
const CHECK_OUT = /\bcheck ?out\b/;
const BOOKING_STATUS = /\b(booking|reservation)\b.*\b(status|confirm|confirmed|valid|still on|active)\b|\b(is|are) (my|our) (booking|reservation)\b|\bbooking status\b/;
const LOCATION = /\b(location|address|directions?|how (do|can|should) (i|we) (get|reach|come)|how to (get|reach|come)|where (is|are) (the |your |it|you)|where exactly|nearest (airport|station|railway)|from the (airport|station))\b/;
const CONTACT = /\b(contact|phone number|your number|number to call|whatsapp number|email|e mail|call you)\b/;
const HAVE_QUESTION = /\b(is there|are there|do you have|does it have|do we have|have|has|any|available|provided|include|includes)\b/;

// Canonical amenity names exactly as config/booking.config.ts and properties.config.ts list them.
const AMENITIES: Array<[string, RegExp]> = [
  ["Air conditioning", /\b(ac|a c|air ?con|air ?conditioning|air ?conditioner)\b/],
  ["Internet access", /\b(wi ?fi|internet)\b/],
  ["TV", /\b(tv|television)\b/],
  ["Kitchenette", /\b(kitchen|kitchenette|cooking)\b/],
  ["Microwave", /\bmicrowave\b/],
  ["Refrigerator", /\b(fridge|refrigerator)\b/],
  ["Hairdryer", /\bhair ?dryer\b/],
  ["Oven", /\boven\b/],
  ["Toaster", /\btoaster\b/],
  ["Desk", /\b(desk|work ?desk|workspace|work space)\b/],
  ["Ceiling fan", /\b(fan|ceiling fan)\b/],
];

export function classifyGuestMessage(text: string): Classification {
  const q = normalizeQuestion(text);
  if (!q) return { kind: "escalate", reason: "UNSUPPORTED_QUESTION", intent: null };
  if (HUMAN.test(q)) return { kind: "escalate", reason: "HUMAN_REQUESTED", intent: null };
  if (URGENT.test(q)) return { kind: "escalate", reason: "URGENT_ISSUE", intent: null };
  if (CANCEL.test(q)) return { kind: "escalate", reason: "CANCELLATION", intent: null };
  if (PAYMENT.test(q)) return { kind: "escalate", reason: "PAYMENT", intent: null };
  if (CHANGE.test(q)) return { kind: "escalate", reason: "BOOKING_CHANGE", intent: null };
  if (WIFI_DETAILS.test(q)) return { kind: "escalate", reason: "MISSING_INFORMATION", intent: "wifi_details" };
  if (CHECK_IN.test(q) && TIME_WORDS.test(q)) return { kind: "faq", intent: "check_in_time" };
  if (CHECK_OUT.test(q) && TIME_WORDS.test(q)) return { kind: "faq", intent: "check_out_time" };
  if (BOOKING_STATUS.test(q)) return { kind: "faq", intent: "booking_status" };
  if (LOCATION.test(q)) return { kind: "faq", intent: "location" };
  if (CONTACT.test(q)) return { kind: "faq", intent: "contact" };
  if (HAVE_QUESTION.test(q) || /\?\s*$/.test(text || "")) {
    for (let i = 0; i < AMENITIES.length; i++) {
      if (AMENITIES[i][1].test(q)) return { kind: "faq", intent: "amenity", amenity: AMENITIES[i][0] };
    }
  }
  return { kind: "escalate", reason: "UNSUPPORTED_QUESTION", intent: null };
}

// True when answering needs the guest's booking (to know which property it is).
export function intentNeedsBooking(c: Classification): boolean {
  return c.kind === "faq" && c.intent !== "contact";
}

function missing(intent: FaqIntent): FaqAnswer {
  return { kind: "escalate", intent: intent, reason: "MISSING_INFORMATION" };
}

export function answerFaq(c: Classification, ctx: FaqContext): FaqAnswer {
  if (c.kind === "escalate") return { kind: "escalate", intent: c.intent, reason: c.reason };
  const f = ctx.facts;
  const place = f.propertyName || "your stay";

  switch (c.intent) {
    case "contact":
      return { kind: "answer", intent: c.intent, text: "You can reach us on " + GUEST_CONTACT.phoneDisplay + " or " + GUEST_CONTACT.email + "." };
    case "check_in_time":
      return f.checkInTime ? { kind: "answer", intent: c.intent, text: "Check-in at " + place + " is from " + f.checkInTime + "." } : missing(c.intent);
    case "check_out_time":
      return f.checkOutTime ? { kind: "answer", intent: c.intent, text: "Checkout at " + place + " is by " + f.checkOutTime + "." } : missing(c.intent);
    case "location": {
      const loc = f.location;
      if (!loc || !f.propertyName) return missing(c.intent);
      // The summary is added in brackets unless the area already says it (e.g. "..., Jagatpura, Jaipur").
      const repeats = loc.area.toLowerCase().indexOf(loc.summary.toLowerCase()) !== -1;
      const parts = [f.propertyName + " is in " + loc.area + (repeats ? "." : " (" + loc.summary + ").")];
      if (loc.gettingThere.length) parts.push("Getting there: " + loc.gettingThere.slice(0, 2).join("; ") + ".");
      if (loc.mapsNote) parts.push(loc.mapsNote);
      return { kind: "answer", intent: c.intent, text: parts.join(" ") };
    }
    case "booking_status": {
      const b = ctx.booking;
      // Only active bookings get an automatic answer; anything else (cancelled, unknown) goes to the team.
      // Same fail-safe status resolution as the message triggers: an unknown or contradictory status is escalated.
      const sid = b ? resolvedStatusId(b) : null;
      if (!b || !b.statusName || BLOCKED_STATUS_NAME_PATTERN.test(b.statusName) || sid === null || CANCELLED_STATUS_IDS.indexOf(sid) !== -1 || (sid !== 1 && sid !== 2)) return missing(c.intent);
      return {
        kind: "answer", intent: c.intent,
        text: "Your booking" + (b.bookingCode ? " " + b.bookingCode : "") + " for " + formatDay(b.checkInDate) + " to " + formatDay(b.checkOutDate) +
          " shows as \"" + b.statusName + "\" in our system.",
      };
    }
    case "amenity": {
      const name = c.amenity || "";
      if (name && f.propertyName && f.amenities.indexOf(name) !== -1) {
        const label = /^[A-Z]{2,}$/.test(name) ? name : name.toLowerCase(); // "TV" stays "TV"
        return { kind: "answer", intent: c.intent, text: "Yes, " + f.propertyName + " lists " + label + " among its amenities." };
      }
      return missing(c.intent); // not listed is not the same as "no": the team answers
    }
    default:
      return missing(c.intent);
  }
}

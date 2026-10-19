// Week 7: Guest Messages settings. Every timing and status rule lives here, so nothing is scattered through code.
// Change these values to change behaviour; the trigger and template code reads them.

export const GUEST_MESSAGE_TYPES = ["PRE_ARRIVAL", "CHECK_IN", "CHECKOUT"] as const;
export type GuestMessageType = (typeof GUEST_MESSAGE_TYPES)[number];

export interface MessageTiming {
  // Which booking date the message is anchored to.
  anchor: "checkIn" | "checkOut";
  // Days from the anchor date (India time) to the message's scheduled date. -2 = two days before.
  offsetDays: number;
  // Extra days after the scheduled date during which a missed run still creates the message (then it lapses).
  graceDays: number;
}

export const guestMessageTiming: Record<GuestMessageType, MessageTiming> = {
  // Two days before check-in; still created the next day if a run was missed (never on or after check-in day).
  PRE_ARRIVAL: { anchor: "checkIn", offsetDays: -2, graceDays: 1 },
  // On the check-in date (never after checkout).
  CHECK_IN: { anchor: "checkIn", offsetDays: 0, graceDays: 0 },
  // On the checkout date (never after it).
  CHECKOUT: { anchor: "checkOut", offsetDays: 0, graceDays: 0 },
};

// Messages whose scheduled date is up to this many days ahead are added to the team queue early as QUEUED, so the
// team sees what is coming; they become READY on the day. 0 = only create messages on their day.
export const GUEST_MESSAGE_LOOKAHEAD_DAYS = 1;

// ---------- Booking status rules ----------
// UNCONFIRMED ASSUMPTION (to confirm with the Intellistay owner/vendor): bookingStatusId follows the vendor docs
//   1 Reserved, 2 CheckedIn, 3 CheckedOut, 4 NoShow, 5 Cancelled, 6 Void
// Verified on the TEST server so far: only the status NAME "Reserved" (real booking RIAA004, processed as active).
// No numeric ID has been confirmed. (The Hospitality OS reference code's "5 = Cancelled from live data" comment is
// not our verification.)
// Fail-safe rules (lib/guest-messages/triggers.ts, resolvedStatusId/statusSkipReason):
//   - a name that looks cancelled/void/no-show/lost, or an ID in CANCELLED_STATUS_IDS, always blocks the message;
//   - when both are present, the name must be a recognised name below for the SAME ID, otherwise status_unknown;
//   - any unknown, missing or contradictory status is SKIPPED (status_unknown) and never queued as QUEUED/READY.
export const ELIGIBLE_STATUS_IDS: Record<GuestMessageType, number[]> = {
  PRE_ARRIVAL: [1], // Reserved
  CHECK_IN: [1, 2], // Reserved or already checked in
  CHECKOUT: [1, 2], // Reserved (check-in not yet recorded in the PMS) or checked in
};

// IDs that always mean "do not message": NoShow, Cancelled, Void.
export const CANCELLED_STATUS_IDS = [4, 5, 6];

export const BLOCKED_STATUS_NAME_PATTERN = /cancel|void|no[\s_-]?show|lost|invalid|reject|declin|fail|refund/i;

// Recognised status names (case-insensitive, exact) and the ID each stands for. Used when the ID is missing, and to
// check that a present ID and name agree. Only "reserved" has been seen on the TEST server; the rest follow the docs.
export const STATUS_NAME_TO_ID: Record<string, number> = {
  reserved: 1, confirmed: 1, booked: 1,
  checkedin: 2, "checked in": 2, "checked-in": 2, inhouse: 2, "in house": 2,
  checkedout: 3, "checked out": 3, "checked-out": 3,
};

// ---------- Intellistay room -> website property ----------
// Links an Intellistay room to a property on this website, so messages can use the property's published name and
// its verified facts (check-in/out times, area) from config/properties.config.ts, which stays the canonical property
// list. Only the Intellistay identifiers needed for matching are stored here: no amenities (the Intellistay
// response has no amenity fields) and nothing else about the property.
//
// SOURCE: read-only inspection of the Intellistay TEST (sandbox) API, confirmed Oct 2026. Never guess an entry.
// A booking room matches an entry only if the booking's branchId AND the room's roomId match, and the room's
// roomTypeId and roomNo also match whenever the PMS sends them. Anything else stays unmapped (generic wording).

export const INTELLISTAY_BRANCH = { branchId: 1, branchName: "Ritumbhara" } as const;

export interface IntellistayRoomMapping {
  propertySlug: string; // slug in config/properties.config.ts
  intellistayName: string; // the room's name in Intellistay (for people reading this file)
  branchId: number;
  roomTypeId: number;
  roomId: number;
  roomNo: string;
}

export const INTELLISTAY_ROOM_MAPPINGS: IntellistayRoomMapping[] = [
  { propertySlug: "studio-925", intellistayName: "Studio 925 Urban Jagatpura", branchId: 1, roomTypeId: 2, roomId: 5, roomNo: "Studio 925" },
  { propertySlug: "studio-909", intellistayName: "Studio 909 Ashadeep Jagatpura", branchId: 1, roomTypeId: 1, roomId: 1, roomNo: "Studio 909" },
  { propertySlug: "villa-65-sariska", intellistayName: "Villa 65 MS Valley Sariska", branchId: 1, roomTypeId: 11, roomId: 11, roomNo: "Villa 65" },
];

// ---------- Guest-facing contact ----------
// The published Ritumbhara contact details (footer, contact page and structured data use the same values).
export const GUEST_CONTACT = {
  phoneDisplay: "+91 95030 02629",
  email: "studios.jaipur@gmail.com",
};

// ---------- Escalation ----------
// The reply a guest gets when their question is passed to the team.
export const ESCALATION_ACK_STORED =
  "Thanks for your message. I've passed it to our team, and someone will get back to you here shortly.";
// Used when the escalation could not be recorded, so the guest is never told someone will reply when nobody knows.
export const ESCALATION_ACK_NOT_STORED =
  "Sorry, I couldn't pass this to our team just now. Please call us on " + GUEST_CONTACT.phoneDisplay + " and we'll help you directly.";

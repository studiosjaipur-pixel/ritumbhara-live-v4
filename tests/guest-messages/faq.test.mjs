// Week 7 Stretch 1: FAQ replies (lib/guest-messages/faq.ts). Pure functions: no network.
// Known question -> answer (only from configured facts); unknown -> escalation; explicit human request, changes,
// cancellations, payments and urgent problems -> escalation; supported but unconfigured -> escalation, never a guess.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOM_909, ROOM_925, normalized } from "../helpers/intellistay-fixtures.mjs";

const { classifyGuestMessage, answerFaq } = await import("../../lib/guest-messages/faq.ts");
const { stayFacts } = await import("../../lib/guest-messages/facts.ts");

const booking = normalized({ branchId: 1, rooms: [ROOM_925] }); // confirmed mapping: Studio 925
const MAPPED = { facts: stayFacts(booking), booking };
const UNMAPPED = { facts: stayFacts(null), booking: null };
const ask = (q, ctx = MAPPED) => answerFaq(classifyGuestMessage(q), ctx);

test("known questions are answered from configured facts", () => {
  assert.deepEqual(ask("What time is check-in?"), { kind: "answer", intent: "check_in_time", text: "Check-in at Studio 925 is from 13:00 – 23:00." });
  assert.deepEqual(ask("by when do we need to checkout"), { kind: "answer", intent: "check_out_time", text: "Checkout at Studio 925 is by 10:00." });
  assert.equal(ask("How can I contact you?", UNMAPPED).text, "You can reach us on +91 95030 02629 or studios.jaipur@gmail.com.");
  const loc = ask("How do I get there from the airport?");
  assert.equal(loc.kind, "answer");
  assert.equal(loc.text, "Studio 925 is in Urban Suites by BluSalzz Jaipur, Mahal Road, Jagatpura, Jaipur.", "owner-confirmed location, nothing added");
  // Studio 909 keeps the Karolan Ka Barh answer, with its getting-there lines and map note.
  const b909loc = normalized({ branchId: 1, rooms: [ROOM_909] });
  const loc909 = ask("How do I get there from the airport?", { facts: stayFacts(b909loc), booking: b909loc });
  assert.match(loc909.text, /^Studio 909 is in Karolan Ka Barh, Jeerota village, Jaipur \(About 19 km from central Jaipur\)\. Getting there: /);
  assert.match(loc909.text, /not the exact building/);
  assert.deepEqual(ask("Is there a microwave?"), { kind: "answer", intent: "amenity", text: "Yes, Studio 925 lists microwave among its amenities." });
  assert.equal(ask("do you have a TV").text, "Yes, Studio 925 lists TV among its amenities.");
  assert.equal(ask("Is there wifi?").text, "Yes, Studio 925 lists internet access among its amenities.");
  assert.match(ask("Is my booking confirmed?").text, /^Your booking BK101 for 20 Oct 2026 to 22 Oct 2026 shows as "Reserved" in our system\.$/);
});

test("unknown questions escalate (UNSUPPORTED_QUESTION), never a guess", () => {
  for (const q of ["Can you recommend a restaurant?", "Is breakfast included", "Are pets allowed?", "", "   ", "hello"]) {
    const a = ask(q);
    assert.equal(a.kind, "escalate", q);
    assert.equal(a.reason, "UNSUPPORTED_QUESTION", q);
  }
});

test("explicit human request escalates first, even when it contains an FAQ topic", () => {
  for (const q of ["Can I talk to a person?", "I want to speak to someone about check-in time", "please call me", "Connect me to the manager"]) {
    assert.deepEqual(ask(q), { kind: "escalate", intent: null, reason: "HUMAN_REQUESTED" }, q);
  }
});

test("changes, cancellations, payments and urgent problems go to the team; nothing is changed", () => {
  const cases = {
    "I want to cancel my booking": "CANCELLATION",
    "Can I get a refund?": "PAYMENT",
    "How do I pay the balance": "PAYMENT",
    "What is the price per night": "PAYMENT",
    "Can I check in early?": "BOOKING_CHANGE",
    "Is late checkout possible": "BOOKING_CHANGE",
    "I need to extend my stay by a night": "BOOKING_CHANGE",
    "Can we add a guest": "BOOKING_CHANGE",
    "The AC is not working": "URGENT_ISSUE",
    "There's a leak in the bathroom, urgent": "URGENT_ISSUE",
  };
  for (const [q, reason] of Object.entries(cases)) assert.equal(ask(q).reason, reason, q);
});

test("supported topic but the fact is not configured for this stay -> MISSING_INFORMATION", () => {
  for (const q of ["What time is check-in?", "checkout time?", "Where is the property located?", "Is there a fridge?", "Is my booking confirmed?"]) {
    const a = ask(q, UNMAPPED);
    assert.equal(a.kind, "escalate", q);
    assert.equal(a.reason, "MISSING_INFORMATION", q);
  }
  // Not listed is not "no": an amenity missing from the list goes to the team.
  assert.equal(ask("Is there parking?").reason, "UNSUPPORTED_QUESTION");
  assert.equal(ask("Do you have a washing machine?").kind, "escalate");
  assert.equal(ask("Is there a fridge?").reason, "MISSING_INFORMATION", "Studio 925's list has no refrigerator");
  // Wi-Fi details are never invented.
  assert.deepEqual(ask("What's the wifi password?"), { kind: "escalate", intent: "wifi_details", reason: "MISSING_INFORMATION" });
  // A mapped property off the booking engine has no check-in time.
  const b909 = normalized({ branchId: 1, rooms: [ROOM_909] });
  assert.equal(ask("What time is check-in?", { facts: stayFacts(b909), booking: b909 }).reason, "MISSING_INFORMATION");
});

test("booking status is only answered for an active, verified booking", () => {
  assert.equal(ask("booking status?", { facts: MAPPED.facts, booking: normalized({ statusId: 5, statusName: "Cancelled" }) }).kind, "escalate");
  assert.equal(ask("booking status?", { facts: MAPPED.facts, booking: normalized({ statusId: 3, statusName: "CheckedOut" }) }).kind, "escalate");
  assert.equal(ask("booking status?", { facts: MAPPED.facts, booking: normalized({ statusId: 2, statusName: "CheckedIn" }) }).kind, "answer");
});

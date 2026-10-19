// Week 7: trigger logic (lib/guest-messages/triggers.ts) and templates (templates.ts, facts.ts). Pure functions:
// no network. Fixed booking: check-in 2026-10-20, checkout 2026-10-22 (2 nights), Reserved.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { GUEST_E164, ROOM_909, ROOM_925, SPECIAL_REQUEST_TEXT, normalized } from "../helpers/intellistay-fixtures.mjs";

const { planMessages, messageIdFor, statusSkipReason, messageWindow, istToday, addDays } = await import("../../lib/guest-messages/triggers.ts");
const { renderGuestMessage, guestsText, formatDay } = await import("../../lib/guest-messages/templates.ts");
const { stayFacts } = await import("../../lib/guest-messages/facts.ts");
const { buildQueueItem } = await import("../../lib/guest-messages/queue.ts");

const plan = (bookings, today, opts = {}) => planMessages(bookings, Object.assign({ today }, opts));
const brief = (items) => items.map((i) => i.type + ":" + i.status + (i.reason ? ":" + i.reason : ""));

// ---------- triggers ----------

test("future booking: nothing early, QUEUED the day before, READY two days before check-in", () => {
  const b = normalized();
  assert.deepEqual(plan([b], "2026-10-10"), []);
  assert.deepEqual(brief(plan([b], "2026-10-17")), ["PRE_ARRIVAL:QUEUED"], "lookahead 1 day");
  assert.deepEqual(brief(plan([b], "2026-10-17", { lookaheadDays: 0 })), []);
  const due = plan([b], "2026-10-18");
  assert.deepEqual(brief(due), ["PRE_ARRIVAL:READY"]);
  assert.equal(due[0].scheduledDate, "2026-10-18");
  assert.equal(due[0].messageId, messageIdFor("101", "PRE_ARRIVAL", "2026-10-18"));
  assert.match(due[0].messageId, /^GM-[0-9A-F]{12}$/);
  assert.deepEqual(brief(plan([b], "2026-10-19")), ["PRE_ARRIVAL:READY", "CHECK_IN:QUEUED"], "pre-arrival grace day + tomorrow's check-in");
  assert.equal(plan([b], "2026-10-19")[0].messageId, due[0].messageId, "same scheduled event, same ID");
});

test("check-in event on the check-in date, checkout event on the checkout date", () => {
  const b = normalized();
  assert.deepEqual(brief(plan([b], "2026-10-20")), ["CHECK_IN:READY"], "pre-arrival never on check-in day");
  assert.deepEqual(brief(plan([b], "2026-10-21")), ["CHECKOUT:QUEUED"]);
  assert.deepEqual(brief(plan([b], "2026-10-22")), ["CHECKOUT:READY"]);
  const oneNight = normalized({ checkInDate: "2026-10-20", checkOutDate: "2026-10-21", nights: 1 });
  assert.deepEqual(brief(plan([oneNight], "2026-10-20")), ["CHECK_IN:READY", "CHECKOUT:QUEUED"]);
  const dayUse = normalized({ checkInDate: "2026-10-20", checkOutDate: "2026-10-20", nights: 0 });
  assert.deepEqual(brief(plan([dayUse], "2026-10-20")), ["CHECK_IN:READY", "CHECKOUT:READY"]);
});

test("cancelled / no-show / void / unknown status -> SKIPPED (never READY); not queued ahead of time", () => {
  for (const over of [{ statusId: 5, statusName: "Cancelled" }, { statusId: 4, statusName: "NoShow" }, { statusId: 6, statusName: "Void" },
    { statusId: 1, statusName: "Cancelled by guest" }, { statusId: null, statusName: "Lost" }]) {
    const items = plan([normalized(over)], "2026-10-18");
    assert.deepEqual(brief(items), ["PRE_ARRIVAL:SKIPPED:status_cancelled"], JSON.stringify(over));
  }
  assert.deepEqual(brief(plan([normalized({ statusId: 99, statusName: "Weird" })], "2026-10-18")), ["PRE_ARRIVAL:SKIPPED:status_unknown"]);
  assert.deepEqual(brief(plan([normalized({ statusId: 99, statusName: null })], "2026-10-18")), ["PRE_ARRIVAL:SKIPPED:status_not_eligible"]);
  assert.deepEqual(brief(plan([normalized({ statusId: null, statusName: null })], "2026-10-18")), ["PRE_ARRIVAL:SKIPPED:status_unknown"]);
  assert.deepEqual(brief(plan([normalized({ statusId: null, statusName: "Reserved" })], "2026-10-18")), ["PRE_ARRIVAL:READY"], "name fallback");
  assert.deepEqual(plan([normalized({ statusId: 5, statusName: "Cancelled" })], "2026-10-17"), [], "a cancelled booking is not queued ahead");
  // Checked-in guests get the checkout message; a pre-arrival is only for Reserved.
  assert.equal(statusSkipReason(normalized({ statusId: 2, statusName: "CheckedIn" }), "CHECKOUT"), null);
  assert.equal(statusSkipReason(normalized({ statusId: 2, statusName: "CheckedIn" }), "PRE_ARRIVAL"), "status_not_eligible");
  assert.equal(statusSkipReason(normalized({ statusId: 3, statusName: "CheckedOut" }), "CHECKOUT"), "status_not_eligible");
});

test("duplicate runs: the same day gives exactly the same plan and IDs (idempotent)", () => {
  const bookings = [normalized(), normalized({ bookingId: "102", checkInDate: "2026-10-18", checkOutDate: "2026-10-19", nights: 1 })];
  const a = plan(bookings, "2026-10-18");
  const b = plan(bookings, "2026-10-18");
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((x) => x.messageId)).size, a.length, "IDs are unique within a run");
  // A changed check-in date is a different scheduled event -> a different ID.
  const moved = plan([normalized({ checkInDate: "2026-10-21", checkOutDate: "2026-10-23" })], "2026-10-19");
  assert.notEqual(moved[0].messageId, a.filter((x) => x.bookingId === "101")[0].messageId);
});

test("past bookings and missed windows are left alone (no late messages)", () => {
  const b = normalized();
  assert.deepEqual(plan([b], "2026-10-23"), [], "after checkout");
  assert.deepEqual(plan([b], "2027-01-01"), []);
  const lateBooking = normalized({ checkInDate: "2026-10-18", checkOutDate: "2026-10-25", nights: 7 });
  assert.deepEqual(brief(plan([lateBooking], "2026-10-21")), [], "mid-stay: no pre-arrival or check-in sent late");
  assert.equal(messageWindow(normalized({ checkInDate: "2026-10-20" }), "PRE_ARRIVAL").last, "2026-10-19");
});

test("Send By: every message carries the last day it may be sent (end of its window)", () => {
  const b = normalized(); // check-in 20 Oct, checkout 22 Oct
  const at = (day) => Object.fromEntries(plan([b], day).map((p) => [p.type + ":" + p.status, p.scheduledDate + ".." + p.sendBy]));
  assert.deepEqual(at("2026-10-17"), { "PRE_ARRIVAL:QUEUED": "2026-10-18..2026-10-19" });
  assert.deepEqual(at("2026-10-19"), { "PRE_ARRIVAL:READY": "2026-10-18..2026-10-19", "CHECK_IN:QUEUED": "2026-10-20..2026-10-20" });
  assert.deepEqual(at("2026-10-22"), { "CHECKOUT:READY": "2026-10-22..2026-10-22" });
  for (const day of ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"]) {
    for (const p of plan([b], day)) {
      assert.ok(p.sendBy >= p.scheduledDate, "sendBy never before scheduled");
      if (p.status !== "QUEUED") assert.ok(day <= p.sendBy, "a READY/SKIPPED/FAILED message is never planned after its Send By");
    }
  }
});

test("PRE_ARRIVAL keeps its one-day grace period (config unchanged)", async () => {
  const { guestMessageTiming } = await import("../../config/guestMessages.config.ts");
  assert.deepEqual(guestMessageTiming.PRE_ARRIVAL, { anchor: "checkIn", offsetDays: -2, graceDays: 1 });
  assert.deepEqual(guestMessageTiming.CHECK_IN, { anchor: "checkIn", offsetDays: 0, graceDays: 0 });
  assert.deepEqual(guestMessageTiming.CHECKOUT, { anchor: "checkOut", offsetDays: 0, graceDays: 0 });
});

test("real test booking #4 (check-in 17 Oct, checkout 18 Oct): the 16 Oct pre-arrival is the one grace day, then it lapses", () => {
  const b4 = normalized({ bookingId: "4", checkInDate: "2026-10-17", checkOutDate: "2026-10-18", nights: 1 });
  const on16 = plan([b4], "2026-10-16");
  assert.deepEqual(on16.map((p) => p.type + ":" + p.status + ":" + p.scheduledDate + ":" + p.sendBy),
    ["PRE_ARRIVAL:READY:2026-10-15:2026-10-16", "CHECK_IN:QUEUED:2026-10-17:2026-10-17"]);
  assert.ok(!plan([b4], "2026-10-17").some((p) => p.type === "PRE_ARRIVAL"), "never on or after check-in day");
});

test("no usable guest phone -> FAILED with a reason (shown to the team, not hidden)", () => {
  const items = plan([normalized({ guest: { firstName: "Asha", phone: null } })], "2026-10-18");
  assert.deepEqual(brief(items), ["PRE_ARRIVAL:FAILED:no_guest_phone"]);
});

test("dates: India 'today' and day arithmetic", () => {
  assert.equal(istToday(new Date("2026-10-17T18:29:00Z")), "2026-10-17");
  assert.equal(istToday(new Date("2026-10-17T18:31:00Z")), "2026-10-18");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

// ---------- templates ----------

test("pre-arrival: correct variables, generic wording when the room is not mapped (no invented facts)", () => {
  const text = renderGuestMessage({ type: "PRE_ARRIVAL", booking: normalized() });
  assert.equal(text, [
    "Hi Asha,",
    "This is Ritumbhara. We're looking forward to hosting you from 20 Oct 2026 to 22 Oct 2026 (2 nights).",
    "If you need anything, just reply here or call us on +91 95030 02629.",
    "Booking ref: BK101",
  ].join("\n\n"));
  for (const word of ["Check-in is", "Wi-Fi", "wifi", "parking", "13:00", "10:00", "policy"]) assert.ok(!text.includes(word), word);
});

test("check-in and checkout templates", () => {
  const b = normalized();
  assert.equal(renderGuestMessage({ type: "CHECK_IN", booking: b }), [
    "Hi Asha,",
    "Welcome to your stay with Ritumbhara! We hope the journey went well.",
    "If anything isn't right or you need help during your stay, reply here or call us on +91 95030 02629.",
    "Booking ref: BK101",
  ].join("\n\n"));
  assert.equal(renderGuestMessage({ type: "CHECKOUT", booking: b }), [
    "Hi Asha,",
    "Thank you for staying with us. Your checkout date is 22 Oct 2026.",
    "If you need anything, just reply here or call us on +91 95030 02629.",
    "We'd love to host you again.",
    "Booking ref: BK101",
  ].join("\n\n"));
});

test("mapped property: uses its published name and configured facts only", () => {
  const b = normalized({ branchId: 1, rooms: [ROOM_925] }); // confirmed mapping -> Studio 925 (engine-listed, Jaipur)
  const facts = stayFacts(b);
  assert.equal(facts.propertyName, "Studio 925");
  assert.equal(facts.checkInTime, "13:00 – 23:00");
  assert.equal(facts.checkOutTime, "10:00");
  assert.equal(facts.location.area, "Urban Suites by BluSalzz Jaipur, Mahal Road, Jagatpura, Jaipur");
  const pre = renderGuestMessage({ type: "PRE_ARRIVAL", booking: b, facts });
  assert.match(pre, /hosting you at Studio 925 from 20 Oct 2026/);
  assert.match(pre, /Check-in is from 13:00 – 23:00\./);
  assert.match(pre, /You'll be staying in Urban Suites by BluSalzz Jaipur, Mahal Road, Jagatpura, Jaipur\./);
  assert.ok(!/Karolan|Jeerota/.test(pre), "the old location is gone from Studio 925 messages");
  assert.match(renderGuestMessage({ type: "CHECKOUT", booking: b, facts }), /checkout is by 10:00\./);
  // Studio 909 is mapped but NOT on the booking engine: its name is used, but no times.
  const b909 = normalized({ branchId: 1, rooms: [ROOM_909] });
  const notEngine = stayFacts(b909);
  assert.equal(notEngine.propertyName, "Studio 909");
  assert.equal(notEngine.checkInTime, null);
  assert.ok(!renderGuestMessage({ type: "PRE_ARRIVAL", booking: b909, facts: notEngine }).includes("Check-in is"));
  // A property whose placement is unverified (Alwar) gets no area; an unknown slug maps to nothing (test-only entries).
  const testMap = (slug) => [{ propertySlug: slug, intellistayName: "test", branchId: 1, roomTypeId: 2, roomId: 5, roomNo: "Studio 925" }];
  assert.equal(stayFacts(b, testMap("studio-603-alwar")).location, null);
  assert.equal(stayFacts(b, testMap("no-such-slug")).property, null);
});

test("missing name, missing booking code, special request (never echoed), unusual guest counts", () => {
  const anon = renderGuestMessage({ type: "CHECK_IN", booking: normalized({ guest: { firstName: null, phone: GUEST_E164 }, bookingCode: null }) });
  assert.ok(anon.startsWith("Hi there,"));
  assert.ok(!anon.includes("Booking ref"));
  const noReq = renderGuestMessage({ type: "PRE_ARRIVAL", booking: normalized({ specialRequest: null }) });
  assert.ok(!noReq.includes("special request"));
  const withReq = renderGuestMessage({ type: "PRE_ARRIVAL", booking: normalized({ specialRequest: SPECIAL_REQUEST_TEXT }) });
  assert.match(withReq, /We have your special request on file/);
  assert.ok(!withReq.includes(SPECIAL_REQUEST_TEXT), "the request text is never repeated back");
  assert.equal(guestsText(2, 0), "2 adults");
  assert.equal(guestsText(1, 1), "1 adult, 1 child");
  assert.equal(guestsText(0, 3), "3 children");
  assert.equal(guestsText(null, null), null);
  assert.equal(guestsText(0, 0), null);
  assert.match(renderGuestMessage({ type: "PRE_ARRIVAL", booking: normalized({ nights: 1, checkOutDate: "2026-10-21" }) }), /\(1 night\)/);
  assert.equal(formatDay("2027-01-05"), "5 Jan 2027");
});

test("queue item: what the team needs, nothing financial", () => {
  const [p] = plan([normalized({ specialRequest: SPECIAL_REQUEST_TEXT })], "2026-10-18");
  const item = buildQueueItem(p, normalized({ specialRequest: SPECIAL_REQUEST_TEXT }), new Date("2026-10-18T03:30:00Z"));
  assert.deepEqual(Object.keys(item).sort(), ["bookingCode", "bookingId", "bookingSource", "checkIn", "checkOut", "createdAt", "guestName", "guestPhone",
    "guests", "message", "messageId", "nights", "property", "reason", "scheduledDate", "sendBy", "specialRequest", "status", "type"]);
  assert.equal(item.property, "Studio, room 925", "unmapped: the PMS room label, for the team");
  assert.equal(item.specialRequest, "yes");
  assert.equal(item.guestPhone, GUEST_E164);
  assert.ok(!JSON.stringify(item).includes(SPECIAL_REQUEST_TEXT));
});

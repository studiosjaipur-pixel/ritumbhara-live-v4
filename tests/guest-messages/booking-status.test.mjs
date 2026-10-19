// Week 7: Intellistay booking-status handling (lib/guest-messages/triggers.ts resolvedStatusId/statusSkipReason,
// the FAQ booking-status answer, and the run endpoint). No network.
//
// VERIFIED on the Intellistay TEST server: only the status NAME "Reserved" (real booking RIAA004, processed as an
// active booking). No numeric bookingStatusId has been confirmed; the 1..6 IDs remain an unconfirmed vendor-doc
// assumption (config/guestMessages.config.ts). These tests therefore prove fail-safe behaviour: anything unknown,
// missing or contradictory is SKIPPED and never queued (no QUEUED/READY row, so the team is never asked to send it).
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, LOGIN_OK, bookingsResponse, intellistayFetch, normalized, rawBooking } from "../helpers/intellistay-fixtures.mjs";

const { planMessages, resolvedStatusId, statusSkipReason, addDays } = await import("../../lib/guest-messages/triggers.ts");
const { classifyGuestMessage, answerFaq } = await import("../../lib/guest-messages/faq.ts");
const { stayFacts } = await import("../../lib/guest-messages/facts.ts");
const { createGuestMessagesRunHandler } = await import("../../lib/guest-messages/run.ts");
const { createIntellistayClient } = await import("../../lib/intellistay/client.ts");
const { getGuestMessagesApiConfig } = await import("../../lib/guest-messages/http.ts");

// Every day on which any message for this booking (check-in 20 Oct, checkout 22 Oct) could be created or queued.
const DAYS = Array.from({ length: 9 }, (_, i) => addDays("2026-10-16", i));
const allPlans = (b) => DAYS.flatMap((d) => planMessages([b], { today: d }));
const sendable = (items) => items.filter((p) => p.status === "QUEUED" || p.status === "READY");

test("verified sandbox status: 'Reserved' (as on RIAA004) is processed as an active booking", () => {
  const withId = normalized({ bookingCode: "RIAA004", statusId: 1, statusName: "Reserved" });
  const nameOnly = normalized({ bookingCode: "RIAA004", statusId: null, statusName: "Reserved" });
  for (const b of [withId, nameOnly]) {
    assert.equal(resolvedStatusId(b), 1);
    assert.deepEqual(planMessages([b], { today: "2026-10-18" }).map((p) => p.type + ":" + p.status), ["PRE_ARRIVAL:READY"]);
  }
  assert.equal(resolvedStatusId(normalized({ statusId: null, statusName: "  RESERVED " })), 1, "case/space-insensitive");
});

test("unknown status IDs never produce a QUEUED or READY message, on any day, for any message type", () => {
  for (const id of [0, 7, 8, 42, 99, 999]) {
    for (const name of [null, "Reserved", "Unknown", ""]) {
      const b = normalized({ statusId: id, statusName: name });
      const items = allPlans(b);
      assert.deepEqual(sendable(items), [], "id " + id + " name " + JSON.stringify(name));
      items.forEach((p) => assert.equal(p.status, "SKIPPED"));
    }
  }
});

test("missing, unrecognised or contradictory statuses are status_unknown and never queued", () => {
  const cases = [
    [{ statusId: null, statusName: null }, "no status at all"],
    [{ statusId: null, statusName: "Tentative" }, "unrecognised name, no id"],
    [{ statusId: 1, statusName: "Tentative" }, "eligible id with an unrecognised name"],
    [{ statusId: 1, statusName: "CheckedOut" }, "id 1 contradicts name CheckedOut"],
    [{ statusId: 2, statusName: "Reserved" }, "id 2 contradicts name Reserved"],
    [{ statusId: 3, statusName: "Reserved" }, "id 3 contradicts name Reserved"],
  ];
  for (const [over, label] of cases) {
    const b = normalized(over);
    assert.equal(resolvedStatusId(b), null, label);
    assert.equal(statusSkipReason(b, "PRE_ARRIVAL"), "status_unknown", label);
    assert.equal(statusSkipReason(b, "CHECK_IN"), "status_unknown", label);
    assert.equal(statusSkipReason(b, "CHECKOUT"), "status_unknown", label);
    assert.deepEqual(sendable(allPlans(b)), [], label);
  }
});

test("cancelled-looking names and cancelled/no-show/void IDs always block, whatever the other field says", () => {
  const blocked = [
    { statusId: 1, statusName: "Cancelled" }, { statusId: 1, statusName: "No Show" }, { statusId: 1, statusName: "void" },
    { statusId: 2, statusName: "Cancelled by guest" }, { statusId: null, statusName: "Lost" },
    { statusId: 4, statusName: null }, { statusId: 5, statusName: null }, { statusId: 6, statusName: null },
    { statusId: 5, statusName: "Reserved" }, // the id says cancelled: blocked even with an active-looking name
  ];
  for (const over of blocked) {
    const b = normalized(over);
    assert.equal(statusSkipReason(b, "PRE_ARRIVAL"), "status_cancelled", JSON.stringify(over));
    assert.deepEqual(sendable(allPlans(b)), [], JSON.stringify(over));
  }
});

test("consistent ID + name pairs keep the existing per-type rules (assumed IDs, unchanged behaviour)", () => {
  assert.equal(statusSkipReason(normalized({ statusId: 1, statusName: "Reserved" }), "PRE_ARRIVAL"), null);
  assert.equal(statusSkipReason(normalized({ statusId: 2, statusName: "CheckedIn" }), "CHECK_IN"), null);
  assert.equal(statusSkipReason(normalized({ statusId: 2, statusName: "Checked In" }), "CHECKOUT"), null);
  assert.equal(statusSkipReason(normalized({ statusId: 2, statusName: "CheckedIn" }), "PRE_ARRIVAL"), "status_not_eligible");
  assert.equal(statusSkipReason(normalized({ statusId: 3, statusName: "CheckedOut" }), "CHECKOUT"), "status_not_eligible");
  assert.equal(statusSkipReason(normalized({ statusId: 1, statusName: null }), "PRE_ARRIVAL"), null, "id only (name absent)");
});

test("FAQ booking status: answered only for a consistent active status; unknown or contradictory escalates", () => {
  const ask = (over) => {
    const b = normalized(over);
    return answerFaq(classifyGuestMessage("Is my booking confirmed?"), { facts: stayFacts(b), booking: b });
  };
  assert.equal(ask({ statusId: 1, statusName: "Reserved" }).kind, "answer");
  for (const over of [{ statusId: 1, statusName: "Tentative" }, { statusId: 1, statusName: "CheckedOut" }, { statusId: 99, statusName: "Reserved" },
    { statusId: null, statusName: null }, { statusId: 5, statusName: "Reserved" }, { statusId: 1, statusName: "Cancelled" }]) {
    const a = ask(over);
    assert.equal(a.kind, "escalate", JSON.stringify(over));
    assert.equal(a.reason, "MISSING_INFORMATION", JSON.stringify(over));
  }
});

test("run endpoint: an unknown-status booking reaches the team queue only as SKIPPED (never READY/QUEUED)", async () => {
  const stored = [];
  const handler = createGuestMessagesRunHandler({
    getApiConfig: () => getGuestMessagesApiConfig({ GUEST_MESSAGES_ENABLED: "true", GUEST_MESSAGES_API_SECRET: "status-test-secret-0123456789abcdef" }),
    getIntellistayConfig: () => ({ status: "ready", config: CONFIG }),
    createClient: (config) => createIntellistayClient({ config, log() {}, fetchImpl: intellistayFetch({
      login: LOGIN_OK,
      bookings: { status: 200, body: bookingsResponse([
        rawBooking({ bookingId: 201, bookingStatusId: 77, bookingStatus: "Mystery" }),
        rawBooking({ bookingId: 202, bookingStatusId: 1, bookingStatus: "CheckedOut" }),
        rawBooking({ bookingId: 203, bookingStatusId: null, bookingStatus: null }),
        rawBooking({ bookingId: 204, bookingStatusId: 1, bookingStatus: "Reserved" }),
      ]) },
    }) }),
    deliver: async (env) => { stored.push(env.message); return { ok: true, status: "stored" }; },
    sinkConfigured: () => true,
    now: () => new Date("2026-10-18T03:30:00Z"),
    nowMs: () => Date.parse("2026-10-18T03:30:00Z"),
    log() {},
  });
  const res = await handler(new Request("https://example.test/api/guest-messages/run", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer status-test-secret-0123456789abcdef" }, body: JSON.stringify({ mode: "queue" }),
  }));
  assert.equal(res.status, 200);
  const byBooking = Object.fromEntries(stored.map((m) => [m.bookingId, m.status + (m.reason ? ":" + m.reason : "")]));
  assert.deepEqual(byBooking, {
    "201": "SKIPPED:status_unknown",
    "202": "SKIPPED:status_unknown",
    "203": "SKIPPED:status_unknown",
    "204": "READY",
  });
});

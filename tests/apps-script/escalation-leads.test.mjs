// Guest Escalation -> Lead in apps-script/Code.gs (upsertEscalationLead_). A WhatsApp escalation for a VERIFIED booking
// (escalation.lead, sent by the website) also creates or updates the guest's Lead on the "Handoffs" tab, with the
// guest's name and booking code. Runs the real Code.gs with fake Google services (no network, no real Sheet or email).
// Proves: the escalation row and email are exactly as before; a Lead is created with the verified booking's values;
// a matching OPEN lead (same phone + booking) is updated instead of duplicated; closed leads and other bookings get a
// new Lead; retries never add rows or text; no/invalid Lead block -> no Lead; a Lead failure never loses the escalation;
// no guest name is ever invented; existing tabs only gain the two columns at the end.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEnv, post, postHandoff, rowObject, oldLayoutTab, OLD_HANDOFF_HEADERS, IST_NOW, IST_PLUS_1D } from "../helpers/apps-script-env.mjs";

const GM_SECRET = "fake-guest-sink-secret-for-tests";
const PROPS = { GUEST_MESSAGES_SINK_SECRET: GM_SECRET };
const PHONE = "+918712308682";
const QUESTION = "Hi, I have a booking for Villa 65 Sariska. Can I extend my stay by one night?";

function lead(overrides = {}) {
  return Object.assign({
    guestName: "Aani", property: "Villa 65 Sariska", destination: "sariska", checkIn: "2026-10-18", checkOut: "2026-10-20", nights: 2, guests: 4,
  }, overrides);
}
function escalation(overrides = {}) {
  return Object.assign({
    escalationId: "E-0DD420D0C2", reason: "BOOKING_CHANGE", question: QUESTION, guestPhone: PHONE, bookingCode: "RIAA005",
    intent: null, channel: "whatsapp", receivedAt: "2026-10-12T07:29:00.000Z", lead: lead(),
  }, overrides);
}
const postEsc = (env, e = escalation()) => post(env, { secret: GM_SECRET, type: "guest_escalation", escalation: e });
const tab = (env, name) => env.spreadsheet.getSheetByName(name);
const plain = (v) => JSON.parse(JSON.stringify(v));

test("verified WhatsApp escalation: escalation row and email as before, plus a new Lead on Handoffs", () => {
  const env = createEnv({ props: PROPS });
  assert.deepEqual(postEsc(env), { ok: true, stored: true, emailStatus: "SENT", lead: "created" });

  // Guest Escalations: same columns and values as before this change.
  const esc = tab(env, "Guest Escalations");
  assert.deepEqual(plain(esc.headers()), plain(env.gs.GUEST_ESCALATION_HEADERS));
  const e = rowObject(esc, 2);
  assert.equal(e["Escalation ID"], "E-0DD420D0C2");
  assert.equal(e["Status"], "Open");
  assert.equal(e["Booking Code"], "RIAA005");
  assert.equal(e["Question"], QUESTION);
  assert.equal(e["Email Status"], "SENT");
  assert.equal(env.mails.length, 1, "one email, as before");
  assert.equal(env.mails[0].subject, "Guest needs a team member");

  // The Lead: verified booking values only.
  const h = tab(env, "Handoffs");
  assert.deepEqual(plain(h.headers()), plain(env.gs.HANDOFF_HEADERS));
  assert.equal(h.getLastRow(), 2);
  const l = rowObject(h, 2);
  assert.equal(l["Handoff ID"], "H-0DD420D0C2", "tied to the escalation ID");
  assert.equal(l["Status"], "New");
  assert.equal(l["Reason"], "BOOKING_CHANGE");
  assert.equal(l["Phone"], "'" + PHONE, "formula-safe like every phone cell");
  assert.equal(l["Guest Name"], "Aani");
  assert.equal(l["Booking Code"], "RIAA005");
  assert.equal(l["Property"], "Villa 65 Sariska");
  assert.equal(l["Destination"], "sariska");
  assert.equal(l["Check-in"], "2026-10-18");
  assert.equal(l["Check-out"], "2026-10-20");
  assert.equal(l["Nights"], 2);
  assert.equal(l["Guests"], 4);
  assert.equal(l["Source"], "guest-escalation");
  assert.equal(l["Requirements"], "[" + IST_NOW + " E-0DD420D0C2] " + QUESTION);
  assert.equal(l["Received (IST)"], IST_NOW);
  assert.equal(l["Status Updated (IST)"], IST_NOW);
  assert.equal(l["Next Follow-up"], IST_PLUS_1D);
  assert.equal(l["Email Status"], "SENT", "the escalation email told the team");
  assert.equal(typeof l["Score"], "number");
  assert.ok(["Hot", "Warm", "Cold"].includes(l["Priority"]));
  assert.equal(l["Ref"], "");
  assert.ok(h.validations.has("2,3"), "Status dropdown like other leads");
  assert.equal(tab(env, "Qualified Leads"), null, "Qualified Leads (auto follow-ups) is never touched");
});

test("same phone + booking with an OPEN lead: that lead is updated, not duplicated; the team's status is kept", () => {
  const env = createEnv({ props: PROPS });
  postEsc(env);
  const h = tab(env, "Handoffs");
  h.setCell(2, 3, "Contacted");
  h.setCell(2, h.headers().indexOf("Guest Name") + 1, ""); // a blank field is filled, nothing else is overwritten
  const second = escalation({ escalationId: "E-1111111111", question: "Also, can we get a late checkout?", lead: lead({ property: "Something else" }) });
  assert.deepEqual(postEsc(env, second), { ok: true, stored: true, emailStatus: "SENT", lead: "updated" });
  assert.equal(h.getLastRow(), 2, "no second Lead");
  const l = rowObject(h, 2);
  assert.equal(l["Status"], "Contacted", "status untouched");
  assert.equal(l["Guest Name"], "Aani", "blank name filled from the verified booking");
  assert.equal(l["Property"], "Villa 65 Sariska", "existing value never overwritten");
  assert.match(l["Requirements"], /E-0DD420D0C2\] Hi, I have a booking/);
  assert.match(l["Requirements"], /\n\[2026-10-12 13:00:00 E-1111111111\] Also, can we get a late checkout\?$/);
  assert.equal(tab(env, "Guest Escalations").getLastRow(), 3, "both escalations stored as before");
  assert.equal(env.mails.length, 2, "each escalation still emails the team");
});

test("a closed lead (Booked/Lost) or a different booking gets a new Lead", () => {
  const env = createEnv({ props: PROPS });
  postEsc(env);
  const h = tab(env, "Handoffs");
  h.setCell(2, 3, "Booked");
  assert.equal(postEsc(env, escalation({ escalationId: "E-2222222222" })).lead, "created");
  assert.equal(postEsc(env, escalation({ escalationId: "E-3333333333", bookingCode: "RIAA999" })).lead, "created");
  assert.equal(h.getLastRow(), 4);
  assert.deepEqual([2, 3, 4].map((r) => rowObject(h, r)["Handoff ID"]), ["H-0DD420D0C2", "H-2222222222", "H-3333333333"]);
  // The next message for RIAA005 goes to the OPEN one (H-2222222222), not the Booked one.
  assert.equal(postEsc(env, escalation({ escalationId: "E-4444444444" })).lead, "updated");
  assert.match(rowObject(h, 3)["Requirements"], /E-4444444444/);
  assert.doesNotMatch(rowObject(h, 2)["Requirements"], /E-4444444444/);
});

test("retries never add rows, text or emails (created and updated Leads)", () => {
  const env = createEnv({ props: PROPS });
  postEsc(env);
  assert.deepEqual(postEsc(env), { ok: true, duplicate: true, lead: "duplicate" });
  const second = escalation({ escalationId: "E-1111111111" });
  postEsc(env, second);
  const before = rowObject(tab(env, "Handoffs"), 2)["Requirements"];
  assert.deepEqual(postEsc(env, second), { ok: true, duplicate: true, lead: "duplicate" });
  assert.equal(rowObject(tab(env, "Handoffs"), 2)["Requirements"], before, "message not appended twice");
  assert.equal(tab(env, "Handoffs").getLastRow(), 2);
  assert.equal(env.mails.length, 2);
});

test("a retry repairs a Lead that failed the first time; a Lead failure never loses the escalation", () => {
  const env = createEnv({ props: PROPS });
  const real = env.spreadsheet.getSheetByName;
  env.spreadsheet.getSheetByName = (n) => { if (n === "Handoffs") throw new Error("Sheets hiccup"); return real(n); };
  assert.deepEqual(postEsc(env), { ok: true, stored: true, emailStatus: "SENT", lead: "failed" });
  assert.equal(rowObject(tab(env, "Guest Escalations"), 2)["Escalation ID"], "E-0DD420D0C2", "escalation stored anyway");
  env.spreadsheet.getSheetByName = real;
  assert.deepEqual(postEsc(env), { ok: true, duplicate: true, lead: "created" });
  assert.equal(rowObject(tab(env, "Handoffs"), 2)["Handoff ID"], "H-0DD420D0C2");
  assert.equal(env.mails.length, 1, "the retry sends no second email");
});

test("no Lead without a verified booking block: response and Sheets exactly as before", () => {
  const env = createEnv({ props: PROPS });
  const e = escalation();
  delete e.lead;
  assert.deepEqual(postEsc(env, e), { ok: true, stored: true, emailStatus: "SENT" });
  assert.equal(tab(env, "Handoffs"), null);
  // Not WhatsApp, or no booking code / phone: skipped (the escalation is still stored).
  for (const [id, over] of [["E-5555555555", { channel: "api" }], ["E-6666666666", { bookingCode: null }], ["E-7777777777", { guestPhone: null }]]) {
    assert.equal(postEsc(env, escalation(Object.assign({ escalationId: id }, over))).lead, "skipped", id);
  }
  assert.equal(tab(env, "Handoffs"), null);
  assert.equal(tab(env, "Guest Escalations").getLastRow(), 5);
});

test("an invalid Lead block only skips the Lead; the escalation is stored", () => {
  const env = createEnv({ props: PROPS });
  for (const [id, bad] of [["E-AAAAAAAAAA", { checkIn: "soon" }], ["E-BBBBBBBBBB", { nights: -1 }], ["E-CCCCCCCCCC", { guestName: "x".repeat(41) }], ["E-DDDDDDDDDD", { guests: "four" }]]) {
    const r = postEsc(env, escalation({ escalationId: id, lead: lead(bad) }));
    assert.equal(r.stored, true, id);
    assert.equal(r.lead, "skipped", id);
  }
  assert.equal(tab(env, "Handoffs"), null);
  assert.equal(postEsc(env, escalation({ escalationId: "E-EEEEEEEEEE", lead: "nope" })).lead, "skipped");
});

test("no guest name is invented: a missing name leaves Guest Name empty", () => {
  const env = createEnv({ props: PROPS });
  postEsc(env, escalation({ lead: lead({ guestName: null, guests: null, destination: null }) }));
  const l = rowObject(tab(env, "Handoffs"), 2);
  assert.equal(l["Guest Name"], "");
  assert.equal(l["Guests"], "");
  assert.equal(l["Destination"], "");
  assert.equal(l["Booking Code"], "RIAA005");
});

test("existing Handoffs tab: the two columns are appended at the end; bot handoffs for the same phone are not touched", () => {
  const env = createEnv({ props: Object.assign({}, PROPS) });
  const h = oldLayoutTab(env, "Handoffs", OLD_HANDOFF_HEADERS, []);
  postHandoff(env, undefined); // an ordinary bot handoff row (no booking code)
  const botRow = JSON.stringify(rowObject(h, 2));
  assert.equal(postEsc(env, escalation({ guestPhone: rowObject(h, 2)["Phone"].replace(/^'/, "") })).lead, "created");
  assert.deepEqual(plain(h.headers()).slice(0, OLD_HANDOFF_HEADERS.length), OLD_HANDOFF_HEADERS, "existing columns did not move");
  assert.deepEqual(plain(h.headers()).slice(-2), ["Guest Name", "Booking Code"]);
  assert.equal(JSON.stringify(rowObject(h, 2)), botRow, "the bot handoff row is unchanged");
  assert.equal(h.getLastRow(), 3);
});

// Guest Name for WhatsApp-bot leads, and moving "Guest Name" / "Booking Code" to the front of the Handoffs tab
// (apps-script/Code.gs). Runs the real Code.gs with fake Google services (no network, no real Sheet or email).
// Proves: the name the guest typed is written to the Guest Name column of Qualified Leads and Handoffs (and the email);
// no name -> empty, never invented; bad values are rejected; moveHandoffGuestColumns() puts the columns in the agreed
// order without duplicating any column or losing data (e.g. Aani / RIAA005), is safe to re-run, refuses a sheet with a
// duplicated header, and every later write (bot handoff, Guest Escalation update) still lands in the right column.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEnv, post, postLead, postHandoff, qualifiedLead, handoff, rowObject, col } from "../helpers/apps-script-env.mjs";

const GM_SECRET = "fake-guest-sink-secret-for-tests";
const PROPS = { GUEST_MESSAGES_SINK_SECRET: GM_SECRET };
const AANI_PHONE = "+918712308682";
const plain = (v) => JSON.parse(JSON.stringify(v));
const tab = (env, name) => env.spreadsheet.getSheetByName(name);

function escalation(overrides = {}) {
  return Object.assign({
    escalationId: "E-FFF6E04826", reason: "BOOKING_CHANGE", question: "Can I extend my stay by one night?", guestPhone: AANI_PHONE,
    bookingCode: "RIAA005", intent: null, channel: "whatsapp", receivedAt: "2026-10-12T07:29:00.000Z",
    lead: { guestName: "Aani", property: "Villa 65 Sariska", destination: "sariska", checkIn: "2026-10-18", checkOut: "2026-10-20", nights: 2, guests: 4 },
  }, overrides);
}
const postEsc = (env, e = escalation()) => post(env, { secret: GM_SECRET, type: "guest_escalation", escalation: e });

// ---------- 1. Guest Name from the WhatsApp assistant ----------

test("qualified lead: the guest's typed name goes to Guest Name (Qualified Leads) and the team email", () => {
  const env = createEnv();
  assert.deepEqual(postLead(env, qualifiedLead({ guestName: "Asha Verma" })), { ok: true, stored: true, emailStatus: "SENT" });
  const q = tab(env, "Qualified Leads");
  assert.ok(q.headers().includes("Guest Name"));
  assert.equal(q.headers().filter((h) => h === "Guest Name").length, 1);
  const row = rowObject(q, 2);
  assert.equal(row["Guest Name"], "Asha Verma");
  assert.equal(row["Lead ID"], "L-ABCDEF0123");
  assert.equal(row["Phone"], "'+919000000001");
  assert.equal(row["Email Status"], "SENT");
  assert.match(env.mails[0].body, /\nGuest name: Asha Verma\n/);
});

test("handoff: the typed name goes to Guest Name on Handoffs; other columns as before", () => {
  const env = createEnv();
  postHandoff(env, handoff({ guestName: "Ravi" }));
  const row = rowObject(tab(env, "Handoffs"), 2);
  assert.equal(row["Guest Name"], "Ravi");
  assert.equal(row["Handoff ID"], "H-ABCDEF0123");
  assert.equal(row["Reason"], "HUMAN_REQUESTED");
  assert.equal(row["Booking Code"], "", "bot handoffs have no booking");
  assert.match(env.mails[0].body, /\nGuest name: Ravi\n/);
});

test("no name (guest skipped it, or an older website): Guest Name stays empty, never invented", () => {
  const env = createEnv();
  postLead(env, qualifiedLead()); // older website: no guestName key at all
  postLead(env, qualifiedLead({ leadId: "L-ABCDEF0124", guestName: null }));
  postHandoff(env, handoff());
  assert.equal(rowObject(tab(env, "Qualified Leads"), 2)["Guest Name"], "");
  assert.equal(rowObject(tab(env, "Qualified Leads"), 3)["Guest Name"], "");
  assert.equal(rowObject(tab(env, "Handoffs"), 2)["Guest Name"], "");
  assert.match(env.mails[0].body, /\nGuest name: not given\n/);
});

test("an invalid name is rejected before anything is written", () => {
  const env = createEnv();
  for (const bad of ["x".repeat(61), "Asha\nVerma", 42, { first: "A" }]) {
    assert.deepEqual(postLead(env, qualifiedLead({ guestName: bad })), { ok: false, error: "rejected", code: "INVALID", field: "guestName", v: env.gs.BOT_CODE_VERSION });
    assert.equal(postHandoff(env, handoff({ guestName: bad })).field, "guestName");
  }
  assert.equal(tab(env, "Qualified Leads"), null);
  assert.equal(tab(env, "Handoffs"), null);
  // A formula-looking value is stored as text, like every other cell.
  postHandoff(env, handoff({ guestName: "=Asha" }));
  assert.equal(rowObject(tab(env, "Handoffs"), 2)["Guest Name"], "'=Asha");
});

test("Guest Escalation leads keep the verified booking's name (not affected by the bot change)", () => {
  const env = createEnv({ props: PROPS });
  assert.equal(postEsc(env).lead, "created");
  assert.equal(rowObject(tab(env, "Handoffs"), 2)["Guest Name"], "Aani");
});

// ---------- 2. Moving Guest Name / Booking Code to the front of Handoffs ----------

const FRONT = ["Received (IST)", "Handoff ID", "Guest Name", "Booking Code", "Status", "Reason", "Phone", "Destination", "Property", "Check-in", "Check-out"];

// The production layout today: every Handoffs column in the old order (Guest Name / Booking Code at the end), plus a
// column the team added, an older bot lead for Aani's phone (blank booking code) and the Aani / RIAA005 escalation lead.
function productionLikeSheet() {
  const env = createEnv({ props: PROPS });
  postHandoff(env, handoff({ handoffId: "H-1D83E0A88A", phone: AANI_PHONE }));
  postEsc(env);
  postHandoff(env, handoff({ handoffId: "H-0000000777", guestName: "Ravi" }));
  const h = tab(env, "Handoffs");
  h.setCell(1, h.getLastColumn() + 1, "Team Notes");
  h.setCell(3, col(h, "Team Notes"), "called once");
  h.setCell(3, col(h, "Status"), "Contacted");
  return { env, h };
}

test("moveHandoffGuestColumns: agreed order, no duplicate column, every row's data kept (Aani / RIAA005)", () => {
  const { env, h } = productionLikeSheet();
  const headersBefore = plain(h.headers());
  assert.deepEqual(headersBefore.slice(-3), ["Guest Name", "Booking Code", "Team Notes"], "today: at the end");
  const rowsBefore = [2, 3, 4].map((r) => plain(rowObject(h, r)));
  const statusCells = [2, 3, 4].map((r) => !!h.validations.get(r + "," + col(h, "Status")));

  const result = env.gs.moveHandoffGuestColumns();

  assert.deepEqual(plain(h.headers()).slice(0, FRONT.length), FRONT);
  assert.equal(h.headers().length, headersBefore.length, "no column added or removed");
  assert.deepEqual(plain(h.headers()).slice().sort(), headersBefore.slice().sort(), "same columns, each exactly once");
  const rest = headersBefore.filter((n) => !FRONT.includes(n));
  assert.deepEqual(plain(h.headers()).slice(FRONT.length), rest, "the other columns keep their order");
  assert.deepEqual([2, 3, 4].map((r) => plain(rowObject(h, r))), rowsBefore, "every value stays with its row and header");
  const aani = rowObject(h, 3);
  assert.deepEqual([aani["Handoff ID"], aani["Guest Name"], aani["Booking Code"], aani["Status"], aani["Team Notes"]], ["H-FFF6E04826", "Aani", "RIAA005", "Contacted", "called once"]);
  assert.deepEqual([2, 3, 4].map((r) => !!h.validations.get(r + "," + col(h, "Status"))), statusCells, "Status dropdowns moved with the column");
  assert.equal(col(h, "Status"), 5);
  assert.match(result, /column\(s\) moved/);
});

test("moveHandoffGuestColumns is safe to re-run: nothing moves the second time", () => {
  const { env, h } = productionLikeSheet();
  env.gs.moveHandoffGuestColumns();
  const after = plain(h.data);
  assert.match(env.gs.moveHandoffGuestColumns(), /^Handoffs: 0 column\(s\) moved/);
  assert.deepEqual(plain(h.data), after);
});

test("moveHandoffGuestColumns refuses a sheet with a duplicated header and changes nothing", () => {
  const { env, h } = productionLikeSheet();
  h.setCell(1, h.getLastColumn() + 1, "Guest Name");
  const before = plain(h.data);
  assert.throws(() => env.gs.moveHandoffGuestColumns(), /exactly one "Guest Name" column.*found 2\. Nothing was moved/);
  assert.deepEqual(plain(h.data), before);
});

test("after the move every write still maps by header: escalation update, new escalation lead, bot handoff, status edit", () => {
  const { env, h } = productionLikeSheet();
  env.gs.moveHandoffGuestColumns();

  // Same phone + booking, lead still open: the Aani row is updated (not duplicated).
  assert.equal(postEsc(env, escalation({ escalationId: "E-1111111111", question: "Also late checkout?" })).lead, "updated");
  assert.equal(h.getLastRow(), 4);
  const aani = rowObject(h, 3);
  assert.match(aani["Requirements"], /E-FFF6E04826\] Can I extend my stay by one night\?\n\[.* E-1111111111\] Also late checkout\?$/);
  assert.equal(aani["Status"], "Contacted");

  // A new booking: a new lead with every field in its own column.
  assert.equal(postEsc(env, escalation({ escalationId: "E-2222222222", bookingCode: "RIAA777" })).lead, "created");
  const created = rowObject(h, 5);
  assert.deepEqual([created["Handoff ID"], created["Guest Name"], created["Booking Code"], created["Status"], created["Phone"], created["Property"]],
    ["H-2222222222", "Aani", "RIAA777", "New", "'" + AANI_PHONE, "Villa 65 Sariska"]);
  assert.ok(h.validations.has("5," + col(h, "Status")), "Status dropdown on the moved Status column");

  // A bot handoff with a typed name.
  postHandoff(env, handoff({ handoffId: "H-0000000888", guestName: "Meera" }));
  const bot = rowObject(h, 6);
  assert.deepEqual([bot["Handoff ID"], bot["Guest Name"], bot["Booking Code"], bot["Reason"], bot["Email Status"]], ["H-0000000888", "Meera", "", "HUMAN_REQUESTED", "SENT"]);
  assert.equal(h.headers().length, 27, "still no duplicate columns");

  // The team changes Status by hand: the trigger stamps the right columns.
  const statusCol = col(h, "Status");
  h.setCell(6, statusCol, "Contacted");
  env.gs.onLeadStatusEdit({ range: h.getRange(6, statusCol), oldValue: "New", value: "Contacted" });
  assert.equal(rowObject(h, 6)["Next Follow-up"], "2026-10-14 13:00:00");
});

// ---------- 3. Guest Name on all four tabs ----------

const MSG_SECRET_PROPS = { GUEST_MESSAGES_SINK_SECRET: GM_SECRET };
function guestMessage(overrides = {}) {
  return Object.assign({
    messageId: "GM-0123456789AB", type: "PRE_ARRIVAL", status: "READY", reason: null, scheduledDate: "2026-10-12", sendBy: "2026-10-12",
    bookingId: "101", bookingCode: "BK101", checkIn: "2026-10-14", checkOut: "2026-10-16", nights: 2, guests: "2 adults",
    property: "Studio 925", guestName: "Asha", guestPhone: "+919876543210", specialRequest: "no", bookingSource: "Walk-In",
    message: "Hi Asha, see you soon.", createdAt: "2026-10-12T07:29:00.000Z",
  }, overrides);
}
const postMsg = (env, m = guestMessage()) => post(env, { secret: GM_SECRET, type: "guest_message", message: m });
// The Guest Messages tab as it exists today (name column called "Guest").
const OLD_MESSAGE_HEADERS = ["Created (IST)", "Message ID", "Status", "Type", "Scheduled Date", "Send By", "Booking ID", "Booking Code",
  "Check-in", "Check-out", "Nights", "Guests", "Property", "Guest", "Guest WhatsApp", "Special Request", "Booking Source",
  "Reason", "Message", "Status Updated (IST)"];
const OLD_ESCALATION_HEADERS = ["Received (IST)", "Escalation ID", "Status", "Reason", "Question", "Guest WhatsApp", "Booking Code",
  "Topic", "Channel", "Received (UTC)", "Email Status", "Status Updated (IST)"];
const countOf = (sheet, name) => sheet.headers().filter((h) => h === name).length;

test("Guest Messages: the verified booking's guest name is written to Guest Name (no 'Guest' column on a new tab)", () => {
  const env = createEnv({ props: MSG_SECRET_PROPS });
  postMsg(env);
  postMsg(env, guestMessage({ messageId: "GM-0123456789AC", guestName: null }));
  const s = tab(env, "Guest Messages");
  assert.equal(countOf(s, "Guest Name"), 1);
  assert.equal(countOf(s, "Guest"), 0);
  assert.equal(rowObject(s, 2)["Guest Name"], "Asha");
  assert.equal(rowObject(s, 3)["Guest Name"], "", "no verified name: empty, never guessed");
});

test("Guest Messages, existing tab: 'Guest' is renamed to 'Guest Name' in place; old values kept; no second column", () => {
  const env = createEnv({ props: MSG_SECRET_PROPS });
  const s = env.spreadsheet.insertSheet("Guest Messages");
  s.appendRow(OLD_MESSAGE_HEADERS);
  s.appendRow(OLD_MESSAGE_HEADERS.map((h) => ({ "Message ID": "GM-00000000OLD1", Status: "SENT", Guest: "Ravi", "Guest WhatsApp": "'+919000000005" })[h] || ""));
  const nameCol = OLD_MESSAGE_HEADERS.indexOf("Guest") + 1;
  postMsg(env);
  assert.equal(s.headers()[nameCol - 1], "Guest Name", "same column, new header");
  assert.equal(countOf(s, "Guest Name"), 1);
  assert.equal(countOf(s, "Guest"), 0);
  assert.equal(s.headers().length, OLD_MESSAGE_HEADERS.length, "no column added");
  assert.equal(rowObject(s, 2)["Guest Name"], "Ravi", "existing value kept");
  assert.equal(rowObject(s, 2)["Status"], "SENT");
  assert.equal(rowObject(s, 3)["Guest Name"], "Asha");
  // A forward status move on the existing row still finds its columns by name.
  postMsg(env, guestMessage({ messageId: "GM-00000000OLD1", status: "READY" }));
  assert.equal(rowObject(s, 2)["Status"], "SENT", "the team's SENT is never changed");
});

test("Guest Escalations: Guest Name from a verified booking only; empty otherwise", () => {
  const env = createEnv({ props: PROPS });
  postEsc(env);
  const noBooking = escalation({ escalationId: "E-0000000002", bookingCode: null });
  delete noBooking.lead;
  postEsc(env, noBooking);
  postEsc(env, escalation({ escalationId: "E-0000000003", lead: { guestName: "Aani", checkIn: "soon" } })); // invalid block
  const s = tab(env, "Guest Escalations");
  assert.equal(countOf(s, "Guest Name"), 1);
  assert.deepEqual([2, 3, 4].map((r) => rowObject(s, r)["Guest Name"]), ["Aani", "", ""]);
  assert.equal(rowObject(s, 2)["Escalation ID"], "E-FFF6E04826");
  assert.equal(rowObject(s, 2)["Email Status"], "SENT", "storage and email as before");
});

// Today's four tabs: Handoffs already in the deployed order; the other three in their old order, with data.
function fourTabs() {
  const { env, h } = productionLikeSheet();
  env.gs.moveHandoffGuestColumns(); // the Handoffs order already deployed
  postLead(env, qualifiedLead({ guestName: "Asha Verma" }));
  postLead(env, qualifiedLead({ leadId: "L-ABCDEF0124", phone: "+919000000004" }));
  const q = tab(env, "Qualified Leads");
  q.setCell(1, q.getLastColumn() + 1, "Team Notes");
  q.setCell(3, col(q, "Team Notes"), "VIP");
  const m = env.spreadsheet.insertSheet("Guest Messages");
  m.appendRow(OLD_MESSAGE_HEADERS);
  m.appendRow(OLD_MESSAGE_HEADERS.map((x) => ({ "Created (IST)": "2026-10-11 10:00:00", "Message ID": "GM-00000000OLD1", Status: "READY", Guest: "Ravi", "Guest WhatsApp": "'+919000000005", Message: "Hi Ravi" })[x] || ""));
  env.gs.applyListValidation_(m.getRange(2, col(m, "Status")), ["QUEUED", "READY", "SENT", "SKIPPED", "FAILED"], "x");
  const e = env.spreadsheet.insertSheet("Guest Escalations");
  e.appendRow(OLD_ESCALATION_HEADERS);
  e.appendRow(OLD_ESCALATION_HEADERS.map((x) => ({ "Received (IST)": "2026-10-11 10:00:00", "Escalation ID": "E-00000000AA", Status: "Open", Reason: "BOOKING_CHANGE", "Booking Code": "RIAA005" })[x] || ""));
  return { env, h, q, m, e };
}

test("moveGuestNameColumns: Guest Name right after the ID on all four tabs; all data kept; no duplicate columns", () => {
  const { env, h, q, m, e } = fourTabs();
  const snap = (s) => [2, 3, 4].filter((r) => r <= s.getLastRow()).map((r) => plain(rowObject(s, r)));
  const before = { h: snap(h), q: snap(q), e: snap(e) };
  const msgBefore = plain(rowObject(m, 2));
  const handoffHeaders = plain(h.headers());

  const result = env.gs.moveGuestNameColumns();

  assert.deepEqual(plain(h.headers()), handoffHeaders, "Handoffs: the deployed order is kept");
  assert.deepEqual(plain(q.headers()).slice(0, 5), ["Received (IST)", "Lead ID", "Guest Name", "Status", "Phone"]);
  assert.deepEqual(plain(e.headers()).slice(0, 5), ["Received (IST)", "Escalation ID", "Guest Name", "Status", "Reason"]);
  assert.deepEqual(plain(m.headers()).slice(0, 3), ["Created (IST)", "Message ID", "Guest Name"]);
  for (const s of [h, q, e, m]) {
    assert.equal(countOf(s, "Guest Name"), 1, s.getName());
    assert.equal(new Set(s.headers()).size, s.headers().length, s.getName() + ": no duplicate column");
  }
  assert.equal(countOf(m, "Guest"), 0, "Guest Messages: renamed, not copied");
  assert.equal(m.headers().length, OLD_MESSAGE_HEADERS.length);
  assert.equal(e.headers().length, OLD_ESCALATION_HEADERS.length + 1, "Guest Escalations: Guest Name added once");
  assert.deepEqual(snap(h), before.h);
  assert.deepEqual(snap(q), before.q);
  assert.deepEqual(snap(e).map((r) => { const o = { ...r }; delete o["Guest Name"]; return o; }), before.e);
  assert.equal(rowObject(e, 2)["Guest Name"], "", "existing escalation: empty, never guessed");
  assert.deepEqual(plain(rowObject(m, 2)), Object.assign({}, (() => { const o = { ...msgBefore, "Guest Name": msgBefore.Guest }; delete o.Guest; return o; })()));
  assert.equal(rowObject(q, 2)["Guest Name"], "Asha Verma");
  assert.equal(rowObject(q, 3)["Team Notes"], "VIP");
  assert.ok(m.validations.has("2," + col(m, "Status")), "dropdown moved with its column");
  assert.match(result, /Qualified Leads: \d+ column\(s\) moved/);
  // Safe to re-run.
  const after = [h, q, e, m].map((s) => plain(s.data));
  assert.match(env.gs.moveGuestNameColumns(), /Handoffs: 0 column\(s\) moved[\s\S]*Qualified Leads: 0[\s\S]*Guest Escalations: 0[\s\S]*Guest Messages: 0/);
  assert.deepEqual([h, q, e, m].map((s) => plain(s.data)), after);
});

test("moveGuestNameColumns: a duplicated header on any tab stops it before anything changes; missing tabs are skipped", () => {
  const { env, h, q, m, e } = fourTabs();
  e.setCell(1, e.getLastColumn() + 1, "Status");
  const before = [h, q, e, m].map((s) => plain(s.data));
  assert.throws(() => env.gs.moveGuestNameColumns(), /one "Status" column on Guest Escalations, found 2\. Nothing was changed/);
  assert.deepEqual([h, q, e, m].map((s) => plain(s.data)), before);
  const empty = createEnv();
  assert.match(empty.gs.moveGuestNameColumns(), /No lead or guest tabs found/);
  assert.equal(empty.spreadsheet.getSheets().length, 0, "creates no tab");
});

test("after the move every write and lookup still works by header name (IDs included)", () => {
  const { env, q, m, e } = fourTabs();
  env.gs.moveGuestNameColumns();
  // Qualified lead: new row in the right columns; a retry finds the ID by its header and adds nothing.
  postLead(env, qualifiedLead({ leadId: "L-ABCDEF0125", guestName: "Meera", phone: "+919000000006" }));
  const lead = rowObject(q, 4);
  assert.deepEqual([lead["Lead ID"], lead["Guest Name"], lead["Status"], lead["Phone"], lead["Email Status"]], ["L-ABCDEF0125", "Meera", "New", "'+919000000006", "SENT"]);
  assert.deepEqual(postLead(env, qualifiedLead({ leadId: "L-ABCDEF0125", guestName: "Meera", phone: "+919000000006" })), { ok: true, duplicate: true });
  // Guest message and escalation rows.
  postMsg(env);
  assert.deepEqual([rowObject(m, 3)["Message ID"], rowObject(m, 3)["Guest Name"], rowObject(m, 3)["Status"]], ["GM-0123456789AB", "Asha", "READY"]);
  postEsc(env, escalation({ escalationId: "E-0000000009" }));
  const esc = rowObject(e, 3);
  assert.deepEqual([esc["Escalation ID"], esc["Guest Name"], esc["Status"], esc["Reason"]], ["E-0000000009", "Aani", "Open", "BOOKING_CHANGE"]);
  // Even if the team drags an ID column elsewhere, lookups follow the header.
  q.moveColumns(q.getRange(1, col(q, "Lead ID"), 1, 1), q.getLastColumn() + 1);
  assert.deepEqual(postLead(env, qualifiedLead({ leadId: "L-ABCDEF0125", guestName: "Meera", phone: "+919000000006" })), { ok: true, duplicate: true });
  assert.equal(q.getLastRow(), 4, "no duplicate lead");
  const statusCol = col(q, "Status");
  q.setCell(4, statusCol, "Contacted");
  env.gs.onLeadStatusEdit({ range: q.getRange(4, statusCol), oldValue: "New", value: "Contacted" });
  assert.equal(rowObject(q, 4)["Next Follow-up"], "2026-10-14 13:00:00");
});

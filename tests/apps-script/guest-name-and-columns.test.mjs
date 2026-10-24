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

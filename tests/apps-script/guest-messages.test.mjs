// Week 7: Guest Messages + Guest Escalations in apps-script/Code.gs (handleGuestRequest_, runGuestMessages,
// setupGuestMessages). Runs the real Code.gs with fake Google services: no network, no real Sheet or email, and the
// website endpoint is a fake UrlFetchApp. Proves: secret, validation, one row per ID, only forward status moves
// (the team's SENT is never touched), formula safety, escalation email, OFF by default, dry run stores nothing,
// one digest per day, counts-only logs, and that the existing click / bot-lead flows are unchanged.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEnv, post, postLead, rowObject, col, editEvent, SECRET } from "../helpers/apps-script-env.mjs";

const GM_SECRET = "fake-guest-sink-secret-for-tests";
const API_SECRET = "fake-guest-api-secret-0123456789abcdef";
const ENDPOINT = "https://example.test/api/guest-messages/run";
const PROPS = { GUEST_MESSAGES_SINK_SECRET: GM_SECRET };
const LONG_TEXT = "Hi Asha,\n\n" + "This is Ritumbhara. ".repeat(25) + "\n\nBooking ref: BK101"; // > 300 characters

function message(overrides = {}) {
  return Object.assign({
    messageId: "GM-0123456789AB", type: "PRE_ARRIVAL", status: "READY", reason: null, scheduledDate: "2026-10-12", sendBy: "2026-10-12",
    bookingId: "101", bookingCode: "BK101", checkIn: "2026-10-14", checkOut: "2026-10-16", nights: 2, guests: "2 adults",
    property: "Studio, room 925", guestName: "Asha", guestPhone: "+919876543210", specialRequest: "no", bookingSource: "Walk-In",
    message: LONG_TEXT, createdAt: "2026-10-12T07:29:00.000Z",
  }, overrides);
}

function escalation(overrides = {}) {
  return Object.assign({
    escalationId: "E-0123456789", reason: "HUMAN_REQUESTED", question: "Can I talk to someone?", guestPhone: "+919876543210",
    bookingCode: null, intent: null, channel: "whatsapp", receivedAt: "2026-10-12T07:29:00.000Z",
  }, overrides);
}

const postMsg = (env, m = message(), secret = GM_SECRET) => post(env, { secret, type: "guest_message", message: m });
const postEsc = (env, e = escalation(), secret = GM_SECRET) => post(env, { secret, type: "guest_escalation", escalation: e });
const tab = (env, name) => env.spreadsheet.getSheetByName(name);
const plain = (v) => JSON.parse(JSON.stringify(v)); // values from the Apps Script sandbox (another VM realm)

// ---------- guest_message ----------

test("guest_message: stored once on the Guest Messages tab with headers, dropdown and full message text", () => {
  const env = createEnv({ props: PROPS });
  assert.deepEqual(postMsg(env), { ok: true, stored: true });
  const s = tab(env, "Guest Messages");
  assert.deepEqual(plain(s.headers()), plain(env.gs.GUEST_MESSAGE_HEADERS));
  const row = rowObject(s, 2);
  assert.equal(row["Message ID"], "GM-0123456789AB");
  assert.equal(row["Status"], "READY");
  assert.equal(row["Guest WhatsApp"], "'+919876543210", "formula-safe (leading +)");
  assert.equal(row["Message"], LONG_TEXT, "not cut at 300 characters");
  assert.equal(row["Created (IST)"], "2026-10-12 13:00:00");
  assert.deepEqual(plain(s.validations.get("2," + col(s, "Status")).list), ["QUEUED", "READY", "SENT", "SKIPPED", "FAILED"]);
  assert.equal(env.mails.length, 0, "queue items send no email by themselves");

  assert.deepEqual(postMsg(env), { ok: true, duplicate: true });
  assert.equal(s.getLastRow(), 2, "no duplicate row");
});

test("guest_message: only forward moves; the team's SENT and SKIPPED are never changed", () => {
  const env = createEnv({ props: PROPS });
  postMsg(env, message({ status: "QUEUED" }));
  const s = tab(env, "Guest Messages");
  assert.deepEqual(postMsg(env, message({ status: "READY" })), { ok: true, duplicate: true, updated: true });
  assert.equal(rowObject(s, 2)["Status"], "READY");
  assert.deepEqual(postMsg(env, message({ status: "QUEUED" })), { ok: true, duplicate: true }, "never backwards");
  assert.equal(rowObject(s, 2)["Status"], "READY");

  s.setCell(2, col(s, "Status"), "SENT"); // the team sent it
  assert.deepEqual(postMsg(env, message({ status: "SKIPPED", reason: "status_cancelled" })), { ok: true, duplicate: true });
  assert.equal(rowObject(s, 2)["Status"], "SENT");

  postMsg(env, message({ messageId: "GM-AAAAAAAAAAAA", status: "READY" }));
  assert.deepEqual(postMsg(env, message({ messageId: "GM-AAAAAAAAAAAA", status: "SKIPPED", reason: "status_cancelled" })), { ok: true, duplicate: true, updated: true });
  assert.equal(rowObject(s, 3)["Reason"], "status_cancelled");
  assert.deepEqual(postMsg(env, message({ messageId: "GM-AAAAAAAAAAAA", status: "READY" })), { ok: true, duplicate: true }, "SKIPPED stays");
});

test("guest_message: secret and validation (field names only, never values)", () => {
  const env = createEnv({ props: PROPS });
  assert.equal(postMsg(env, message(), "wrong").code, "AUTH");
  assert.equal(postMsg(env, message(), SECRET).code, "AUTH", "the bot-lead secret does not work here");
  assert.equal(postMsg(createEnv(), message()).code, "NO_SECRET_PROPERTY");
  for (const [over, field] of [[{ messageId: "GM-1" }, "messageId"], [{ type: "WELCOME" }, "type"], [{ status: "SENT" }, "status"],
    [{ scheduledDate: "12/10/2026" }, "scheduledDate"], [{ bookingId: "abc" }, "bookingId"], [{ guestPhone: "98765" }, "guestPhone"],
    [{ message: "" }, "message"], [{ specialRequest: "maybe" }, "specialRequest"], [{ nights: -1 }, "nights"],
    [{ sendBy: undefined }, "sendBy"], [{ sendBy: "soon" }, "sendBy"], [{ sendBy: "2026-10-11" }, "sendBy"]]) {
    const r = postMsg(env, message(over));
    assert.equal(r.code, "INVALID");
    assert.equal(r.field, field);
  }
  assert.equal(tab(env, "Guest Messages"), null, "nothing written");
  postMsg(env, message({ property: "=HYPERLINK(\"x\")", message: "=1+1 hi" }));
  const row = rowObject(tab(env, "Guest Messages"), 2);
  assert.equal(row["Property"], "'=HYPERLINK(\"x\")");
  assert.equal(row["Message"], "'=1+1 hi");
});

// ---------- guest_escalation ----------

test("guest_escalation: stored as Open, team emailed once; email failure keeps the row", () => {
  const env = createEnv({ props: PROPS });
  assert.deepEqual(postEsc(env), { ok: true, stored: true, emailStatus: "SENT" });
  const s = tab(env, "Guest Escalations");
  const row = rowObject(s, 2);
  assert.equal(row["Status"], "Open");
  assert.equal(row["Reason"], "HUMAN_REQUESTED");
  assert.equal(row["Question"], "Can I talk to someone?");
  assert.equal(row["Email Status"], "SENT");
  assert.equal(env.mails.length, 1);
  assert.equal(env.mails[0].subject, "Guest needs a team member");
  assert.match(env.mails[0].body, /the guest asked for a team member/);
  assert.match(env.mails[0].body, /No booking has been changed/);
  assert.deepEqual(postEsc(env), { ok: true, duplicate: true });
  assert.equal(env.mails.length, 1, "no second email");
  assert.equal(postEsc(env, escalation({ escalationId: "E-1111111111", reason: "URGENT_ISSUE" })).emailStatus, "SENT");
  assert.match(env.mails[1].subject, /\(urgent\)/);

  const down = createEnv({ props: PROPS, mailThrows: true });
  assert.deepEqual(postEsc(down), { ok: true, stored: true, emailStatus: "FAILED" });
  assert.equal(rowObject(tab(down, "Guest Escalations"), 2)["Email Status"], "FAILED");
  assert.equal(postEsc(down, escalation({ reason: "GOSSIP" })).field, "reason");
});

test("existing flows are unchanged: bot leads and clicks still work with their own secrets", () => {
  const env = createEnv({ props: PROPS });
  assert.equal(postLead(env).stored, true);
  assert.equal(post(env, { secret: GM_SECRET, type: "qualified_lead", lead: {} }).code, "AUTH", "guest secret cannot write leads");
  assert.equal(post(env, { secret: "fake-click-secret-for-tests", event: { event: "WhatsApp Click", ref: "W-HOME" } }).ok, true);
});

// ---------- runGuestMessages / setupGuestMessages ----------

function runEnv(mode, reply = { ok: true, mode, today: "2026-10-12", bookings: 3, planned: 2, byStatus: { READY: 2 }, deliveries: { stored: 2 } }) {
  const props = Object.assign({}, PROPS, { GUEST_MESSAGES_ENDPOINT: ENDPOINT, GUEST_MESSAGES_API_SECRET: API_SECRET });
  if (mode) props.GUEST_MESSAGES_MODE = mode;
  return createEnv({ props, urlFetch: () => ({ status: 200, body: reply }) });
}

test("runGuestMessages: OFF by default (no call); bad settings refuse to run", () => {
  const env = runEnv(null);
  const r = env.gs.runGuestMessages();
  assert.equal(r.ran, false);
  assert.equal(env.fetches.length, 0);
  const bad = createEnv({ props: { GUEST_MESSAGES_MODE: "queue", GUEST_MESSAGES_ENDPOINT: "http://x/api/guest-messages/run", GUEST_MESSAGES_API_SECRET: API_SECRET }, urlFetch: () => ({ status: 200, body: {} }) });
  assert.match(bad.gs.runGuestMessages().reason, /GUEST_MESSAGES_ENDPOINT/);
  const short = createEnv({ props: { GUEST_MESSAGES_MODE: "queue", GUEST_MESSAGES_ENDPOINT: ENDPOINT, GUEST_MESSAGES_API_SECRET: "short" }, urlFetch: () => ({ status: 200, body: {} }) });
  assert.match(short.gs.runGuestMessages().reason, /at least 32/);
  assert.equal(bad.fetches.length + short.fetches.length, 0);
});

test("runGuestMessages dry_run: calls the website with the secret, no digest", () => {
  const env = runEnv("dry_run");
  const r = env.gs.runGuestMessages();
  assert.equal(env.fetches.length, 1);
  assert.equal(env.fetches[0].url, ENDPOINT);
  assert.equal(env.fetches[0].options.headers.Authorization, "Bearer " + API_SECRET);
  assert.deepEqual(JSON.parse(env.fetches[0].options.payload), { mode: "dry_run" });
  assert.equal(r.ok, true);
  assert.equal(r.digest, undefined);
  assert.equal(env.mails.length, 0);
});

test("runGuestMessages queue: one digest of due READY/FAILED messages per day; counts-only summary", () => {
  const env = runEnv("queue");
  postMsg(env, message());
  postMsg(env, message({ messageId: "GM-BBBBBBBBBBBB", status: "FAILED", reason: "no_guest_phone", guestPhone: null, type: "CHECK_IN" }));
  postMsg(env, message({ messageId: "GM-CCCCCCCCCCCC", status: "QUEUED", scheduledDate: "2026-10-13", sendBy: "2026-10-13" }));
  postMsg(env, message({ messageId: "GM-DDDDDDDDDDDD", status: "READY" }));
  tab(env, "Guest Messages").setCell(5, col(tab(env, "Guest Messages"), "Status"), "SENT");

  const r = env.gs.runGuestMessages();
  assert.equal(r.ok, true);
  assert.equal(r.expired, 0, "nothing is past its Send By date");
  assert.deepEqual(plain(r.deliveries), { stored: 2 });
  assert.deepEqual(plain(r.digest), { sent: true, due: 2, recipients: 1 });
  assert.equal(env.mails.length, 1);
  assert.equal(env.mails[0].subject, "Guest messages to send (2)");
  assert.match(env.mails[0].body, /Nothing has been sent to any guest/);
  assert.match(env.mails[0].body, /1\. Pre-arrival - READY/);
  assert.match(env.mails[0].body, /2\. Check-in - FAILED/);
  assert.match(env.mails[0].body, /not available - check Intellistay/);
  assert.match(env.mails[0].body, /This is Ritumbhara\./, "the message text is in the digest for the team to copy");
  const summary = JSON.stringify(r);
  for (const s of ["+919876543210", "Asha", "Ritumbhara", API_SECRET]) assert.ok(!summary.includes(s), s);

  assert.deepEqual(plain(env.gs.runGuestMessages().digest), { sent: false, reason: "already sent today" });
  assert.equal(env.mails.length, 1);
});

// ---------- Send By: missed messages are never sent late ----------
// Fixed clock: today (India) is 2026-10-12.

test("guest_message: Send By is stored, and updated with a forward status move", () => {
  const env = createEnv({ props: PROPS });
  postMsg(env, message({ status: "QUEUED", scheduledDate: "2026-10-13", sendBy: "2026-10-14" }));
  const s = tab(env, "Guest Messages");
  assert.equal(rowObject(s, 2)["Send By"], "2026-10-14");
  assert.equal(col(s, "Send By"), col(s, "Scheduled Date") + 1);
  postMsg(env, message({ status: "READY", scheduledDate: "2026-10-13", sendBy: "2026-10-14" }));
  assert.equal(rowObject(s, 2)["Status"], "READY");
  assert.equal(rowObject(s, 2)["Send By"], "2026-10-14");
});

test("expiry: QUEUED/READY/FAILED past Send By become SKIPPED (expired) and leave the digest; SENT is untouched", () => {
  const env = runEnv("queue", { ok: true, mode: "queue", bookings: 0, planned: 0, byStatus: {}, deliveries: {} });
  const ids = {
    readyPast: "GM-A00000000001", queuedPast: "GM-A00000000002", failedPast: "GM-A00000000003",
    sentPast: "GM-A00000000004", skippedPast: "GM-A00000000005", readyToday: "GM-A00000000006", readyGrace: "GM-A00000000007",
  };
  postMsg(env, message({ messageId: ids.readyPast, status: "READY", scheduledDate: "2026-10-09", sendBy: "2026-10-10" }));
  postMsg(env, message({ messageId: ids.queuedPast, status: "QUEUED", scheduledDate: "2026-10-11", sendBy: "2026-10-11" }));
  postMsg(env, message({ messageId: ids.failedPast, status: "FAILED", reason: "no_guest_phone", guestPhone: null, scheduledDate: "2026-10-11", sendBy: "2026-10-11" }));
  postMsg(env, message({ messageId: ids.sentPast, status: "READY", scheduledDate: "2026-10-09", sendBy: "2026-10-10" }));
  postMsg(env, message({ messageId: ids.skippedPast, status: "SKIPPED", reason: "status_cancelled", scheduledDate: "2026-10-09", sendBy: "2026-10-10" }));
  postMsg(env, message({ messageId: ids.readyToday, status: "READY", scheduledDate: "2026-10-12", sendBy: "2026-10-12" }));
  // The one-day pre-arrival grace: scheduled yesterday, Send By today -> still valid today.
  postMsg(env, message({ messageId: ids.readyGrace, status: "READY", scheduledDate: "2026-10-11", sendBy: "2026-10-12" }));
  const s = tab(env, "Guest Messages");
  const rowOf = (id) => { for (let r = 2; r <= s.getLastRow(); r++) if (rowObject(s, r)["Message ID"] === id) return rowObject(s, r); };
  s.setCell(5, col(s, "Status"), "SENT"); // the team sent it in time
  const sentBefore = JSON.stringify(rowOf(ids.sentPast));

  const r = env.gs.runGuestMessages();
  assert.equal(r.expired, 3);
  for (const id of [ids.readyPast, ids.queuedPast, ids.failedPast]) {
    const row = rowOf(id);
    assert.equal(row["Status"], "SKIPPED", id);
    assert.equal(row["Reason"], "expired", id);
    assert.equal(row["Status Updated (IST)"], "2026-10-12 13:00:00", id);
  }
  assert.equal(JSON.stringify(rowOf(ids.sentPast)), sentBefore, "SENT row unchanged, even past Send By");
  assert.equal(rowOf(ids.skippedPast)["Reason"], "status_cancelled", "an existing SKIPPED keeps its reason");
  assert.equal(rowOf(ids.readyToday)["Status"], "READY");
  assert.equal(rowOf(ids.readyGrace)["Status"], "READY");

  // Only the two still-valid messages are in the digest; no expired one appears.
  assert.deepEqual(plain(r.digest), { sent: true, due: 2, recipients: 1 });
  const body = env.mails[0].body;
  assert.equal((body.match(/^\d+\. /gm) || []).length, 2);
  assert.ok(!/scheduled 2026-10-09/.test(body) && !/FAILED/.test(body), "expired READY/FAILED are not listed");
  assert.match(body, /Pre-arrival - READY \(scheduled 2026-10-11\)/, "the grace-day message is listed");

  // Running again expires nothing more, and an expired message cannot be revived by the website.
  assert.equal(env.gs.runGuestMessages().expired, 0);
  assert.deepEqual(postMsg(env, message({ messageId: ids.readyPast, status: "READY", scheduledDate: "2026-10-09", sendBy: "2026-10-10" })), { ok: true, duplicate: true });
  assert.equal(rowOf(ids.readyPast)["Status"], "SKIPPED");
});

test("expiry: QUEUED/READY/FAILED on or before their Send By date stay actionable; expired rows are not modified again", () => {
  const env = runEnv("queue", { ok: true, mode: "queue", bookings: 0, planned: 0, byStatus: {}, deliveries: {} });
  // today (India) = 2026-10-12
  const keep = [
    ["GM-D00000000001", "QUEUED", "2026-10-13", "2026-10-13"], // before Send By (scheduled tomorrow)
    ["GM-D00000000002", "READY", "2026-10-12", "2026-10-12"], // on Send By
    ["GM-D00000000003", "FAILED", "2026-10-11", "2026-10-12"], // on Send By (grace day)
    ["GM-D00000000004", "QUEUED", "2026-10-12", "2026-10-12"], // on Send By
    ["GM-D00000000005", "READY", "2026-10-12", "2026-10-15"], // before Send By
    ["GM-D00000000006", "FAILED", "2026-10-12", "2026-10-14"], // before Send By
  ];
  keep.forEach(([id, status, scheduledDate, sendBy]) => postMsg(env, message({ messageId: id, status, scheduledDate, sendBy, reason: status === "FAILED" ? "no_guest_phone" : null })));
  postMsg(env, message({ messageId: "GM-D00000000009", status: "READY", scheduledDate: "2026-10-10", sendBy: "2026-10-11" })); // past -> expires
  const s = tab(env, "Guest Messages");
  const rowOf = (id) => { for (let r = 2; r <= s.getLastRow(); r++) if (rowObject(s, r)["Message ID"] === id) return rowObject(s, r); };

  assert.equal(env.gs.runGuestMessages().expired, 1);
  keep.forEach(([id, status]) => assert.equal(rowOf(id)["Status"], status, id + " stays " + status));
  // Digest: the due READY/FAILED rows (scheduled <= today <= Send By) are listed; QUEUED is never in the digest.
  assert.equal(env.mails[0].subject, "Guest messages to send (4)");

  // Next day: the expired row is not touched again (Status Updated keeps its first value), others expire in turn.
  const expiredRow = JSON.stringify(rowOf("GM-D00000000009"));
  env.setNow(Date.parse("2026-10-13T07:30:00Z")); // 13:00 IST on 13 Oct
  const r2 = env.gs.runGuestMessages();
  assert.equal(JSON.stringify(rowOf("GM-D00000000009")), expiredRow, "already-expired row unchanged");
  assert.equal(r2.expired, 3, "the three rows whose Send By was 12 Oct expire on 13 Oct");
  ["GM-D00000000002", "GM-D00000000003", "GM-D00000000004"].forEach((id) => assert.equal(rowOf(id)["Reason"], "expired", id));
  ["GM-D00000000001", "GM-D00000000005", "GM-D00000000006"].forEach((id) => assert.notEqual(rowOf(id)["Status"], "SKIPPED", id));
  assert.equal(s.getLastRow(), 8, "no row is ever deleted or duplicated");
  assert.equal(env.gs.runGuestMessages().expired, 0, "a repeat run on the same day changes nothing");
});

test("expiry: a stale READY row is never in the digest even before any expiry has run", () => {
  const env = runEnv("queue", { ok: false, error: "intellistay_unavailable" });
  postMsg(env, message({ messageId: "GM-B00000000001", status: "READY", scheduledDate: "2026-10-05", sendBy: "2026-10-06" }));
  const ss = env.spreadsheet;
  assert.equal(env.gs.collectDueGuestMessages_(ss, "2026-10-12").length, 0);
  assert.equal(env.gs.collectDueGuestMessages_(ss, "2026-10-06").length, 1, "still listed on its Send By day");
  // A row with no Send By (e.g. typed by hand) is never listed and never auto-expired.
  const s = tab(env, "Guest Messages");
  s.setCell(2, col(s, "Send By"), "");
  assert.equal(env.gs.collectDueGuestMessages_(ss, "2026-10-06").length, 0);
  assert.equal(env.gs.expireGuestMessages_(ss, "2026-10-12", new Date()), 0);
  assert.equal(rowObject(s, 2)["Status"], "READY");
});

test("expiry: dry_run and off modes change nothing in the Sheet", () => {
  for (const mode of ["dry_run", null]) {
    const env = runEnv(mode);
    postMsg(env, message({ messageId: "GM-C00000000001", status: "READY", scheduledDate: "2026-10-01", sendBy: "2026-10-02" }));
    const r = env.gs.runGuestMessages();
    assert.equal(r.expired, undefined, String(mode));
    assert.equal(rowObject(tab(env, "Guest Messages"), 2)["Status"], "READY", String(mode));
  }
});

// ---------- Manual status changes stamp "Status Updated (IST)" ----------

test("manual status edit on Guest Messages stamps Status Updated (and normalises case); nothing else changes", () => {
  const env = createEnv({ props: PROPS });
  postMsg(env, message({ status: "READY" }));
  postMsg(env, message({ messageId: "GM-E00000000002", status: "READY" }));
  const s = tab(env, "Guest Messages");
  const statusCol = col(s, "Status");
  assert.equal(rowObject(s, 2)["Status Updated (IST)"], "2026-10-12 13:00:00");
  const before = rowObject(s, 2);

  env.setNow(Date.parse("2026-10-12T10:15:00Z")); // 15:45 IST
  s.setCell(2, statusCol, "sent"); // the team picks SENT (typed in lower case)
  env.gs.onLeadStatusEdit(editEvent(s, 2, statusCol, "READY"));
  const after = rowObject(s, 2);
  assert.equal(after["Status"], "SENT");
  assert.equal(after["Status Updated (IST)"], "2026-10-12 15:45:00");
  for (const h of Object.keys(before)) if (h !== "Status" && h !== "Status Updated (IST)") assert.equal(after[h], before[h], h + " unchanged");
  assert.equal(rowObject(s, 3)["Status Updated (IST)"], "2026-10-12 13:00:00", "other rows untouched");
});

test("manual status edit: ignores re-selecting the same value, other columns, the header, invalid values and rows without an ID", () => {
  const env = createEnv({ props: PROPS });
  postMsg(env, message({ status: "READY" }));
  const s = tab(env, "Guest Messages");
  const statusCol = col(s, "Status");
  env.setNow(Date.parse("2026-10-12T10:15:00Z"));
  const stamp = () => rowObject(s, 2)["Status Updated (IST)"];

  env.gs.onLeadStatusEdit(editEvent(s, 2, statusCol, "READY")); // same value re-selected
  assert.equal(stamp(), "2026-10-12 13:00:00");
  env.gs.onLeadStatusEdit(editEvent(s, 2, col(s, "Message"), "old text")); // another column
  assert.equal(stamp(), "2026-10-12 13:00:00");
  env.gs.onLeadStatusEdit(editEvent(s, 1, statusCol, "Status")); // header row
  assert.equal(s.cell(1, statusCol), "Status");
  s.setCell(2, statusCol, "MAYBE");
  env.gs.onLeadStatusEdit(editEvent(s, 2, statusCol, "READY")); // invalid value
  assert.equal(stamp(), "2026-10-12 13:00:00");
  assert.equal(rowObject(s, 2)["Status"], "MAYBE", "an invalid value is left for the team to fix");
  s.appendRow(s.headers().map((h) => (h === "Status" ? "SENT" : ""))); // a row with no Message ID
  env.gs.onLeadStatusEdit(editEvent(s, 3, statusCol, "READY"));
  assert.equal(rowObject(s, 3)["Status Updated (IST)"], "");
});

test("manual status edit: a multi-row paste stamps each valid row; Week 6 lead tabs still use their own rules", () => {
  const env = createEnv({ props: PROPS });
  postMsg(env, message({ messageId: "GM-F00000000001", status: "READY" }));
  postMsg(env, message({ messageId: "GM-F00000000002", status: "FAILED", reason: "no_guest_phone", guestPhone: null }));
  const s = tab(env, "Guest Messages");
  const statusCol = col(s, "Status");
  env.setNow(Date.parse("2026-10-13T04:30:00Z")); // 10:00 IST next day
  s.setCell(2, statusCol, "SENT");
  s.setCell(3, statusCol, "SKIPPED");
  env.gs.onLeadStatusEdit(editEvent(s, 2, statusCol, undefined, 2, 1));
  assert.equal(rowObject(s, 2)["Status Updated (IST)"], "2026-10-13 10:00:00");
  assert.equal(rowObject(s, 3)["Status Updated (IST)"], "2026-10-13 10:00:00");
  assert.equal(rowObject(s, 3)["Reason"], "no_guest_phone", "Reason is never changed by a manual edit");

  // A lead-tab edit still gets the Week 6 Next Follow-up behaviour (unchanged path).
  postLead(env);
  const q = tab(env, "Qualified Leads");
  q.setCell(2, col(q, "Status"), "Contacted");
  env.gs.onLeadStatusEdit(editEvent(q, 2, col(q, "Status"), "New"));
  assert.equal(rowObject(q, 2)["Status Updated (IST)"], "2026-10-13 10:00:00");
  assert.equal(rowObject(q, 2)["Next Follow-up"], "2026-10-15 10:00:00");
});

test("manual SENT then expiry: a team-sent message stays SENT; expiry and digest behaviour unchanged", () => {
  const env = runEnv("queue", { ok: true, mode: "queue", bookings: 0, planned: 0, byStatus: {}, deliveries: {} });
  postMsg(env, message({ messageId: "GM-F00000000009", status: "READY", scheduledDate: "2026-10-11", sendBy: "2026-10-12" }));
  const s = tab(env, "Guest Messages");
  s.setCell(2, col(s, "Status"), "SENT");
  env.gs.onLeadStatusEdit(editEvent(s, 2, col(s, "Status"), "READY"));
  env.setNow(Date.parse("2026-10-14T07:30:00Z"));
  const r = env.gs.runGuestMessages();
  assert.equal(r.expired, 0);
  assert.equal(rowObject(s, 2)["Status"], "SENT");
  assert.deepEqual(plain(r.digest), { sent: false, reason: "nothing due", due: 0 });
});

test("setupGuestMessages does not add a second status-edit trigger when Week 6 setup already installed it", () => {
  const env = runEnv(null);
  postLead(env); // creates the lead tabs so Week 6 setup has something to do
  env.gs.setupLeadStatusTracking();
  const s = env.gs.setupGuestMessages();
  assert.equal(s.statusEditTrigger, "already installed");
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === "onLeadStatusEdit").length, 1);
});

test("runGuestMessages: website errors are reported, not hidden", () => {
  const env = runEnv("queue", { ok: false, error: "intellistay_unavailable", reason: "auth_failed" });
  const r = env.gs.runGuestMessages();
  assert.equal(r.ok, false);
  assert.equal(r.error, "intellistay_unavailable");
  assert.equal(r.errorReason, "auth_failed");
  const thrown = createEnv({ props: { GUEST_MESSAGES_MODE: "dry_run", GUEST_MESSAGES_ENDPOINT: ENDPOINT, GUEST_MESSAGES_API_SECRET: API_SECRET }, urlFetch: () => new Error("dns") });
  assert.match(thrown.gs.runGuestMessages().error, /^fetch_failed/);
});

test("setupGuestMessages: creates both tabs and exactly one daily trigger; contacts nobody", () => {
  const env = runEnv(null);
  const s1 = env.gs.setupGuestMessages();
  assert.equal(s1.trigger, "installed");
  assert.deepEqual(plain(tab(env, "Guest Escalations").headers()), plain(env.gs.GUEST_ESCALATION_HEADERS));
  assert.ok(tab(env, "Guest Messages"));
  assert.equal(env.gs.setupGuestMessages().trigger, "already installed");
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === "runGuestMessages").length, 1);
  assert.equal(env.triggers.find((t) => t.getHandlerFunction() === "runGuestMessages").clock.hour, 9);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === "onLeadStatusEdit").length, 1, "status-edit trigger installed once");
  assert.equal(s1.statusEditTrigger, "installed");
  assert.equal(env.fetches.length, 0);
  assert.equal(env.mails.length, 0);
  assert.equal(s1.mode, "off");
  assert.ok(!JSON.stringify(s1).includes(API_SECRET));
});

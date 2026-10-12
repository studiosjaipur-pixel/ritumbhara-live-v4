// Week 6, Step 3: follow-up reminders (daily digest) in apps-script/Code.gs.
// Harness (fake Google services, fixed clock 2026-10-12 13:00 IST): tests/helpers/apps-script-env.mjs.
// "Today" in India is 2026-10-12 for every test below.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEET_ID, OLD_QUALIFIED_HEADERS, createEnv, postLead, qualifiedLead, oldLayoutTab } from "../helpers/apps-script-env.mjs";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit";

// Lead tabs with the current (Week 6) headers; rows given as { header: value }.
function tabs(env) {
  const q = env.spreadsheet.insertSheet("Qualified Leads");
  q.appendRow(env.gs.QUALIFIED_HEADERS);
  const h = env.spreadsheet.insertSheet("Handoffs");
  h.appendRow(env.gs.HANDOFF_HEADERS);
  return { q, h };
}

function add(sheet, values) {
  const headers = sheet.headers();
  sheet.appendRow(headers.map((name) => (name in values ? values[name] : "")));
  return sheet.getLastRow();
}

function lead(id, extra = {}) {
  return Object.assign({
    "Received (IST)": "2026-10-12 08:00:00", "Lead ID": id, "Status": "Contacted", "Phone": "+919000000001",
    "Destination": "Jaipur", "Property": "", "Check-in": "2026-12-10", "Check-out": "2026-12-13", "Nights": 3, "Guests": 2,
    "Ref": "DIRECT", "Email Status": "SENT", "Next Follow-up": "2026-10-12 18:00:00", "Score": 60, "Priority": "Warm",
  }, extra);
}

function handoffRow(id, extra = {}) {
  return Object.assign({
    "Received (IST)": "2026-10-12 08:00:00", "Handoff ID": id, "Status": "Contacted", "Reason": "HUMAN_REQUESTED",
    "Phone": "+919000000002", "Ref": "W-FLOATING", "Email Status": "SENT", "Next Follow-up": "2026-10-12 10:00:00",
    "Score": 25, "Priority": "Cold",
  }, extra);
}

function due(env) {
  const ss = env.spreadsheet;
  return env.gs.collectDueFollowUps_(ss, "2026-10-12", new env.gs.Date());
}

// Array.from: a plain array of this realm (the sandbox has its own Array, which strict deepEqual rejects).
function ids(found) { return Array.from(found.items, (it) => it.id); }

// ======================================================================
// Which leads are due
// ======================================================================

test("due today: Next Follow-up later today is included and marked 'Due today', not overdue", () => {
  const env = createEnv();
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAA1", { "Next Follow-up": "2026-10-12 18:00:00" }));
  const found = due(env);
  assert.deepEqual(ids(found), ["L-AAAAAAAAA1"]);
  assert.equal(found.items[0].overdue, false);
});

test("overdue: a follow-up date before today is included and marked overdue", () => {
  const env = createEnv();
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAA2", { "Next Follow-up": "2026-10-10 09:00:00" }));
  const it = due(env).items[0];
  assert.equal(it.id, "L-AAAAAAAAA2");
  assert.equal(it.overdue, true);
  assert.deepEqual(Array.from(it.overdueWhy), ["follow-up date has passed"]);
});

test("overdue: a New lead received more than 24 hours ago is marked overdue; a newer one is not", () => {
  const env = createEnv();
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAA3", { "Status": "New", "Received (IST)": "2026-10-11 09:00:00", "Next Follow-up": "2026-10-12 09:00:00" })); // 28 h
  add(q, lead("L-AAAAAAAAA4", { "Status": "New", "Received (IST)": "2026-10-12 08:00:00", "Next Follow-up": "2026-10-12 11:00:00" })); // 5 h
  add(q, lead("L-AAAAAAAAA5", { "Status": "Contacted", "Received (IST)": "2026-10-01 08:00:00", "Next Follow-up": "2026-10-12 11:00:00" }));
  const byId = Object.fromEntries(due(env).items.map((it) => [it.id, it]));
  assert.equal(byId["L-AAAAAAAAA3"].overdue, true);
  assert.deepEqual(Array.from(byId["L-AAAAAAAAA3"].overdueWhy), ["still New more than 24 hours after it was received"]);
  assert.equal(byId["L-AAAAAAAAA4"].overdue, false);
  assert.equal(byId["L-AAAAAAAAA5"].overdue, false); // only New leads get the 24-hour rule
});

test("future follow-up excluded (tomorrow and later)", () => {
  const env = createEnv();
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAA6", { "Next Follow-up": "2026-10-13 00:00:00" }));
  add(q, lead("L-AAAAAAAAA7", { "Next Follow-up": "2026-11-01 09:00:00" }));
  assert.deepEqual(ids(due(env)), []);
});

test("Booked and Lost excluded (any letter case), even when overdue", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  add(q, lead("L-AAAAAAAAA8", { "Status": "Booked", "Next Follow-up": "2026-10-01 09:00:00" }));
  add(q, lead("L-AAAAAAAAA9", { "Status": "Lost", "Next Follow-up": "2026-10-01 09:00:00" }));
  add(q, lead("L-AAAAAAAAB1", { "Status": "lost", "Next Follow-up": "2026-10-01 09:00:00" }));
  add(h, handoffRow("H-AAAAAAAAA1", { "Status": "Booked" }));
  add(q, lead("L-AAAAAAAAB2", { "Status": "Contacted", "Next Follow-up": "2026-10-01 09:00:00" }));
  assert.deepEqual(ids(due(env)), ["L-AAAAAAAAB2"]);
});

test("missing or invalid ID excluded; empty or unreadable Next Follow-up excluded", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  add(q, lead("", { "Next Follow-up": "2026-10-01 09:00:00" }));
  add(q, lead("L-123", { "Next Follow-up": "2026-10-01 09:00:00" }));
  add(q, lead("H-AAAAAAAAA2", { "Next Follow-up": "2026-10-01 09:00:00" })); // a Handoff ID on the leads tab
  add(h, handoffRow("L-AAAAAAAAB3")); // a Lead ID on the handoffs tab
  add(q, lead("L-AAAAAAAAB4", { "Next Follow-up": "" }));
  add(q, lead("L-AAAAAAAAB5", { "Next Follow-up": "soon" }));
  add(q, lead("L-AAAAAAAAB6", { "Next Follow-up": "2026-02-30 09:00:00" }));
  assert.deepEqual(ids(due(env)), []);
});

test("other statuses (empty, or a value the team typed before the dropdown) are not Booked/Lost, so they are included", () => {
  const env = createEnv();
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAB7", { "Status": "" }));
  add(q, lead("L-AAAAAAAAB8", { "Status": "Follow-up" }));
  const found = due(env);
  assert.deepEqual(ids(found).sort(), ["L-AAAAAAAAB7", "L-AAAAAAAAB8"]);
  assert.equal(found.items.find((it) => it.id === "L-AAAAAAAAB7").status, "(empty)");
});

test("both tabs: Qualified Leads and Handoffs are combined in one list", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  add(q, lead("L-AAAAAAAAB9"));
  add(h, handoffRow("H-AAAAAAAAA3"));
  const found = due(env);
  assert.deepEqual(ids(found).sort(), ["H-AAAAAAAAA3", "L-AAAAAAAAB9"]);
  assert.equal(found.items.find((it) => it.id === "H-AAAAAAAAA3").kind, "Handoff");
  assert.equal(found.items.find((it) => it.id === "L-AAAAAAAAB9").kind, "Qualified lead");
  assert.equal(found.tabs["Qualified Leads"], 1);
  assert.equal(found.tabs["Handoffs"], 1);
});

test("Next Follow-up stored as a Date cell (Sheets auto-conversion) is read in the spreadsheet's time zone", () => {
  const env = createEnv();
  const { q } = tabs(env);
  const istTime = (y, m, d, hh) => new Date(Date.UTC(y, m - 1, d, hh) - 330 * 60000);
  add(q, lead("L-AAAAAAAAC1", { "Next Follow-up": istTime(2026, 10, 12, 0) })); // today 00:00 IST
  add(q, lead("L-AAAAAAAAC2", { "Next Follow-up": istTime(2026, 10, 13, 0) })); // tomorrow
  const found = due(env);
  assert.deepEqual(ids(found), ["L-AAAAAAAAC1"]);
  assert.equal(found.items[0].nextFollowUp, "2026-10-12 00:00");
});

test("a lead tab that was never set up (no Next Follow-up column) is skipped, not an error", () => {
  const env = createEnv();
  oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, []);
  const found = due(env);
  assert.equal(found.items.length, 0);
  assert.match(found.tabs["Qualified Leads"], /missing columns/);
  assert.equal(found.tabs["Handoffs"], "missing tab");
});

// ======================================================================
// Order
// ======================================================================

test("order: Hot before Warm before Cold (then no priority); overdue first, then higher score, within a priority", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  add(q, lead("L-C000000001", { "Priority": "Cold", "Score": 30 }));
  add(h, handoffRow("H-B000000001", { "Priority": "Warm", "Score": 45 }));
  add(q, lead("L-A000000001", { "Priority": "Hot", "Score": 75 }));
  add(q, lead("L-A000000002", { "Priority": "Hot", "Score": 95 }));
  add(q, lead("L-A000000003", { "Priority": "Hot", "Score": 70, "Next Follow-up": "2026-10-09 09:00:00" })); // overdue
  add(q, lead("L-D000000001", { "Priority": "", "Score": "" }));
  add(q, lead("L-B000000002", { "Priority": "Warm", "Score": 65 }));
  add(q, lead("L-C000000002", { "Priority": "Cold", "Score": 99 })); // stale score: Priority still decides the group
  assert.deepEqual(ids(due(env)), ["L-A000000003", "L-A000000002", "L-A000000001", "L-B000000002", "H-B000000001", "L-C000000002", "L-C000000001", "L-D000000001"]);
});

// ======================================================================
// The digest email
// ======================================================================

test("digest: one email to TEAM_EMAILS, with every due lead's details and a direct row link", () => {
  const env = createEnv({ props: { TEAM_EMAILS: " sales@example.com, owner@example.com ,," } });
  const { q, h } = tabs(env);
  const r1 = add(q, lead("L-ABCDEF0001", {
    "Status": "New", "Received (IST)": "2026-10-10 09:15:00", "Next Follow-up": "2026-10-11 09:15:00", "Phone": "+919000000011",
    "Property": "Studio 925", "Destination": "Jaipur", "Check-in": "2026-10-15", "Check-out": "2026-10-18", "Nights": 3, "Guests": 2,
    "Score": 95, "Priority": "Hot",
  }));
  const r2 = add(h, handoffRow("H-ABCDEF0002", { "Reason": "NEEDS_FOLLOW_UP", "Phone": "+919000000022", "Next Follow-up": "2026-10-12 10:00:00" }));
  add(q, lead("L-ABCDEF0003", { "Next Follow-up": "2026-10-20 09:00:00" })); // not due

  const result = env.gs.sendFollowUpDigest();

  assert.equal(result.sent, true);
  assert.equal(result.due, 2);
  assert.equal(result.overdue, 1);
  assert.equal(result.recipients, 2);
  assert.equal(env.mails.length, 1);
  const mail = env.mails[0];
  assert.equal(mail.to, "sales@example.com,owner@example.com");
  assert.equal(mail.subject, "Lead follow-ups due 2026-10-12: 2 (1 overdue)");
  const body = mail.body;
  const qGid = env.sheets.get("Qualified Leads").getSheetId(), hGid = env.sheets.get("Handoffs").getSheetId();
  const expected = [
    "Lead follow-ups due on 2026-10-12 (India time): 2 leads, 1 overdue.",
    "Hot: 1 | Warm: 0 | Cold: 1",
    "1. OVERDUE (follow-up date has passed; still New more than 24 hours after it was received) | Hot, score 95",
    "   Qualified lead L-ABCDEF0001 | Status: New",
    "   Guest WhatsApp: +919000000011",
    "   Stay: Studio 925, Jaipur | Check-in 2026-10-15 | Check-out 2026-10-18 | 3 nights | 2 guests",
    "   Next follow-up: 2026-10-11 09:15:00 | Received: 2026-10-10 09:15:00",
    "   Row: " + SHEET_URL + "#gid=" + qGid + "&range=A" + r1,
    "2. Due today | Cold, score 25",
    "   Handoff H-ABCDEF0002 | Status: Contacted",
    "   Reason: assistant could not complete the details",
    "   Guest WhatsApp: +919000000022",
    "   Next follow-up: 2026-10-12 10:00:00 | Received: 2026-10-12 08:00:00",
    "   Row: " + SHEET_URL + "#gid=" + hGid + "&range=A" + r2,
    "Leads Sheet: " + SHEET_URL,
  ];
  for (const line of expected) assert.ok(body.split("\n").includes(line), "missing line: " + line);
  assert.ok(body.indexOf("L-ABCDEF0001") < body.indexOf("H-ABCDEF0002"));
  assert.doesNotMatch(body, /L-ABCDEF0003/);
  assert.match(body, /no status was changed and no message was sent to any guest/);
  // Counts only in the log result.
  assert.doesNotMatch(JSON.stringify(result), /\+91|L-ABCDEF|H-ABCDEF|example\.com/);
});

test("HUMAN_REQUESTED handoff reason is spelled out; missing fields are simply left out", () => {
  const env = createEnv();
  const { h } = tabs(env);
  add(h, handoffRow("H-ABCDEF0004", { "Reason": "HUMAN_REQUESTED", "Score": "", "Priority": "" }));
  env.gs.sendFollowUpDigest();
  const body = env.mails[0].body;
  assert.match(body, /Due today \| No priority\n/);
  assert.match(body, /Reason: guest asked for a team member/);
  assert.doesNotMatch(body, /Stay:|Check-in|undefined|null/);
});

test("no email when nothing is due (and the day is not marked as sent)", () => {
  const env = createEnv();
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAD1", { "Next Follow-up": "2026-10-14 09:00:00" }));
  add(q, lead("L-AAAAAAAAD2", { "Status": "Booked", "Next Follow-up": "2026-10-01 09:00:00" }));
  const result = env.gs.sendFollowUpDigest();
  assert.equal(result.sent, false);
  assert.equal(result.reason, "nothing due");
  assert.equal(result.due, 0);
  assert.equal(env.mails.length, 0);
  assert.equal(env.store.LAST_FOLLOW_UP_DIGEST, undefined);
});

test("email quota too low: nothing sent, reason reported, the day is not marked as sent", () => {
  const env = createEnv({ mailQuota: 0 });
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAD3"));
  const result = env.gs.sendFollowUpDigest();
  assert.equal(result.sent, false);
  assert.equal(result.reason, "skipped: daily email quota");
  assert.equal(result.due, 1);
  assert.equal(env.mails.length, 0);
  assert.equal(env.store.LAST_FOLLOW_UP_DIGEST, undefined);

  const two = createEnv({ mailQuota: 1, props: { TEAM_EMAILS: "a@example.com,b@example.com" } }); // 2 recipients, 1 left
  add(tabs(two).q, lead("L-AAAAAAAAD4"));
  assert.equal(two.gs.sendFollowUpDigest().reason, "skipped: daily email quota");
  assert.equal(two.mails.length, 0);
});

test("TEAM_EMAILS not set, or the send itself failing: nothing marked as sent, the reason is reported", () => {
  const noTeam = createEnv({ props: { TEAM_EMAILS: "" } });
  add(tabs(noTeam).q, lead("L-AAAAAAAAD5"));
  assert.equal(noTeam.gs.sendFollowUpDigest().reason, "skipped: TEAM_EMAILS not set");

  const down = createEnv({ mailThrows: true });
  add(tabs(down).q, lead("L-AAAAAAAAD6"));
  const r = down.gs.sendFollowUpDigest();
  assert.equal(r.sent, false);
  assert.equal(r.reason, "send failed: Error");
  assert.equal(down.store.LAST_FOLLOW_UP_DIGEST, undefined);
});

test("no duplicate reminders: one email per run, each lead once, and a second run the same day sends nothing", () => {
  const env = createEnv();
  const { q } = tabs(env);
  add(q, lead("L-AAAAAAAAE1"));
  add(q, lead("L-AAAAAAAAE1")); // the same Lead ID copied onto a second row
  add(q, lead("L-AAAAAAAAE2"));
  const first = env.gs.sendFollowUpDigest();
  assert.equal(first.sent, true);
  assert.equal(first.due, 2);
  assert.equal(env.mails.length, 1);
  assert.equal(env.mails[0].body.split("L-AAAAAAAAE1").length - 1, 1);
  assert.equal(env.store.LAST_FOLLOW_UP_DIGEST, "2026-10-12");

  const second = env.gs.sendFollowUpDigest();
  assert.equal(second.sent, false);
  assert.equal(second.reason, "already sent today");
  assert.equal(env.mails.length, 1);

  env.store.LAST_FOLLOW_UP_DIGEST = "2026-10-11"; // yesterday's digest does not block today's
  assert.equal(env.gs.sendFollowUpDigest().sent, true);
  assert.equal(env.mails.length, 2);
});

test("the digest never changes the Sheet (no status change) and never contacts a guest", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  add(q, lead("L-AAAAAAAAF1", { "Status": "New", "Received (IST)": "2026-10-09 09:00:00", "Next Follow-up": "2026-10-10 09:00:00" }));
  add(h, handoffRow("H-AAAAAAAAF2"));
  const before = JSON.stringify([q.data, h.data]);
  const result = env.gs.sendFollowUpDigest();
  assert.equal(result.sent, true);
  assert.equal(JSON.stringify([q.data, h.data]), before);
  assert.equal(typeof env.gs.UrlFetchApp, "undefined"); // no HTTP client in the sandbox: nothing could call WhatsApp/Twilio
  assert.equal(env.mails.length, 1);
  assert.equal(env.mails[0].to, "team@example.com"); // the team only
});

test("end to end with a lead written by the bot path: due once its Next Follow-up arrives", () => {
  const env = createEnv();
  postLead(env, qualifiedLead({ checkIn: "2026-10-15", checkOut: "2026-10-18", nights: 3, property: "Studio 925", ref: "W-PROP-studio-925" }));
  env.mails.length = 0; // ignore the new-lead email
  const q = env.sheets.get("Qualified Leads");
  assert.equal(env.gs.sendFollowUpDigest().reason, "nothing due"); // Next Follow-up is tomorrow
  q.setCell(2, q.headers().indexOf("Next Follow-up") + 1, "2026-10-12 09:00:00");
  const r = env.gs.sendFollowUpDigest();
  assert.equal(r.sent, true);
  assert.match(env.mails[0].body, /Due today \| Hot, score 95\n   Qualified lead L-ABCDEF0123 \| Status: New/);
});

// ======================================================================
// Daily trigger setup
// ======================================================================

test("setupFollowUpReminders: one daily trigger at about 09:30 in the project's time zone; re-running adds none", () => {
  const env = createEnv();
  const first = env.gs.setupFollowUpReminders();
  assert.equal(first.trigger, "installed");
  assert.equal(first.runsAt, "daily, about 09:30 (Asia/Kolkata)");
  assert.equal(first.teamEmailsSet, true);
  const daily = env.triggers.filter((t) => t.getHandlerFunction() === "sendFollowUpDigest");
  assert.equal(daily.length, 1);
  assert.equal(daily[0].type, "CLOCK");
  assert.equal(JSON.stringify(daily[0].clock), JSON.stringify({ hour: 9, minute: 30, everyDays: 1 })); // project time zone, not hard-coded
  const second = env.gs.setupFollowUpReminders();
  assert.equal(second.trigger, "already installed");
  assert.equal(second.duplicatesRemoved, 0);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === "sendFollowUpDigest").length, 1);
});

test("setupFollowUpReminders removes extra copies and leaves other triggers (status edit trigger) alone", () => {
  const env = createEnv();
  oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, []);
  env.gs.setupLeadStatusTracking(); // installs the onLeadStatusEdit trigger
  env.gs.setupFollowUpReminders();
  env.gs.ScriptApp.newTrigger("sendFollowUpDigest").timeBased().atHour(9).everyDays(1).create(); // duplicates made by hand
  env.gs.ScriptApp.newTrigger("sendFollowUpDigest").timeBased().atHour(18).everyDays(1).create();
  const summary = env.gs.setupFollowUpReminders();
  assert.equal(summary.duplicatesRemoved, 2);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === "sendFollowUpDigest").length, 1);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === "onLeadStatusEdit").length, 1);
});

test("setupFollowUpReminders: India time only as a fallback; another project time zone is kept and flagged", () => {
  const noTz = createEnv({ scriptTimeZone: "" });
  const s1 = noTz.gs.setupFollowUpReminders();
  assert.equal(noTz.triggers[0].clock.timeZone, "Asia/Kolkata");
  assert.equal(s1.runsAt, "daily, about 09:30 (Asia/Kolkata)");

  const london = createEnv({ scriptTimeZone: "Europe/London" });
  const s2 = london.gs.setupFollowUpReminders();
  assert.equal(london.triggers[0].clock.timeZone, undefined);
  assert.equal(s2.runsAt, "daily, about 09:30 (Europe/London)");
  assert.match(s2.note, /Asia\/Kolkata/);
});

// ======================================================================
// Shared email check (no second email system)
// ======================================================================

test("all emails share one recipient/quota check: new-lead emails and click emails respect it too", () => {
  const env = createEnv({ mailQuota: 0 });
  postLead(env);
  const q = env.sheets.get("Qualified Leads");
  assert.equal(q.cell(2, q.headers().indexOf("Email Status") + 1), "FAILED");
  env.gs.doPost({ postData: { contents: JSON.stringify({ secret: "fake-click-secret-for-tests", event: {
    event: "WhatsApp Click", status: "Lead Intent", ref: "W-FLOATING", cta: "floating", page: "/", site: "example.com",
    receivedAt: "2026-10-12T07:29:59.000Z", context: {} } }) } });
  assert.equal(env.sheets.get("WhatsApp Clicks").cell(2, 18), "skipped: daily email quota");
  assert.equal(env.mails.length, 0);
  assert.equal(JSON.stringify(env.gs.teamMailCheck_(env.gs.PropertiesService.getScriptProperties())), JSON.stringify({ send: false, reason: "skipped: daily email quota" }));
});

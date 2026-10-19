// Week 6, Step 1: lead status tracking in apps-script/Code.gs.
// Harness (fake Google services, fixed clock 2026-10-12 13:00 IST): tests/helpers/apps-script-env.mjs.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IST_NOW, IST_PLUS_1D, IST_PLUS_2D, SECRET, SHEET_ID, OLD_QUALIFIED_HEADERS, OLD_HANDOFF_HEADERS, createEnv, qualifiedLead, handoff, post, postLead, postHandoff, rowObject, col, editEvent, oldLayoutTab, oldQualifiedRow,
} from "../helpers/apps-script-env.mjs";

// ======================================================================
// Header structure
// ======================================================================

test("headers: Status stays in column C; Email Status stays in column T; the two new columns follow it", () => {
  const { gs } = createEnv();
  assert.equal(gs.QUALIFIED_HEADERS.length, 24); // + Score and Priority (Step 2, see lead-score.test.mjs)
  // Handoffs: + Guest Name and Booking Code (Guest Escalation leads), appended at the end.
  assert.equal(gs.HANDOFF_HEADERS.length, 26);
  assert.equal(JSON.stringify(gs.HANDOFF_HEADERS.slice(24)), JSON.stringify(["Guest Name", "Booking Code"]));
  for (const headers of [gs.QUALIFIED_HEADERS, gs.HANDOFF_HEADERS]) {
    assert.equal(headers[2], "Status");
    assert.equal(headers[19], "Email Status");
    assert.equal(headers[20], "Status Updated (IST)");
    assert.equal(headers[21], "Next Follow-up");
  }
  assert.equal(JSON.stringify(gs.QUALIFIED_HEADERS.slice(0, 20)), JSON.stringify(OLD_QUALIFIED_HEADERS));
  assert.equal(JSON.stringify(gs.HANDOFF_HEADERS.slice(0, 20)), JSON.stringify(OLD_HANDOFF_HEADERS));
  assert.equal(JSON.stringify(gs.LEAD_STATUSES), JSON.stringify(["New", "Contacted", "Booked", "Lost"]));
  assert.equal(gs.HEADERS.length, 18); // WhatsApp Clicks tab unchanged
});

test("follow-up rule: New +1 day, Contacted +2 days, Booked/Lost/other none", () => {
  const { gs } = createEnv();
  const now = new gs.Date();
  assert.equal(gs.nextFollowUpFor_("New", now), IST_PLUS_1D);
  assert.equal(gs.nextFollowUpFor_("Contacted", now), IST_PLUS_2D);
  assert.equal(gs.nextFollowUpFor_("Booked", now), "");
  assert.equal(gs.nextFollowUpFor_("Lost", now), "");
  assert.equal(gs.nextFollowUpFor_("Follow-up", now), "");
  assert.equal(gs.nextFollowUpFor_("Won", now), "");
  assert.equal(gs.canonicalStatus_(" contacted "), "Contacted");
  assert.equal(gs.canonicalStatus_("BOOKED"), "Booked");
  assert.equal(gs.canonicalStatus_("Follow-up"), "");
  assert.equal(gs.canonicalStatus_("Won"), "");
  assert.equal(gs.canonicalStatus_(""), "");
});

// ======================================================================
// New leads
// ======================================================================

test("new qualified lead: Status New, Status Updated now, Next Follow-up +1 day, dropdown on the Status cell", () => {
  const env = createEnv();
  const res = postLead(env);
  assert.equal(res.ok, true);
  assert.equal(res.stored, true);
  assert.equal(res.emailStatus, "SENT");
  const s = env.sheets.get("Qualified Leads");
  assert.equal(JSON.stringify(s.headers()), JSON.stringify(env.gs.QUALIFIED_HEADERS));
  const row = rowObject(s, 2);
  assert.equal(row["Lead ID"], "L-ABCDEF0123");
  assert.equal(row["Status"], "New");
  assert.equal(row["Status Updated (IST)"], IST_NOW);
  assert.equal(row["Next Follow-up"], IST_PLUS_1D);
  assert.equal(row["Received (IST)"], IST_NOW);
  assert.equal(row["Email Status"], "SENT");
  assert.equal(row["Nights"], 3);
  assert.equal(row["Destination"], "Jaipur");
  const rule = s.validations.get("2,3");
  assert.ok(rule, "dropdown on C2");
  assert.equal(JSON.stringify(rule.list), JSON.stringify(["New", "Contacted", "Booked", "Lost"]));
  assert.equal(rule.showDropdown, true);
  assert.equal(rule.allowInvalid, false);
  assert.equal(env.mails.length, 1);
});

test("new handoff: same status defaults; Email Status written to its own column", () => {
  const env = createEnv();
  const res = postHandoff(env);
  assert.equal(res.ok, true);
  const s = env.sheets.get("Handoffs");
  assert.equal(JSON.stringify(s.headers()), JSON.stringify(env.gs.HANDOFF_HEADERS));
  const row = rowObject(s, 2);
  assert.equal(row["Handoff ID"], "H-ABCDEF0123");
  assert.equal(row["Reason"], "HUMAN_REQUESTED");
  assert.equal(row["Status"], "New");
  assert.equal(row["Status Updated (IST)"], IST_NOW);
  assert.equal(row["Next Follow-up"], IST_PLUS_1D);
  assert.equal(row["Email Status"], "SENT");
  assert.equal(s.cell(2, 20), "SENT"); // column T, not the last column (V)
  assert.equal(s.cell(2, 22), IST_PLUS_1D);
});

test("email failure: FAILED lands in Email Status, the follow-up columns are untouched", () => {
  const env = createEnv({ mailThrows: true });
  const res = postLead(env);
  assert.equal(res.emailStatus, "FAILED");
  const s = env.sheets.get("Qualified Leads");
  assert.equal(s.cell(2, col(s, "Email Status")), "FAILED");
  assert.equal(s.cell(2, col(s, "Status Updated (IST)")), IST_NOW);
  assert.equal(s.cell(2, col(s, "Next Follow-up")), IST_PLUS_1D);
});

test("existing Week 5 tab (20 columns): new columns are appended, old rows untouched, values land by header name", () => {
  const env = createEnv();
  const s = oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, [oldQualifiedRow("L-0000000001", "New", "2026-10-08 23:30:00")]);
  const before = JSON.stringify(s.data[1]);
  const res = postLead(env);
  assert.equal(res.stored, true);
  assert.equal(JSON.stringify(s.headers()), JSON.stringify(env.gs.QUALIFIED_HEADERS));
  assert.equal(JSON.stringify(s.data[1]), before); // existing row unchanged
  const row = rowObject(s, 3);
  assert.equal(row["Lead ID"], "L-ABCDEF0123");
  assert.equal(row["Email Status"], "SENT");
  assert.equal(s.cell(3, 20), "SENT");
  assert.equal(row["Status Updated (IST)"], IST_NOW);
  assert.equal(row["Next Follow-up"], IST_PLUS_1D);
});

test("team-added column after Email Status is respected: nothing is written into it", () => {
  const env = createEnv();
  const s = oldLayoutTab(env, "Handoffs", OLD_HANDOFF_HEADERS.concat(["Team Notes"]), []);
  postHandoff(env);
  assert.equal(JSON.stringify(s.headers()), JSON.stringify(OLD_HANDOFF_HEADERS.concat(["Team Notes", "Status Updated (IST)", "Next Follow-up", "Score", "Priority", "Guest Name", "Booking Code"])));
  const row = rowObject(s, 2);
  assert.equal(row["Team Notes"], "");
  assert.equal(row["Email Status"], "SENT");
  assert.equal(s.cell(2, 20), "SENT");
  assert.equal(row["Status Updated (IST)"], IST_NOW);
  assert.equal(row["Next Follow-up"], IST_PLUS_1D);
});

test("duplicate Lead ID: no second row, no second email", () => {
  const env = createEnv();
  postLead(env);
  const again = postLead(env);
  assert.equal(again.duplicate, true);
  const s = env.sheets.get("Qualified Leads");
  assert.equal(s.getLastRow(), 2);
  assert.equal(env.mails.length, 1);
});

test("diagnostic dry run writes no lead row and sends no email", () => {
  const env = createEnv();
  const res = JSON.parse(env.gs.handleBotLead_({ secret: SECRET, type: "qualified_lead", lead: qualifiedLead() }, env.gs.PropertiesService.getScriptProperties(), { dryRun: true }).getContent());
  assert.equal(res.dryRun, true);
  assert.equal(env.sheets.get("Qualified Leads").getLastRow(), 1); // header row only
  assert.equal(env.mails.length, 0);
});

// ======================================================================
// Manual status changes (onLeadStatusEdit)
// ======================================================================

function tabWithLead(env) {
  postLead(env);
  return env.sheets.get("Qualified Leads");
}

test("status change -> Status Updated stamped and Next Follow-up set by the status rules", () => {
  const cases = [["Contacted", IST_PLUS_2D], ["Booked", ""], ["Lost", ""], ["New", IST_PLUS_1D]];
  for (const [status, next] of cases) {
    const env = createEnv();
    const s = tabWithLead(env);
    s.setCell(2, col(s, "Status Updated (IST)"), "2026-10-01 09:00:00");
    s.setCell(2, col(s, "Next Follow-up"), "2026-10-02 09:00:00");
    const old = status === "New" ? "Contacted" : "New";
    s.setCell(2, 3, status); // what the user picked
    env.gs.onLeadStatusEdit(editEvent(s, 2, 3, old));
    assert.equal(s.cell(2, col(s, "Status Updated (IST)")), IST_NOW, status);
    assert.equal(s.cell(2, col(s, "Next Follow-up")), next, status);
  }
});

test("status edits that must NOT change anything", () => {
  const env = createEnv();
  const s = tabWithLead(env);
  const upd = col(s, "Status Updated (IST)"), nxt = col(s, "Next Follow-up");
  const reset = () => { s.setCell(2, upd, "2026-10-01 09:00:00"); s.setCell(2, nxt, "2026-10-02 09:00:00"); };
  const unchanged = (why) => {
    assert.equal(s.cell(2, upd), "2026-10-01 09:00:00", why);
    assert.equal(s.cell(2, nxt), "2026-10-02 09:00:00", why);
  };

  reset(); s.setCell(2, 3, "Contacted"); env.gs.onLeadStatusEdit(editEvent(s, 2, 3, "Contacted")); unchanged("same value re-selected");
  reset(); s.setCell(2, 3, "Follow-up"); env.gs.onLeadStatusEdit(editEvent(s, 2, 3, "New")); unchanged("not a milestone status");
  reset(); s.setCell(2, 3, "Won"); env.gs.onLeadStatusEdit(editEvent(s, 2, 3, "New")); unchanged("Won is not a status");
  reset(); s.setCell(2, 3, ""); env.gs.onLeadStatusEdit(editEvent(s, 2, 3, "New")); unchanged("cleared cell");
  reset(); s.setCell(2, 3, "Contacted"); env.gs.onLeadStatusEdit(editEvent(s, 2, 11, "x")); unchanged("another column edited");
  reset(); env.gs.onLeadStatusEdit(editEvent(s, 1, 3, "Status")); unchanged("header row");
  reset(); env.gs.onLeadStatusEdit(null); env.gs.onLeadStatusEdit({}); unchanged("no event");

  // A row without a Lead ID (e.g. a status picked on an empty row) is ignored.
  s.setCell(5, 3, "Contacted");
  env.gs.onLeadStatusEdit(editEvent(s, 5, 3, ""));
  assert.equal(s.cell(5, upd), "");
  assert.equal(s.cell(5, nxt), "");
});

test("WhatsApp Clicks tab (its own Status column) is never touched by the trigger", () => {
  const env = createEnv();
  const clicks = env.spreadsheet.insertSheet("WhatsApp Clicks");
  clicks.appendRow(env.gs.HEADERS);
  clicks.appendRow(["2026-10-12 12:00:00", "Contacted", "W-FLOATING"]);
  const before = JSON.stringify(clicks.data);
  env.gs.onLeadStatusEdit(editEvent(clicks, 2, 2, "Lead Intent"));
  assert.equal(JSON.stringify(clicks.data), before);

  // Even a team-made tab with the same columns (e.g. an archive copy) is left alone: only the two lead tabs count.
  const archive = env.spreadsheet.insertSheet("Qualified Leads (archive)");
  archive.appendRow(env.gs.QUALIFIED_HEADERS);
  archive.appendRow(["2026-10-01 10:00:00", "L-0000000009", "Contacted"]);
  const archived = JSON.stringify(archive.data);
  env.gs.onLeadStatusEdit(editEvent(archive, 2, 3, "New"));
  assert.equal(JSON.stringify(archive.data), archived);
});

test("lower-case status is normalised; a pasted block updates every lead row in it", () => {
  const env = createEnv();
  postLead(env);
  postLead(env, qualifiedLead({ leadId: "L-ABCDEF0124" }));
  postLead(env, qualifiedLead({ leadId: "L-ABCDEF0125" }));
  const s = env.sheets.get("Qualified Leads");
  s.setCell(2, 3, "contacted");
  s.setCell(3, 3, "Booked");
  s.setCell(4, 3, "Lost");
  env.gs.onLeadStatusEdit(editEvent(s, 2, 3, undefined, 3, 1)); // multi-cell paste: no oldValue
  assert.equal(s.cell(2, 3), "Contacted");
  assert.equal(s.cell(2, col(s, "Next Follow-up")), IST_PLUS_2D);
  assert.equal(s.cell(3, col(s, "Next Follow-up")), "");
  assert.equal(s.cell(4, col(s, "Next Follow-up")), "");
  for (const r of [2, 3, 4]) assert.equal(s.cell(r, col(s, "Status Updated (IST)")), IST_NOW);
});

test("trigger does nothing on a tab that was never set up (no new columns yet)", () => {
  const env = createEnv();
  const s = oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, [oldQualifiedRow("L-0000000001", "Contacted", "2026-10-08 23:30:00")]);
  const before = JSON.stringify(s.data);
  env.gs.onLeadStatusEdit(editEvent(s, 2, 3, "New"));
  assert.equal(JSON.stringify(s.data), before);
});

// ======================================================================
// One-time setup
// ======================================================================

test("setupLeadStatusTracking on the existing Week 5 tabs: columns, dropdown, defaults, backfill, trigger", () => {
  const env = createEnv();
  const q = oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, [
    oldQualifiedRow("L-0000000001", "New", "2026-10-08 23:30:00"),
    oldQualifiedRow("L-0000000002", "", "2026-10-09 10:00:00"),
    oldQualifiedRow("L-0000000003", "Contacted", "2026-10-09 11:00:00"),
    oldQualifiedRow("L-0000000004", "booked", "2026-10-09 12:00:00"),
    oldQualifiedRow("L-0000000005", "Follow-up", "2026-10-09 13:00:00"),
  ]);
  const h = oldLayoutTab(env, "Handoffs", OLD_HANDOFF_HEADERS, []);

  const summary = env.gs.setupLeadStatusTracking();

  assert.equal(JSON.stringify(q.headers()), JSON.stringify(env.gs.QUALIFIED_HEADERS));
  assert.equal(JSON.stringify(h.headers()), JSON.stringify(env.gs.HANDOFF_HEADERS));
  const upd = col(q, "Status Updated (IST)"), nxt = col(q, "Next Follow-up");

  // L-1: New, keeps its status; dates backfilled from Received (IST).
  assert.equal(q.cell(2, 3), "New");
  assert.equal(q.cell(2, upd), "2026-10-08 23:30:00");
  assert.equal(q.cell(2, nxt), "2026-10-09 23:30:00");
  // L-2: empty Status -> New, same backfill.
  assert.equal(q.cell(3, 3), "New");
  assert.equal(q.cell(3, upd), "2026-10-09 10:00:00");
  assert.equal(q.cell(3, nxt), "2026-10-10 10:00:00");
  // L-3: Contacted, change time unknown -> Status Updated left empty, follow-up 2 days from now.
  assert.equal(q.cell(4, 3), "Contacted");
  assert.equal(q.cell(4, upd), "");
  assert.equal(q.cell(4, nxt), IST_PLUS_2D);
  // L-4: "booked" normalised to Booked, no follow-up.
  assert.equal(q.cell(5, 3), "Booked");
  assert.equal(q.cell(5, nxt), "");
  // L-5: not a milestone status -> left exactly as it is, reported.
  assert.equal(q.cell(6, 3), "Follow-up");
  assert.equal(q.cell(6, upd), "");
  assert.equal(q.cell(6, nxt), "");
  // Email Status values were not moved.
  for (const r of [2, 3, 4, 5, 6]) assert.equal(q.cell(r, 20), "SENT");

  // Dropdown on every data row of both tabs.
  for (const s of [q, h]) {
    assert.ok(s.validations.get("2,3"));
    assert.ok(s.validations.get("1000,3"));
    assert.equal(s.validations.get("1,3"), undefined); // never on the header
    assert.equal(s.validations.has("2,2"), false);
  }

  const qs = summary.tabs["Qualified Leads"];
  assert.equal(JSON.stringify(qs), JSON.stringify({ rows: 5, setToNew: 1, normalised: 1, invalid: 1, statusUpdatedFilled: 2, followUpsSet: 3, followUpsCleared: 0 }));
  assert.equal(summary.tabs["Handoffs"].rows, 0);
  assert.equal(summary.trigger, "installed");
  assert.equal(env.triggers.length, 1);
  assert.equal(env.triggers[0].getHandlerFunction(), "onLeadStatusEdit");
  assert.equal(env.triggers[0].getTriggerSourceId(), SHEET_ID);
  assert.equal(env.triggers[0].type, "ON_EDIT");
  assert.doesNotMatch(JSON.stringify(summary), /\+91|L-0000/); // counts only
});

test("setupLeadStatusTracking is safe to re-run: no duplicate trigger or column, filled dates kept, Booked/Lost cleared", () => {
  const env = createEnv();
  const q = oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, [oldQualifiedRow("L-0000000001", "New", "2026-10-08 23:30:00")]);
  env.gs.setupLeadStatusTracking();
  const nxt = col(q, "Next Follow-up");
  q.setCell(2, nxt, "2026-10-20 10:00:00"); // the team moved the date by hand
  q.setCell(3, 2, "L-0000000002");
  q.setCell(3, 3, "Lost");
  q.setCell(3, nxt, "2026-10-21 10:00:00");
  const second = env.gs.setupLeadStatusTracking();
  assert.equal(second.trigger, "already installed");
  assert.equal(env.triggers.length, 1);
  assert.equal(q.headers().length, 24);
  assert.equal(q.cell(2, nxt), "2026-10-20 10:00:00");
  assert.equal(q.cell(3, nxt), "");
  assert.equal(second.tabs["Qualified Leads"].followUpsCleared, 1);
});

test("setupLeadStatusTracking creates missing lead tabs with the full header row", () => {
  const env = createEnv();
  env.gs.setupLeadStatusTracking();
  assert.equal(JSON.stringify(env.sheets.get("Qualified Leads").headers()), JSON.stringify(env.gs.QUALIFIED_HEADERS));
  assert.equal(JSON.stringify(env.sheets.get("Handoffs").headers()), JSON.stringify(env.gs.HANDOFF_HEADERS));
  assert.equal(env.sheets.get("Qualified Leads").frozenRows, 1);
});

// ======================================================================
// Unchanged flows
// ======================================================================

test("click logging is unchanged: 18 columns, Lead Intent status, email status in its last column", () => {
  const env = createEnv();
  const res = post(env, {
    secret: "fake-click-secret-for-tests",
    event: { event: "WhatsApp Click", status: "Lead Intent", ref: "W-FLOATING", cta: "floating", page: "/", site: "example.com",
      receivedAt: "2026-10-12T07:29:59.000Z", context: {} },
  });
  assert.equal(res.ok, true);
  const s = env.sheets.get("WhatsApp Clicks");
  assert.equal(s.headers().length, 18);
  assert.equal(s.cell(2, 2), "Lead Intent");
  assert.equal(s.cell(2, 18), "sent");
  assert.equal(s.validations.size, 0);
});

test("wrong secret is still rejected before anything is written", () => {
  const env = createEnv();
  const res = post(env, { secret: "wrong", type: "qualified_lead", lead: qualifiedLead() });
  assert.equal(res.ok, false);
  assert.equal(res.code, "AUTH");
  assert.equal(env.sheets.size, 0);
});

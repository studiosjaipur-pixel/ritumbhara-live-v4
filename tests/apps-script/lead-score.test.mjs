// Week 6, Step 2: simple lead scoring in apps-script/Code.gs.
// Harness (fake Google services, fixed clock 2026-10-12 13:00 IST): tests/helpers/apps-script-env.mjs.
// "Today" in India is 2026-10-12 for every test below.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IST_NOW, IST_PLUS_1D, OLD_QUALIFIED_HEADERS, OLD_HANDOFF_HEADERS, createEnv, qualifiedLead, handoff, postLead, postHandoff,
  rowObject, col, oldLayoutTab,
} from "../helpers/apps-script-env.mjs";

const TODAY = "2026-10-12";
const { gs } = createEnv(); // pure functions only; the integration tests create their own environment

// A lead that matches no rule at all (score 0), so each test switches on exactly the rule it checks.
function blank(overrides = {}) {
  return Object.assign({ qualified: false, reason: null, checkIn: null, checkOut: null, nights: null, property: null, ref: "DIRECT" }, overrides);
}

function score(overrides) { return gs.scoreLead_(blank(overrides), TODAY).score; }

// ======================================================================
// Every scoring rule, one at a time
// ======================================================================

test("no rule applies -> 0", () => {
  const r = gs.scoreLead_(blank(), TODAY);
  assert.equal(r.score, 0);
  assert.equal(r.priority, "Cold");
  assert.equal(r.reasons.length, 0);
});

test("rule: qualified lead +40", () => {
  assert.equal(score({ qualified: true }), 40);
  assert.equal(score({ qualified: true, reason: "HUMAN_REQUESTED" }), 40); // a qualified lead is never also a handoff
});

test("rule: HUMAN_REQUESTED handoff +25, NEEDS_FOLLOW_UP handoff +10, any other reason 0", () => {
  assert.equal(score({ reason: "HUMAN_REQUESTED" }), 25);
  assert.equal(score({ reason: "NEEDS_FOLLOW_UP" }), 10);
  assert.equal(score({ reason: "SOMETHING_ELSE" }), 0);
  assert.equal(score({ reason: "" }), 0);
});

test("rule: check-in within 7 days +20 (today = day 0, day 7 included)", () => {
  assert.equal(score({ checkIn: "2026-10-12" }), 20); // today
  assert.equal(score({ checkIn: "2026-10-13" }), 20);
  assert.equal(score({ checkIn: "2026-10-19" }), 20); // day 7
});

test("rule: check-in within 30 days +10 (days 8 to 30); the 7-day and 30-day rules never add up", () => {
  assert.equal(score({ checkIn: "2026-10-20" }), 10); // day 8
  assert.equal(score({ checkIn: "2026-11-11" }), 10); // day 30
  assert.equal(score({ checkIn: "2026-11-12" }), 0); // day 31
  assert.equal(score({ checkIn: "2027-03-01" }), 0);
  assert.equal(score({ checkIn: "2026-10-15" }), 20); // not 30
});

test("rule: both check-in and check-out given +10 (one alone does not count)", () => {
  assert.equal(score({ checkIn: "2027-01-10", checkOut: "2027-01-12" }), 10);
  assert.equal(score({ checkIn: "2027-01-10" }), 0);
  assert.equal(score({ checkOut: "2027-01-12" }), 0);
});

test("rule: specific property given +10 (empty or blank text does not count)", () => {
  assert.equal(score({ property: "Studio 925" }), 10);
  assert.equal(score({ property: "" }), 0);
  assert.equal(score({ property: "   " }), 0);
  assert.equal(score({ property: null }), 0);
});

test("rule: 3 or more nights +10", () => {
  assert.equal(score({ nights: 3 }), 10);
  assert.equal(score({ nights: 14 }), 10);
  assert.equal(score({ nights: 2 }), 0);
  assert.equal(score({ nights: "3" }), 10); // as read back from a Sheet cell
  assert.equal(score({ nights: "" }), 0);
  assert.equal(score({ nights: null }), 0);
});

test("rule: property or availability Ref +5", () => {
  assert.equal(score({ ref: "W-PROP-studio-925" }), 5);
  assert.equal(score({ ref: "W-HOME-AVAILABILITY" }), 5);
  assert.equal(score({ ref: "W-DEST-jaipur-AVAILABILITY" }), 5);
  assert.equal(score({ ref: "W-PAGE-stays-in-sariska-AVAILABILITY" }), 5);
  assert.equal(score({ ref: "W-FLOATING" }), 0);
  assert.equal(score({ ref: "W-CONTACT" }), 0);
  assert.equal(score({ ref: "DIRECT" }), 0);
  assert.equal(score({ ref: "W-PROP-" }), 0); // no property slug
  assert.equal(score({ ref: "" }), 0);
});

test("rule: check-in already passed -> score 0, whatever else applies", () => {
  const r = gs.scoreLead_(blank({
    qualified: true, checkIn: "2026-10-11", checkOut: "2026-10-15", nights: 4, property: "Studio 925", ref: "W-PROP-studio-925",
  }), TODAY);
  assert.equal(r.score, 0);
  assert.equal(r.priority, "Cold");
  assert.equal(JSON.stringify(r.reasons), JSON.stringify(["Check-in has already passed: score 0"]));
  assert.equal(score({ reason: "HUMAN_REQUESTED", checkIn: "2025-12-31" }), 0);
});

test("an invalid or missing date counts as not given (never as passed)", () => {
  assert.equal(score({ qualified: true, checkIn: "2026-02-30", checkOut: "2026-03-02" }), 40);
  assert.equal(score({ qualified: true, checkIn: "12 Oct", checkOut: "" }), 40);
  assert.equal(score({ qualified: true, checkIn: "not given" }), 40);
});

test("rules combine: the best possible lead scores 95 and lists every reason", () => {
  const r = gs.scoreLead_(blank({
    qualified: true, checkIn: "2026-10-15", checkOut: "2026-10-18", nights: 3, property: "Studio 925", ref: "W-PROP-studio-925",
  }), TODAY);
  assert.equal(r.score, 95);
  assert.equal(r.priority, "Hot");
  assert.equal(JSON.stringify(r.reasons), JSON.stringify([
    "Qualified lead +40", "Check-in within 7 days +20", "Check-in and check-out given +10", "Specific property +10",
    "3 or more nights +10", "Property/availability Ref +5",
  ]));
});

test("deterministic: same input, same output; the input is not changed", () => {
  const lead = blank({ reason: "NEEDS_FOLLOW_UP", checkIn: "2026-10-25", checkOut: "2026-10-26", nights: 1 });
  const before = JSON.stringify(lead);
  const a = gs.scoreLead_(lead, TODAY), b = gs.scoreLead_(lead, TODAY);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(lead), before);
  assert.equal(a.score, 30); // 10 + 10 + 10
});

// ======================================================================
// Priority boundaries
// ======================================================================

test("priority bands: 70-100 Hot, 40-69 Warm, below 40 Cold (every boundary)", () => {
  const cases = [[100, "Hot"], [95, "Hot"], [71, "Hot"], [70, "Hot"], [69, "Warm"], [41, "Warm"], [40, "Warm"],
    [39, "Cold"], [1, "Cold"], [0, "Cold"]];
  for (const [s, p] of cases) assert.equal(gs.priorityFor_(s), p, String(s));
});

test("priority boundaries reached through real rule combinations", () => {
  const at = (o) => gs.scoreLead_(blank(o), TODAY);
  // 70 = qualified 40 + within 7 days 20 + both dates 10 -> Hot
  assert.deepEqual([at({ qualified: true, checkIn: "2026-10-14", checkOut: "2026-10-15" }).score, at({ qualified: true, checkIn: "2026-10-14", checkOut: "2026-10-15" }).priority], [70, "Hot"]);
  // 65 = qualified 40 + within 30 days 10 + both dates 10 + availability Ref 5 -> Warm
  assert.deepEqual([at({ qualified: true, checkIn: "2026-10-30", checkOut: "2026-10-31", ref: "W-HOME-AVAILABILITY" }).score, at({ qualified: true, checkIn: "2026-10-30", checkOut: "2026-10-31", ref: "W-HOME-AVAILABILITY" }).priority], [65, "Warm"]);
  // 40 = qualified alone -> Warm
  assert.deepEqual([at({ qualified: true }).score, at({ qualified: true }).priority], [40, "Warm"]);
  // 35 = HUMAN_REQUESTED 25 + property 10 -> Cold
  assert.deepEqual([at({ reason: "HUMAN_REQUESTED", property: "Studio 925" }).score, at({ reason: "HUMAN_REQUESTED", property: "Studio 925" }).priority], [35, "Cold"]);
});

// ======================================================================
// Score written with every new lead / handoff
// ======================================================================

test("new qualified lead: Score and Priority written; Step 1 columns unchanged", () => {
  const env = createEnv();
  postLead(env); // fixture: check-in 2026-12-10 (59 days), check-out, 3 nights, no property, Ref DIRECT -> 40 + 10 + 10
  const s = env.sheets.get("Qualified Leads");
  assert.equal(JSON.stringify(s.headers()), JSON.stringify(env.gs.QUALIFIED_HEADERS));
  assert.equal(col(s, "Score"), 23);
  assert.equal(col(s, "Priority"), 24);
  const row = rowObject(s, 2);
  assert.equal(row["Score"], 60);
  assert.equal(row["Priority"], "Warm");
  assert.equal(row["Status"], "New");
  assert.equal(row["Status Updated (IST)"], IST_NOW);
  assert.equal(row["Next Follow-up"], IST_PLUS_1D);
  assert.equal(row["Email Status"], "SENT");
  assert.equal(s.cell(2, 20), "SENT");
});

test("new hot lead: property page Ref, check-in in 3 days -> 95 Hot", () => {
  const env = createEnv();
  postLead(env, qualifiedLead({ checkIn: "2026-10-15", checkOut: "2026-10-18", nights: 3, property: "Studio 925", ref: "W-PROP-studio-925" }));
  const row = rowObject(env.sheets.get("Qualified Leads"), 2);
  assert.equal(row["Score"], 95);
  assert.equal(row["Priority"], "Hot");
});

test("new handoffs: HUMAN_REQUESTED and NEEDS_FOLLOW_UP scored from their own fields", () => {
  const env = createEnv();
  postHandoff(env); // HUMAN_REQUESTED, no details, Ref W-FLOATING -> 25
  postHandoff(env, handoff({
    handoffId: "H-ABCDEF0124", reason: "NEEDS_FOLLOW_UP", checkIn: "2026-10-20", checkOut: "2026-10-22", nights: 2, ref: "W-DEST-jaipur-AVAILABILITY",
  })); // 10 + 10 (day 8) + 10 + 5
  const s = env.sheets.get("Handoffs");
  assert.equal(JSON.stringify(s.headers()), JSON.stringify(env.gs.HANDOFF_HEADERS));
  assert.deepEqual([rowObject(s, 2)["Score"], rowObject(s, 2)["Priority"]], [25, "Cold"]);
  assert.deepEqual([rowObject(s, 3)["Score"], rowObject(s, 3)["Priority"]], [35, "Cold"]);
  assert.equal(s.cell(2, 20), "SENT"); // Email Status still in its own column
});

test("existing Week 5 tab: Score and Priority are appended after the Step 1 columns, old rows untouched", () => {
  const env = createEnv();
  const s = oldLayoutTab(env, "Handoffs", OLD_HANDOFF_HEADERS, []);
  postHandoff(env);
  assert.equal(JSON.stringify(s.headers()), JSON.stringify(OLD_HANDOFF_HEADERS.concat(["Status Updated (IST)", "Next Follow-up", "Score", "Priority"])));
  assert.equal(rowObject(s, 2)["Score"], 25);
});

// ======================================================================
// recalculateLeadScores (on demand, open leads only)
// ======================================================================

// A pre-Week 6 qualified row with the given status / dates / property / Ref.
function oldRow(id, status, checkIn, checkOut, nights, property = "", ref = "DIRECT") {
  return ["2026-10-01 10:00:00", id, status, "+919000000003", "Jaipur", property, checkIn, checkOut, nights, 2, "", ref, "whatsapp-bot",
    "HANDED_OFF", "QUALIFIED", "example.com", "2026-10-01T04:30:00.000Z", "+91 9000000009", "", "SENT"];
}

test("recalculateLeadScores: open leads (New, Contacted, empty) re-scored; Booked, Lost and other statuses left alone", () => {
  const env = createEnv();
  const q = oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, [
    oldRow("L-0000000001", "New", "2026-10-15", "2026-10-18", 3, "Studio 925", "W-PROP-studio-925"), // 95 Hot
    oldRow("L-0000000002", "Contacted", "2026-11-01", "2026-11-02", 1), // 40 + 10 + 10 = 60 Warm
    oldRow("L-0000000003", "", "2026-10-10", "2026-10-12", 2), // check-in passed -> 0 Cold
    oldRow("L-0000000004", "Booked", "2026-10-15", "2026-10-18", 3),
    oldRow("L-0000000005", "Lost", "2026-10-15", "2026-10-18", 3),
    oldRow("L-0000000006", "Follow-up", "2026-10-15", "2026-10-18", 3),
  ]);
  const summary = env.gs.recalculateLeadScores();

  assert.equal(JSON.stringify(q.headers()), JSON.stringify(env.gs.QUALIFIED_HEADERS));
  const sc = col(q, "Score"), pr = col(q, "Priority");
  assert.deepEqual([q.cell(2, sc), q.cell(2, pr)], [95, "Hot"]);
  assert.deepEqual([q.cell(3, sc), q.cell(3, pr)], [60, "Warm"]);
  assert.deepEqual([q.cell(4, sc), q.cell(4, pr)], [0, "Cold"]);
  for (const r of [5, 6, 7]) assert.deepEqual([q.cell(r, sc), q.cell(r, pr)], ["", ""], "row " + r + " not scored");
  // Status columns are not touched by scoring.
  assert.deepEqual([2, 3, 4, 5, 6, 7].map((r) => q.cell(r, 3)), ["New", "Contacted", "", "Booked", "Lost", "Follow-up"]);
  assert.deepEqual([2, 3, 4].map((r) => q.cell(r, col(q, "Next Follow-up"))), ["", "", ""]);

  assert.equal(JSON.stringify(summary.tabs["Qualified Leads"]), JSON.stringify({ open: 3, notOpen: 3, hot: 1, warm: 1, cold: 1 }));
  assert.equal(JSON.stringify(summary.tabs["Handoffs"]), JSON.stringify({ missing: true }));
  assert.equal(summary.today, "2026-10-12");
  assert.doesNotMatch(JSON.stringify(summary), /\+91|L-0000/); // counts only
});

test("recalculateLeadScores: a closed lead keeps its previous score; re-running gives the same result", () => {
  const env = createEnv();
  postLead(env, qualifiedLead({ checkIn: "2026-10-15", checkOut: "2026-10-18", nights: 3 }));
  const q = env.sheets.get("Qualified Leads");
  const sc = col(q, "Score"), pr = col(q, "Priority");
  q.setCell(2, 3, "Booked");
  q.setCell(2, sc, 70);
  env.gs.recalculateLeadScores();
  assert.deepEqual([q.cell(2, sc), q.cell(2, pr)], [70, "Hot"]);
  q.setCell(2, 3, "Contacted");
  const first = JSON.stringify(env.gs.recalculateLeadScores().tabs);
  const after1 = JSON.stringify(q.data);
  const second = JSON.stringify(env.gs.recalculateLeadScores().tabs);
  assert.equal(first, second);
  assert.equal(JSON.stringify(q.data), after1);
  assert.deepEqual([q.cell(2, sc), q.cell(2, pr)], [80, "Hot"]); // 40 + 20 + 10 + 10 (3 nights)
});

test("recalculateLeadScores reads dates the Sheet turned into Date cells, and handoff reasons", () => {
  const env = createEnv();
  const h = oldLayoutTab(env, "Handoffs", OLD_HANDOFF_HEADERS, []);
  const istMidnight = (y, m, d) => new Date(Date.UTC(y, m - 1, d) - 330 * 60000); // how Sheets stores a date typed in IST
  h.appendRow(["2026-10-11 09:00:00", "H-0000000001", "New", "HUMAN_REQUESTED", "+919000000004", "Jaipur", "",
    istMidnight(2026, 10, 14), istMidnight(2026, 10, 16), 2, 2, "", "W-HOME-AVAILABILITY", "whatsapp-bot", "HANDED_OFF",
    "NOT_QUALIFIED", "example.com", "2026-10-11T03:30:00.000Z", "+91 9000000009", "SENT"]);
  h.appendRow(["2026-10-11 09:05:00", "H-0000000002", "New", "NEEDS_FOLLOW_UP", "+919000000005", "", "",
    "", "", "", "", "", "DIRECT", "whatsapp-bot", "HANDED_OFF", "NOT_QUALIFIED", "example.com", "2026-10-11T03:35:00.000Z", "+91 9000000009", "SENT"]);
  env.gs.recalculateLeadScores();
  const sc = col(h, "Score"), pr = col(h, "Priority");
  assert.deepEqual([h.cell(2, sc), h.cell(2, pr)], [60, "Warm"]); // 25 + 20 + 10 + 5
  assert.deepEqual([h.cell(3, sc), h.cell(3, pr)], [10, "Cold"]);
});

test("recalculateLeadScores skips rows without an ID and never sends email", () => {
  const env = createEnv();
  const q = oldLayoutTab(env, "Qualified Leads", OLD_QUALIFIED_HEADERS, [oldRow("L-0000000001", "New", "2026-10-15", "2026-10-18", 3)]);
  q.setCell(4, 3, "New"); // a stray status on an empty row
  const summary = env.gs.recalculateLeadScores();
  assert.equal(summary.tabs["Qualified Leads"].open, 1);
  assert.equal(q.cell(4, col(q, "Score")), "");
  assert.equal(env.mails.length, 0);
});

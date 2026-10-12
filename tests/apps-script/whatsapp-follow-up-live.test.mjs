// Week 6 Stretch 2: LIVE automatic WhatsApp follow-ups in the Apps Script (sendWhatsAppFollowUps, mode "live").
// The website endpoint is a fake UrlFetchApp: no network, no real message. Proves: live needs its second switch,
// only guest-safe fields are sent, sent time + Message SID are recorded, live results block a lead permanently,
// "will retry" results only for the day, overlapping runs cannot process the same lead, and the daily cap holds.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEnv, NOW_MS, col } from "../helpers/apps-script-env.mjs";

const ENDPOINT = "https://example.test/api/whatsapp/follow-up";
const FU_SECRET = "fu-secret-for-tests-0123456789abcdef";
const LIVE = {
  WA_FOLLOW_UP_MODE: "live",
  WA_FOLLOW_UP_LIVE_ENABLED: "true",
  WA_FOLLOW_UP_ENDPOINT: ENDPOINT,
  WA_FOLLOW_UP_SECRET: FU_SECRET,
  WA_FOLLOW_UP_START_DATE: "2026-10-01",
};
const DAY = 24 * 3600 * 1000;
const STATUS = "WA Follow-up Status";
const SENT = "WA Follow-up Sent (IST)";
const SID_COL = "WA Message ID";
const sidFor = (leadId) => "SM" + leadId.slice(2).toLowerCase().padEnd(32, "0");

// Fake website: "sent" with a Message SID unless `answers` says otherwise.
function endpoint(answers = {}, hook) {
  return (url, options, n) => {
    const body = JSON.parse(options.payload);
    if (hook) hook(body, n);
    const a = answers[body.leadId];
    if (a instanceof Error) return a;
    if (a && a.status) return a;
    if (a && typeof a === "object") return { status: 200, body: Object.assign({ ok: true, mode: "live", leadId: body.leadId }, a) };
    return { status: 200, body: { ok: true, mode: "live", leadId: body.leadId, result: a || "sent", messageSid: sidFor(body.leadId), liveReady: true, botEnabled: true } };
  };
}

function setup({ props = LIVE, urlFetch = endpoint(), nowMs } = {}) {
  const env = createEnv({ props, urlFetch, nowMs });
  const q = env.spreadsheet.insertSheet("Qualified Leads");
  q.appendRow(Array.from(env.gs.QUALIFIED_HEADERS).concat(Array.from(env.gs.WA_FOLLOW_UP_HEADERS)));
  return { env, q };
}

let phoneSeq = 10;
function lead(q, id, overrides = {}) {
  const base = {
    "Received (IST)": "2026-10-10 10:00:00", "Lead ID": id, "Status": "Contacted", "Phone": "+9190000000" + (phoneSeq++),
    "Destination": "Jaipur", "Property": "Studio 925", "Check-in": "2026-12-10", "Check-out": "2026-12-13", "Nights": 3, "Guests": 2,
    "Requirements": "late check-in", "Ref": "W-PROP-STUDIO-925", "Source": "whatsapp-bot", "Notes": "internal note",
    "Handoff Number": "+91 9000000009", "Email Status": "SENT", "Status Updated (IST)": "2026-10-10 12:00:00",
    "Next Follow-up": "2026-10-12 12:00:00", "Score": 85, "Priority": "Hot",
  };
  const values = Object.assign(base, overrides);
  q.appendRow(q.headers().map((h) => (h in values ? values[h] : "")));
  return q.getLastRow();
}

// A second Apps Script "day" sharing the same Sheet and Script Properties.
function nextDay(env, q, urlFetch = endpoint()) {
  const next = createEnv({ props: Object.assign({}, env.store), urlFetch, nowMs: NOW_MS + DAY });
  next.sheets.set("Qualified Leads", q);
  return next;
}

const payloads = (env) => env.fetches.map((f) => JSON.parse(f.options.payload));
const cell = (q, row, name) => q.cell(row, col(q, name));

// ---------- switches ----------

test("live needs BOTH WA_FOLLOW_UP_MODE=live and WA_FOLLOW_UP_LIVE_ENABLED=true; otherwise nothing is contacted", () => {
  for (const sw of [undefined, "", "false", "yes", "1"]) {
    const props = Object.assign({}, LIVE);
    if (sw === undefined) delete props.WA_FOLLOW_UP_LIVE_ENABLED; else props.WA_FOLLOW_UP_LIVE_ENABLED = sw;
    const { env, q } = setup({ props });
    const r = lead(q, "L-0000000001");
    const s = env.gs.sendWhatsAppFollowUps();
    assert.equal(s.mode, "live");
    assert.match(s.reason, /WA_FOLLOW_UP_LIVE_ENABLED=true: nothing was sent/);
    assert.equal(env.fetches.length, 0, String(sw));
    assert.equal(cell(q, r, STATUS), "");
  }
  // the switch alone does nothing while the mode is dry_run or off
  for (const mode of ["dry_run", "off", undefined]) {
    const props = Object.assign({}, LIVE, { WA_FOLLOW_UP_MODE: mode });
    if (mode === undefined) delete props.WA_FOLLOW_UP_MODE;
    const { env, q } = setup({ props });
    lead(q, "L-0000000001");
    env.gs.sendWhatsAppFollowUps();
    assert.ok(payloads(env).every((p) => p.mode === "dry_run"), String(mode));
    if (mode !== "dry_run") assert.equal(env.fetches.length, 0, String(mode));
  }
});

// ---------- what is sent to the website ----------

test("live request: Bearer secret, mode live, and ONLY guest-safe fields (no score, Source, Ref, notes, requirements)", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { "Phone": "+919000000055" });
  env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1);
  assert.equal(env.fetches[0].options.headers.Authorization, "Bearer " + FU_SECRET);
  assert.deepEqual(payloads(env)[0], {
    leadId: "L-0000000001", phone: "+919000000055", mode: "live",
    destination: "Jaipur", property: "Studio 925", checkIn: "2026-12-10", checkOut: "2026-12-13",
  });
  const raw = env.fetches[0].options.payload;
  for (const leak of ["85", "Hot", "whatsapp-bot", "W-PROP", "internal note", "late check-in", "9000000009"]) assert.ok(!raw.includes(leak), leak);
});

test("live request: empty guest fields are left out, not sent as empty strings", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { "Property": "", "Check-out": "" });
  env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(Object.keys(payloads(env)[0]).sort(), ["checkIn", "destination", "leadId", "mode", "phone"]);
});

// ---------- results ----------

test("sent: writes Status, Sent (IST) and the Message SID; nothing else in the row changes; never sent again", () => {
  const { env, q } = setup();
  const r = lead(q, "L-0000000001");
  const before = q.data[r - 1].slice();
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(cell(q, r, STATUS), "Live: sent (2026-10-12 13:00 IST)");
  assert.equal(cell(q, r, SENT), "2026-10-12 13:00:00");
  assert.equal(cell(q, r, SID_COL), sidFor("L-0000000001"));
  const after = q.data[r - 1].slice();
  [STATUS, SENT, SID_COL].forEach((h) => { after[col(q, h) - 1] = before[col(q, h) - 1]; });
  assert.deepEqual(after, before, "Status, Next Follow-up, Score etc. untouched");
  assert.equal(env.mails.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(s.results)), { sent: 1 });
  assert.doesNotMatch(JSON.stringify(s) + env.store.WA_FOLLOW_UP_LAST_RUN, /\+91|L-0|SM[0-9a-f]{10}|example\.test/, "summary holds counts only");
  // later days: blocked permanently (WA Message ID is set)
  const later = nextDay(env, q);
  const s2 = later.gs.sendWhatsAppFollowUps();
  assert.equal(later.fetches.length, 0);
  assert.equal(s2.skipped.alreadyProcessed, 1);
});

test("duplicate, opted out and send failed are recorded and block the lead permanently", () => {
  const answers = {
    "L-0000000001": "duplicate",
    "L-0000000002": "opted_out",
    "L-0000000003": { result: "send_failed", reason: "http_400", systemic: false, twilioCode: 21211 },
  };
  const { env, q } = setup({ urlFetch: endpoint(answers) });
  const r1 = lead(q, "L-0000000001", { "Score": 90 });
  const r2 = lead(q, "L-0000000002", { "Score": 80 });
  const r3 = lead(q, "L-0000000003", { "Score": 70 });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(s.checked, 3, "a per-guest send failure does not stop the run");
  assert.equal(cell(q, r1, STATUS), "Live: not sent, already claimed earlier (2026-10-12 13:00 IST)");
  assert.equal(cell(q, r2, STATUS), "Live: not sent, guest opted out (2026-10-12 13:00 IST)");
  assert.equal(cell(q, r3, STATUS), "Live: send failed (http_400), not retried (2026-10-12 13:00 IST)");
  [r1, r2, r3].forEach((r) => { assert.equal(cell(q, r, SENT), ""); assert.equal(cell(q, r, SID_COL), ""); });
  const later = nextDay(env, q);
  later.gs.sendWhatsAppFollowUps();
  assert.equal(later.fetches.length, 0, "never retried");
});

test("a systemic send failure stops the run, gives back unused cap and clears the other leads' markers", () => {
  const { env, q } = setup({ urlFetch: endpoint({ "L-0000000001": { result: "send_failed", reason: "http_401", systemic: true } }) });
  const r1 = lead(q, "L-0000000001", { "Score": 90 });
  const r2 = lead(q, "L-0000000002", { "Score": 80 });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1);
  assert.equal(s.stopped, "send_failed_http_401");
  assert.match(cell(q, r1, STATUS), /^Live: send failed \(http_401\)/);
  assert.equal(cell(q, r2, STATUS), "", "marker of the lead not called is removed");
  assert.equal(env.store.WA_FOLLOW_UP_COUNT, "2026-10-12|1");
});

test("rejected before the website claimed the lead (e.g. 400, 409, network): 'will retry' blocks only for that day", () => {
  for (const answer of [{ status: 400, body: { ok: false, error: "bad_request", field: "destination" } },
    { status: 409, body: { ok: false, error: "live_not_available", reason: "bot_disabled" } }, new Error("DNS")]) {
    const { env, q } = setup({ urlFetch: endpoint({ "L-0000000001": answer }) });
    const r = lead(q, "L-0000000001");
    env.gs.sendWhatsAppFollowUps();
    assert.match(cell(q, r, STATUS), /^Live: will retry, not sent \((bad_request|live_not_available|network)\) \(2026-10-12 13:00 IST\)$/);
    const again = env.gs.sendWhatsAppFollowUps();
    assert.equal(env.fetches.length, 1, "same day: not retried");
    assert.equal(again.skipped.alreadyProcessed, 1);
    const later = nextDay(env, q);
    later.gs.sendWhatsAppFollowUps();
    assert.equal(later.fetches.length, 1, "next day: tried again (the website's permanent claim prevents any double send)");
  }
});

test("a 'sent' answer without a valid Message SID is recorded as sent, stops the run, and writes no Message ID", () => {
  const { env, q } = setup({ urlFetch: endpoint({ "L-0000000001": { result: "sent", messageSid: "bogus" } }) });
  const r1 = lead(q, "L-0000000001", { "Score": 90 });
  const r2 = lead(q, "L-0000000002", { "Score": 80 });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(s.stopped, "no_message_sid");
  assert.match(cell(q, r1, STATUS), /^Live: sent/);
  assert.equal(cell(q, r1, SID_COL), "");
  assert.equal(cell(q, r2, STATUS), "");
});

test("a reply for a different Lead ID, or a dry-run shaped reply in live mode, is not trusted", () => {
  const { env, q } = setup({ urlFetch: (url, o) => ({ status: 200, body: { ok: true, mode: "dry_run", leadId: JSON.parse(o.payload).leadId, result: "sent", messageSid: "SM" + "0".repeat(32) } }) });
  const r = lead(q, "L-0000000001");
  env.gs.sendWhatsAppFollowUps();
  assert.match(cell(q, r, STATUS), /^Live: will retry, not sent \(http_200\)/);
  assert.equal(cell(q, r, SID_COL), "");
});

// ---------- overlapping runs ----------

test("picked leads are marked 'In progress' before the website is called", () => {
  let seen = null;
  const { env, q } = setup({ urlFetch: endpoint({}, () => { seen = cell(q, 2, STATUS); }) });
  lead(q, "L-0000000001");
  env.gs.sendWhatsAppFollowUps();
  assert.equal(seen, "In progress: live run (2026-10-12 13:00 IST)");
});

test("overlapping runs: a second run while one is in progress contacts nobody", () => {
  let nested = null;
  let env, q;
  const urlFetch = endpoint({}, () => { if (!nested) nested = env.gs.sendWhatsAppFollowUps(); });
  ({ env, q } = setup({ urlFetch }));
  lead(q, "L-0000000001");
  lead(q, "L-0000000002");
  env.gs.sendWhatsAppFollowUps();
  assert.equal(nested.reason, "another follow-up run is in progress");
  assert.equal(env.fetches.length, 2, "only the first run called the website");
  assert.equal(env.store.WA_FOLLOW_UP_RUNNING, undefined, "run marker released at the end");
});

test("overlapping runs: even without the run marker, the 'In progress' row markers stop a second run taking the same leads", () => {
  let nested = null;
  let env, q;
  const urlFetch = endpoint({}, () => {
    if (nested) return;
    delete env.store.WA_FOLLOW_UP_RUNNING; // simulate a lost/expired run marker
    nested = env.gs.sendWhatsAppFollowUps();
  });
  ({ env, q } = setup({ urlFetch }));
  lead(q, "L-0000000001");
  lead(q, "L-0000000002");
  env.gs.sendWhatsAppFollowUps();
  assert.equal(nested.reason, "no eligible lead");
  assert.equal(nested.skipped.alreadyProcessed, 2);
  assert.deepEqual(payloads(env).map((p) => p.leadId).sort(), ["L-0000000001", "L-0000000002"], "each lead called exactly once");
});

test("a stale run marker (older than 10 minutes) does not block; a fresh one does", () => {
  const fresh = setup({ props: Object.assign({}, LIVE, { WA_FOLLOW_UP_RUNNING: "abc|" + (NOW_MS - 60 * 1000) }) });
  lead(fresh.q, "L-0000000001");
  assert.equal(fresh.env.gs.sendWhatsAppFollowUps().reason, "another follow-up run is in progress");
  assert.equal(fresh.env.fetches.length, 0);
  const stale = setup({ props: Object.assign({}, LIVE, { WA_FOLLOW_UP_RUNNING: "abc|" + (NOW_MS - 11 * 60 * 1000) }) });
  lead(stale.q, "L-0000000001");
  stale.env.gs.sendWhatsAppFollowUps();
  assert.equal(stale.env.fetches.length, 1);
});

test("a run that died mid-way leaves 'In progress' rows that are retried the next day, not the same day", () => {
  const { env, q } = setup();
  const r = lead(q, "L-0000000001", { [STATUS]: "In progress: live run (2026-10-12 11:00 IST)" });
  env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 0);
  const later = nextDay(env, q);
  later.gs.sendWhatsAppFollowUps();
  assert.equal(later.fetches.length, 1);
  assert.match(cell(q, r, STATUS), /^Live: sent/);
});

// ---------- cap, window, eligibility ----------

test("daily cap holds in live mode (Hot first) and counts every call", () => {
  const { env, q } = setup({ props: Object.assign({}, LIVE, { WA_FOLLOW_UP_DAILY_CAP: "2" }) });
  lead(q, "L-0000000001", { "Priority": "Cold", "Score": 20 });
  lead(q, "L-0000000002", { "Priority": "Hot", "Score": 90 });
  lead(q, "L-0000000003", { "Priority": "Warm", "Score": 50 });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(payloads(env).map((p) => p.leadId), ["L-0000000002", "L-0000000003"]);
  assert.equal(s.overCap, 1);
  assert.equal(env.store.WA_FOLLOW_UP_COUNT, "2026-10-12|2");
  assert.equal(env.gs.sendWhatsAppFollowUps().reason, "daily cap reached");
  assert.equal(env.fetches.length, 2);
});

test("existing eligibility rules still apply in live mode", () => {
  const { env, q } = setup({ props: Object.assign({}, LIVE, { WA_FOLLOW_UP_BLOCKED_PHONES: "+919000000099" }) });
  lead(q, "L-0000000001", { "Status": "New" });
  lead(q, "L-0000000002", { "Status": "Booked" });
  lead(q, "L-0000000003", { "Source": "whatsapp-bot-sandbox" });
  lead(q, "L-0000000004", { "Auto Follow-up": "No" });
  lead(q, "L-0000000005", { "Check-in": "2026-10-11" });
  lead(q, "L-0000000006", { "Next Follow-up": "2026-10-13 09:00:00" });
  lead(q, "L-0000000007", { "Received (IST)": "2026-09-30 10:00:00" });
  lead(q, "L-0000000008", { "Phone": "+919000000099" });
  lead(q, "L-0000000009", { "Phone": "+919000000077" });
  lead(q, "L-000000000A", { "Phone": "+919000000077" }); // same phone: one per run
  lead(q, "L-0000000000", {}); // diagnostic ID
  env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1);
});

test("live runs only between 10:00 and 19:00 India time", () => {
  const { env, q } = setup({ nowMs: NOW_MS + 6 * 3600 * 1000 }); // 19:00 IST
  lead(q, "L-0000000001");
  assert.match(env.gs.sendWhatsAppFollowUps().reason, /window/);
  assert.equal(env.fetches.length, 0);
});

test("setup reports the live switch as yes/no only and never turns anything on", () => {
  const env = createEnv({ props: Object.assign({}, LIVE, { WA_FOLLOW_UP_MODE: "dry_run", WA_FOLLOW_UP_LIVE_ENABLED: "false" }) });
  env.spreadsheet.insertSheet("Qualified Leads");
  const s = env.gs.setupWhatsAppFollowUps();
  assert.equal(s.props.WA_FOLLOW_UP_LIVE_ENABLED, false);
  assert.equal(s.mode, "dry_run");
  assert.equal(env.store.WA_FOLLOW_UP_MODE, "dry_run");
  assert.equal(env.store.WA_FOLLOW_UP_LIVE_ENABLED, "false");
  const utc = createEnv({ props: LIVE, scriptTimeZone: "Etc/UTC" });
  utc.spreadsheet.insertSheet("Qualified Leads");
  assert.match(utc.gs.setupWhatsAppFollowUps().note, /Asia\/Kolkata/);
});

// ---------- final review fixes ----------

test("a 'guest already contacted recently' answer is recorded clearly and blocks that lead permanently", () => {
  const { env, q } = setup({ urlFetch: endpoint({ "L-0000000001": { result: "duplicate", reason: "phone_recently_contacted" } }) });
  const r = lead(q, "L-0000000001");
  env.gs.sendWhatsAppFollowUps();
  assert.equal(cell(q, r, STATUS), "Live: not sent, this guest already got an automatic follow-up recently (2026-10-12 13:00 IST)");
  const later = nextDay(env, q);
  later.gs.sendWhatsAppFollowUps();
  assert.equal(later.fetches.length, 0);
});

test("time budget: no new call starts after 4 minutes; unused cap is given back and markers cleared", () => {
  let env, q;
  const urlFetch = endpoint({}, (body, n) => { if (n === 1) env.setNow(NOW_MS + 5 * 60 * 1000); });
  ({ env, q } = setup({ urlFetch }));
  const r1 = lead(q, "L-0000000001", { "Score": 90 });
  const r2 = lead(q, "L-0000000002", { "Score": 80 });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1);
  assert.equal(s.stopped, "time_budget");
  assert.match(cell(q, r1, STATUS), /^Live: sent/);
  assert.equal(cell(q, r2, STATUS), "");
  assert.equal(env.store.WA_FOLLOW_UP_COUNT, "2026-10-12|1");
  assert.equal(env.store.WA_FOLLOW_UP_RUNNING, undefined);
});

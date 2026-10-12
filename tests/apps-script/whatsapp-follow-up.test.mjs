// Week 6 Stretch 2, Phase A: automatic WhatsApp follow-ups, DRY RUN ONLY (sendWhatsAppFollowUps /
// setupWhatsAppFollowUps in apps-script/Code.gs). Proves: OFF by default, live refused, every eligibility gate,
// test-lead protection, start date, blocked/allowed phones, one per phone per run, daily cap, window, result
// tracking that never blocks a lead permanently, row-shift safety, nothing else in the Sheet changes, no email,
// and no secret/phone in the summary. The endpoint is a fake UrlFetchApp: no network.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEnv, NOW_MS, postLead, qualifiedLead, rowObject, col } from "../helpers/apps-script-env.mjs";

const ENDPOINT = "https://example.test/api/whatsapp/follow-up";
const FU_SECRET = "fu-secret-for-tests-0123456789abcdef"; // 36 chars, fake
const READY = {
  WA_FOLLOW_UP_MODE: "dry_run",
  WA_FOLLOW_UP_ENDPOINT: ENDPOINT,
  WA_FOLLOW_UP_SECRET: FU_SECRET,
  WA_FOLLOW_UP_START_DATE: "2026-10-01",
};
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const STATUS = "WA Follow-up Status";

// Fake endpoint: answers like the website (would_send for every lead unless `answers` says otherwise).
function endpoint(answers = {}) {
  return (url, options) => {
    const body = JSON.parse(options.payload);
    const a = answers[body.leadId];
    if (a instanceof Error) return a;
    if (a && a.status) return a;
    return { status: 200, body: { ok: true, mode: "dry_run", leadId: body.leadId, result: a || "would_send", liveReady: false, botEnabled: false } };
  };
}

function setup({ props = READY, urlFetch = endpoint(), nowMs, tryLock } = {}) {
  const env = createEnv({ props, urlFetch, nowMs, tryLock });
  const q = env.spreadsheet.insertSheet("Qualified Leads");
  q.appendRow(Array.from(env.gs.QUALIFIED_HEADERS).concat(Array.from(env.gs.WA_FOLLOW_UP_HEADERS)));
  return { env, q };
}

let phoneSeq = 10;
// One Qualified Leads row that passes every gate unless overridden.
function lead(q, id, overrides = {}) {
  const base = {
    "Received (IST)": "2026-10-10 10:00:00", "Lead ID": id, "Status": "Contacted", "Phone": "+9190000000" + (phoneSeq++),
    "Destination": "Jaipur", "Check-in": "2026-12-10", "Check-out": "2026-12-13", "Nights": 3, "Guests": 2,
    "Ref": "DIRECT", "Source": "whatsapp-bot", "Email Status": "SENT", "Status Updated (IST)": "2026-10-10 12:00:00",
    "Next Follow-up": "2026-10-12 12:00:00", "Score": 60, "Priority": "Warm",
  };
  const values = Object.assign(base, overrides);
  q.appendRow(q.headers().map((h) => (h in values ? values[h] : "")));
  return q.getLastRow();
}

const ids = (env) => env.fetches.map((f) => JSON.parse(f.options.payload).leadId);
const status = (q, row) => q.cell(row, col(q, STATUS));
const snapshot = (q) => JSON.parse(JSON.stringify(q.data));

// ---------- off / live / configuration ----------

test("OFF by default: no WA_FOLLOW_UP_* properties -> nothing read, nothing fetched", () => {
  const { env, q } = setup({ props: {} });
  lead(q, "L-0000000001");
  const before = snapshot(q);
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(s.mode, "off");
  assert.match(s.reason, /off/);
  assert.equal(env.fetches.length, 0);
  assert.deepEqual(snapshot(q), before);
  assert.equal(env.store.WA_FOLLOW_UP_COUNT, undefined);
});

test("mode off, unknown mode, and live without its second switch: nothing fetched", () => {
  for (const [mode, expectMode, re] of [["off", "off", /is off/], ["DRY", "off", /treated as off/], ["send", "off", /treated as off/], ["live", "live", /WA_FOLLOW_UP_LIVE_ENABLED=true/], ["LIVE", "live", /WA_FOLLOW_UP_LIVE_ENABLED=true/]]) {
    const { env, q } = setup({ props: Object.assign({}, READY, { WA_FOLLOW_UP_MODE: mode }) });
    lead(q, "L-0000000001");
    const s = env.gs.sendWhatsAppFollowUps();
    assert.equal(s.mode, expectMode, mode);
    assert.match(s.reason, re, mode);
    assert.equal(env.fetches.length, 0, mode);
  }
});

test("configuration errors stop the run before any fetch, and never echo the secret or endpoint", () => {
  const bad = [
    { WA_FOLLOW_UP_ENDPOINT: "" },
    { WA_FOLLOW_UP_ENDPOINT: "http://example.test/api/whatsapp/follow-up" },
    { WA_FOLLOW_UP_ENDPOINT: ENDPOINT + "?key=abc" },
    { WA_FOLLOW_UP_ENDPOINT: "https://example.test/api/whatsapp/inbound" },
    { WA_FOLLOW_UP_SECRET: "" },
    { WA_FOLLOW_UP_SECRET: "short-secret" },
    { WA_FOLLOW_UP_START_DATE: "" },
    { WA_FOLLOW_UP_START_DATE: "2026-13-01" },
    { WA_FOLLOW_UP_START_DATE: "01/10/2026" },
    { WA_FOLLOW_UP_DAILY_CAP: "0" },
    { WA_FOLLOW_UP_DAILY_CAP: "ten" },
    { WA_FOLLOW_UP_DAILY_CAP: "-3" },
    { WA_FOLLOW_UP_ALLOWED_PHONES: "+919000000010, 98765" },
    { WA_FOLLOW_UP_BLOCKED_PHONES: "not-a-phone" },
  ];
  for (const b of bad) {
    const { env, q } = setup({ props: Object.assign({}, READY, b) });
    lead(q, "L-0000000001");
    const s = env.gs.sendWhatsAppFollowUps();
    assert.equal(env.fetches.length, 0, JSON.stringify(b));
    assert.ok(s.reason, JSON.stringify(b));
    const text = JSON.stringify(s) + env.store.WA_FOLLOW_UP_LAST_RUN;
    assert.ok(!text.includes(FU_SECRET) && !text.includes("example.test"), JSON.stringify(b));
  }
});

// ---------- happy path ----------

test("dry run: one eligible lead -> one authenticated POST, status recorded, nothing else changed, no email", () => {
  const { env, q } = setup();
  const r = lead(q, "L-0000000001", { "Phone": "+919000000055" });
  const before = snapshot(q);
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1);
  const f = env.fetches[0];
  assert.equal(f.url, ENDPOINT);
  assert.equal(f.options.method, "post");
  assert.equal(f.options.contentType, "application/json");
  assert.equal(f.options.headers.Authorization, "Bearer " + FU_SECRET);
  assert.equal(f.options.muteHttpExceptions, true);
  assert.equal(f.options.followRedirects, false);
  assert.deepEqual(JSON.parse(f.options.payload), { leadId: "L-0000000001", phone: "+919000000055", mode: "dry_run" });
  assert.equal(status(q, r), "Dry run: would send (2026-10-12 13:00 IST)");
  // only that one cell changed
  const after = snapshot(q);
  after[r - 1][col(q, STATUS) - 1] = before[r - 1][col(q, STATUS) - 1];
  assert.deepEqual(after, before);
  assert.equal(q.cell(r, col(q, "WA Follow-up Sent (IST)")), "", "dry run never fills Sent");
  assert.equal(q.cell(r, col(q, "WA Message ID")), "", "dry run never fills Message ID");
  assert.equal(env.mails.length, 0);
  assert.equal(env.store.WA_FOLLOW_UP_COUNT, "2026-10-12|1");
  assert.equal(s.mode, "dry_run");
  assert.equal(s.checked, 1);
  assert.equal(s.written, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(s.results)), { would_send: 1 });
});

test("summary and WA_FOLLOW_UP_LAST_RUN hold counts only (no phone, Lead ID, secret or endpoint)", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { "Phone": "+919000000055" });
  lead(q, "L-0000000002", { "Status": "New" });
  const s = env.gs.sendWhatsAppFollowUps();
  for (const text of [JSON.stringify(s), env.store.WA_FOLLOW_UP_LAST_RUN]) {
    assert.doesNotMatch(text, /\+91|L-0|example\.test/);
    assert.ok(!text.includes(FU_SECRET));
  }
  assert.equal(JSON.parse(env.store.WA_FOLLOW_UP_LAST_RUN).checked, 1);
});

// ---------- eligibility gates ----------

test("only Contacted leads: New, Booked, Lost, empty and other statuses are never checked", () => {
  const { env, q } = setup();
  ["New", "Booked", "Lost", "", "Follow-up", "Won"].forEach((st, i) => lead(q, "L-000000001" + i, { "Status": st }));
  const ok = lead(q, "L-0000000099", { "Status": "contacted " }); // different case/space still Contacted
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000099"]);
  assert.equal(s.skipped.notContacted, 6);
  assert.match(status(q, ok), /^Dry run: would send/);
});

test("test-lead protection: sandbox/diagnostic/other sources and the diagnostic Lead ID are never checked", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { "Source": "whatsapp-bot-sandbox" });
  lead(q, "L-0000000002", { "Source": "diagnostic" });
  lead(q, "L-0000000003", { "Source": "" });
  lead(q, "L-0000000004", { "Source": "WhatsApp-Bot" });
  lead(q, "L-0000000000", {});
  lead(q, "L-0000000005", {});
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000005"]);
  assert.equal(s.skipped.testOrOtherSource, 5);
});

test("start date: leads received before WA_FOLLOW_UP_START_DATE are never checked (the start date itself is)", () => {
  const { env, q } = setup({ props: Object.assign({}, READY, { WA_FOLLOW_UP_START_DATE: "2026-10-10" }) });
  lead(q, "L-0000000001", { "Received (IST)": "2026-10-09 23:59:59" });
  lead(q, "L-0000000002", { "Received (IST)": "2026-10-10 00:00:00" });
  lead(q, "L-0000000003", { "Received (IST)": "" });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000002"]);
  assert.equal(s.skipped.beforeStartDate, 2);
});

test("due date and check-in: only follow-ups due today or earlier, and check-in today or later", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { "Next Follow-up": "2026-10-13 09:00:00" }); // tomorrow
  lead(q, "L-0000000002", { "Next Follow-up": "" });
  lead(q, "L-0000000003", { "Next Follow-up": "2026-10-05 09:00:00" }); // overdue: yes
  lead(q, "L-0000000004", { "Check-in": "2026-10-11" }); // passed
  lead(q, "L-0000000005", { "Check-in": "" });
  lead(q, "L-0000000006", { "Check-in": "2026-10-12" }); // today: yes
  lead(q, "L-0000000007", { "Next Follow-up": new Date(NOW_MS - DAY) }); // a Date cell, yesterday: yes
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env).sort(), ["L-0000000003", "L-0000000006", "L-0000000007"]);
  assert.equal(s.skipped.notDue, 2);
  assert.equal(s.skipped.checkInPassedOrMissing, 2);
});

test("Auto Follow-up = No (any case) excludes a lead; empty or Yes allows it", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { "Auto Follow-up": "No" });
  lead(q, "L-0000000002", { "Auto Follow-up": " no " });
  lead(q, "L-0000000003", { "Auto Follow-up": "Yes" });
  lead(q, "L-0000000004", { "Auto Follow-up": "" });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env).sort(), ["L-0000000003", "L-0000000004"]);
  assert.equal(s.skipped.autoFollowUpNo, 2);
});

test("phones: invalid numbers and blocked numbers are skipped; an allow list limits checks to its numbers", () => {
  const blocked = setup({ props: Object.assign({}, READY, { WA_FOLLOW_UP_BLOCKED_PHONES: "+919000000071; +919000000072" }) });
  lead(blocked.q, "L-0000000001", { "Phone": "+919000000071" });
  lead(blocked.q, "L-0000000002", { "Phone": "9000000073" });
  lead(blocked.q, "L-0000000003", { "Phone": "+919000000074" });
  const s1 = blocked.env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(blocked.env), ["L-0000000003"]);
  assert.equal(s1.skipped.blockedPhone, 1);
  assert.equal(s1.skipped.invalidPhone, 1);

  const allowed = setup({ props: Object.assign({}, READY, { WA_FOLLOW_UP_ALLOWED_PHONES: "+919000000081 +919000000082", WA_FOLLOW_UP_BLOCKED_PHONES: "+919000000082" }) });
  lead(allowed.q, "L-0000000001", { "Phone": "+919000000081" });
  lead(allowed.q, "L-0000000002", { "Phone": "+919000000082" }); // allowed AND blocked: blocked wins
  lead(allowed.q, "L-0000000003", { "Phone": "+919000000083" });
  const s2 = allowed.env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(allowed.env), ["L-0000000001"]);
  assert.equal(s2.skipped.notAllowedPhone, 1);
  assert.equal(s2.skipped.blockedPhone, 1);
});

test("Handoffs are never followed up, and rows without a valid Lead ID or with a repeated ID are skipped", () => {
  const { env, q } = setup();
  const h = env.spreadsheet.insertSheet("Handoffs");
  h.appendRow(Array.from(env.gs.HANDOFF_HEADERS));
  h.appendRow(Array.from(env.gs.HANDOFF_HEADERS).map((name) => ({ "Handoff ID": "H-0000000001", "Status": "Contacted", "Phone": "+919000000091",
    "Source": "whatsapp-bot", "Received (IST)": "2026-10-10 10:00:00", "Next Follow-up": "2026-10-11 10:00:00", "Check-in": "2026-12-01" })[name] || ""));
  lead(q, "", {});
  lead(q, "L-abc", {});
  lead(q, "L-0000000001", {});
  lead(q, "L-0000000001", {});
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000001"]);
  assert.equal(s.skipped.noLeadId, 2);
  assert.equal(s.skipped.duplicateRow, 1);
});

// ---------- one follow-up per lead / result tracking ----------

test("already processed: any non-dry-run status or a WA Message ID blocks the lead permanently", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { [STATUS]: "Sent (2026-10-11 11:00 IST)" });
  lead(q, "L-0000000002", { [STATUS]: "called guest instead" });
  lead(q, "L-0000000003", { "WA Message ID": "SM123" });
  lead(q, "L-0000000004", {});
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000004"]);
  assert.equal(s.skipped.alreadyProcessed, 3);
});

test("a dry-run result blocks only for the same day: the next day the lead is checked again", () => {
  const { env, q } = setup();
  const r = lead(q, "L-0000000001", {});
  env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1);
  const again = env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1, "second run the same day does not re-check");
  assert.equal(again.skipped.alreadyProcessed, 1);

  // tomorrow, same Sheet state: eligible again (a dry run never blocks a lead permanently)
  const next = createEnv({ props: READY, urlFetch: endpoint({ "L-0000000001": "duplicate" }), nowMs: NOW_MS + DAY });
  next.sheets.set("Qualified Leads", q);
  next.gs.sendWhatsAppFollowUps();
  assert.equal(next.fetches.length, 1);
  assert.equal(status(q, r), "Dry run: already checked in the last 24 hours (2026-10-13 13:00 IST)");
});

test("a dry-run status without a readable date never blocks", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { [STATUS]: "Dry run: would send" });
  env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 1);
});

test("endpoint answers map to clear dry-run statuses", () => {
  const { env, q } = setup({ urlFetch: endpoint({ "L-0000000002": "duplicate", "L-0000000003": "opted_out", "L-0000000004": { status: 400, body: { ok: false, error: "bad_request", field: "phone" } } }) });
  const r1 = lead(q, "L-0000000001", {});
  const r2 = lead(q, "L-0000000002", {});
  const r3 = lead(q, "L-0000000003", {});
  const r4 = lead(q, "L-0000000004", {});
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(status(q, r1), "Dry run: would send (2026-10-12 13:00 IST)");
  assert.equal(status(q, r2), "Dry run: already checked in the last 24 hours (2026-10-12 13:00 IST)");
  assert.equal(status(q, r3), "Dry run: guest opted out, would not send (2026-10-12 13:00 IST)");
  assert.equal(status(q, r4), "Dry run: check failed (bad_request) (2026-10-12 13:00 IST)");
  assert.equal(s.checked, 4, "a per-lead 400 does not stop the run");
  assert.equal(s.stopped, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(s.results)), { would_send: 1, duplicate: 1, opted_out: 1, error_bad_request: 1 });
});

test("a 200 answer for a different Lead ID or an unknown result is not trusted", () => {
  const { env, q } = setup({ urlFetch: (url, o) => ({ status: 200, body: { ok: true, leadId: "L-FFFFFFFFFF", result: "would_send" } }) });
  const r = lead(q, "L-0000000001", {});
  env.gs.sendWhatsAppFollowUps();
  assert.equal(status(q, r), "Dry run: check failed (http_200) (2026-10-12 13:00 IST)");
  const { env: env2, q: q2 } = setup({ urlFetch: (url, o) => ({ status: 200, body: { ok: true, leadId: JSON.parse(o.payload).leadId, result: "sent" } }) });
  const r2 = lead(q2, "L-0000000001", {});
  env2.gs.sendWhatsAppFollowUps();
  assert.match(status(q2, r2), /check failed/);
});

test("run-wide endpoint problems stop the run and give back the unused daily cap", () => {
  for (const answer of [{ status: 401, body: { ok: false, error: "unauthorized" } }, { status: 404, body: { ok: false, error: "disabled" } },
    { status: 503, body: { ok: false, error: "redis_unavailable" } }, { status: 409, body: { ok: false, error: "live_not_available" } },
    { status: 302, body: "" }, { status: 500, body: "<html>" }, new Error("DNS error")]) {
    const { env, q } = setup({ urlFetch: () => answer });
    const r1 = lead(q, "L-0000000001", { "Priority": "Hot", "Score": 90 });
    const r2 = lead(q, "L-0000000002", {});
    const r3 = lead(q, "L-0000000003", {});
    const s = env.gs.sendWhatsAppFollowUps();
    const label = answer instanceof Error ? "network" : String(answer.status);
    assert.equal(env.fetches.length, 1, label);
    assert.equal(s.checked, 1, label);
    assert.ok(s.stopped, label);
    assert.match(status(q, r1), /^Dry run: check failed \(/, label);
    assert.equal(status(q, r2), "", label);
    assert.equal(status(q, r3), "", label);
    assert.equal(env.store.WA_FOLLOW_UP_COUNT, "2026-10-12|1", label + ": only the call actually made counts");
  }
});

// ---------- caps, ordering, window ----------

test("one follow-up per phone per run: the highest-priority lead of that phone is checked", () => {
  const { env, q } = setup();
  lead(q, "L-0000000001", { "Phone": "+919000000061", "Priority": "Cold", "Score": 20 });
  lead(q, "L-0000000002", { "Phone": "+919000000061", "Priority": "Hot", "Score": 80 });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000002"]);
  assert.equal(s.skipped.samePhoneThisRun, 1);
});

test("order: Hot, Warm, Cold (then no priority); higher score first; then oldest follow-up", () => {
  const { env, q } = setup({ props: Object.assign({}, READY, { WA_FOLLOW_UP_DAILY_CAP: "50" }) });
  lead(q, "L-0000000001", { "Priority": "Cold", "Score": 30 });
  lead(q, "L-0000000002", { "Priority": "", "Score": "" });
  lead(q, "L-0000000003", { "Priority": "Warm", "Score": 50 });
  lead(q, "L-0000000004", { "Priority": "Hot", "Score": 75 });
  lead(q, "L-0000000005", { "Priority": "Hot", "Score": 90 });
  lead(q, "L-0000000006", { "Priority": "Warm", "Score": 50, "Next Follow-up": "2026-10-01 09:00:00" });
  env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000005", "L-0000000004", "L-0000000006", "L-0000000003", "L-0000000001", "L-0000000002"]);
});

test("daily cap: default 10; the cap counts endpoint checks per India day and resets the next day", () => {
  const { env, q } = setup();
  for (let i = 0; i < 12; i++) lead(q, "L-00000001" + String(i).padStart(2, "0"), {});
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 10);
  assert.equal(s.overCap, 2);
  assert.equal(env.store.WA_FOLLOW_UP_COUNT, "2026-10-12|10");
  const s2 = env.gs.sendWhatsAppFollowUps();
  assert.equal(env.fetches.length, 10);
  assert.equal(s2.reason, "daily cap reached");

  const tomorrow = createEnv({ props: Object.assign({}, READY, { WA_FOLLOW_UP_COUNT: "2026-10-12|10" }), urlFetch: endpoint(), nowMs: NOW_MS + DAY });
  tomorrow.sheets.set("Qualified Leads", q);
  tomorrow.gs.sendWhatsAppFollowUps();
  assert.equal(tomorrow.fetches.length, 10, "new day: cap available again (12 leads, all eligible again)");
  assert.equal(tomorrow.store.WA_FOLLOW_UP_COUNT, "2026-10-13|10");
});

test("daily cap: a custom cap, partly used earlier today, limits this run; values over 50 are clamped", () => {
  const { env, q } = setup({ props: Object.assign({}, READY, { WA_FOLLOW_UP_DAILY_CAP: "3", WA_FOLLOW_UP_COUNT: "2026-10-12|2" }) });
  lead(q, "L-0000000001", { "Priority": "Cold", "Score": 10 });
  lead(q, "L-0000000002", { "Priority": "Hot", "Score": 80 });
  env.gs.sendWhatsAppFollowUps();
  assert.deepEqual(ids(env), ["L-0000000002"]);
  assert.equal(env.store.WA_FOLLOW_UP_COUNT, "2026-10-12|3");

  const big = setup({ props: Object.assign({}, READY, { WA_FOLLOW_UP_DAILY_CAP: "500" }) });
  for (let i = 0; i < 55; i++) lead(big.q, "L-00000002" + String(i).padStart(2, "0"), {});
  const s = big.env.gs.sendWhatsAppFollowUps();
  assert.equal(s.cap, 50);
  assert.equal(big.env.fetches.length, 50);
});

test("window: runs only between 10:00 and 19:00 India time", () => {
  const at = (ist) => NOW_MS + (ist - 13) * HOUR; // NOW is 13:00 IST
  for (const [hour, expected] of [[9.98, 0], [10, 1], [18.98, 1], [19, 0], [23, 0]]) {
    const { env, q } = setup({ nowMs: at(hour) });
    lead(q, "L-0000000001", {});
    const s = env.gs.sendWhatsAppFollowUps();
    assert.equal(env.fetches.length, expected, "hour " + hour);
    if (!expected) assert.match(s.reason, /window/);
  }
});

// ---------- locking / row-shift safety / missing setup ----------

test("lock busy: nothing selected, fetched or written", () => {
  const { env, q } = setup({ tryLock: () => false });
  lead(q, "L-0000000001", {});
  const s = env.gs.sendWhatsAppFollowUps();
  assert.match(s.reason, /busy/);
  assert.equal(env.fetches.length, 0);
});

test("row-shift safety: results go to the row found again by Lead ID, even if rows moved during the calls", () => {
  let q;
  const urlFetch = (url, options, n) => {
    if (n === 1) q.data.splice(1, 0, q.headers().map((h) => (h === "Lead ID" ? "L-00000000AA" : h === "Status" ? "New" : ""))); // a row inserted above
    if (n === 2) q.data.splice(q.data.findIndex((r) => r[1] === "L-0000000003"), 1); // a checked lead deleted meanwhile
    return endpoint()(url, options);
  };
  ({ q } = setup({ urlFetch }));
  const env = createEnv({ props: READY, urlFetch });
  env.sheets.set("Qualified Leads", q);
  lead(q, "L-0000000001", { "Priority": "Hot", "Score": 90 });
  lead(q, "L-0000000002", { "Priority": "Hot", "Score": 80 });
  lead(q, "L-0000000003", { "Priority": "Hot", "Score": 70 });
  const s = env.gs.sendWhatsAppFollowUps();
  assert.equal(s.checked, 3);
  assert.equal(s.written, 2);
  assert.equal(s.rowsNotFound, 1);
  const byId = (id) => q.data.findIndex((r) => r[1] === id) + 1;
  assert.match(status(q, byId("L-0000000001")), /would send/);
  assert.match(status(q, byId("L-0000000002")), /would send/);
  assert.equal(status(q, byId("L-00000000AA")), "", "the inserted row is untouched");
});

test("missing follow-up columns: asks for setup and fetches nothing", () => {
  const env = createEnv({ props: READY, urlFetch: endpoint() });
  const q = env.spreadsheet.insertSheet("Qualified Leads");
  q.appendRow(Array.from(env.gs.QUALIFIED_HEADERS));
  q.appendRow(Array.from(env.gs.QUALIFIED_HEADERS).map(() => ""));
  const s = env.gs.sendWhatsAppFollowUps();
  assert.match(s.reason, /setupWhatsAppFollowUps/);
  assert.equal(env.fetches.length, 0);
  const none = createEnv({ props: READY, urlFetch: endpoint() });
  assert.match(none.gs.sendWhatsAppFollowUps().reason, /missing tab/);
});

// ---------- setup ----------

test("setupWhatsAppFollowUps: adds the 4 columns to Qualified Leads only, keeps existing columns, adds the dropdown", () => {
  const env = createEnv({ props: {} });
  const q = env.spreadsheet.insertSheet("Qualified Leads");
  q.appendRow(Array.from(env.gs.QUALIFIED_HEADERS));
  q.appendRow(Array.from(env.gs.QUALIFIED_HEADERS).map((h) => (h === "Lead ID" ? "L-0000000001" : h === "Status" ? "Contacted" : "x")));
  const h = env.spreadsheet.insertSheet("Handoffs");
  h.appendRow(Array.from(env.gs.HANDOFF_HEADERS));
  const rowBefore = q.data[1].slice();
  const s = env.gs.setupWhatsAppFollowUps();
  assert.deepEqual(q.headers(), Array.from(env.gs.QUALIFIED_HEADERS).concat(["Auto Follow-up", "WA Follow-up Status", "WA Follow-up Sent (IST)", "WA Message ID"]));
  assert.deepEqual(q.data[1].slice(0, rowBefore.length), rowBefore);
  assert.deepEqual(h.headers(), Array.from(env.gs.HANDOFF_HEADERS), "Handoffs unchanged");
  assert.equal(s.columnsAdded, 4);
  const rule = q.validations.get("2," + col(q, "Auto Follow-up"));
  assert.deepEqual(Array.from(rule.list), ["Yes", "No"]);
  assert.equal(rule.allowInvalid, false);
  assert.equal(q.validations.get("2," + col(q, "Status")), undefined, "Status dropdown is not this function's business");
  assert.equal(s.mode, "off", "setup never switches anything on");
  assert.equal(s.ready, false);
  assert.equal(env.store.WA_FOLLOW_UP_MODE, undefined);
  // second run adds nothing
  assert.equal(env.gs.setupWhatsAppFollowUps().columnsAdded, 0);
  assert.equal(q.headers().length, env.gs.QUALIFIED_HEADERS.length + 4);
});

test("setupWhatsAppFollowUps: one daily trigger at about 11:00, idempotent, duplicates removed, project time zone", () => {
  const env = createEnv({ props: READY });
  env.spreadsheet.insertSheet("Qualified Leads");
  const s1 = env.gs.setupWhatsAppFollowUps();
  const s2 = env.gs.setupWhatsAppFollowUps();
  const mine = () => env.triggers.filter((t) => t.getHandlerFunction() === "sendWhatsAppFollowUps");
  assert.equal(mine().length, 1);
  assert.equal(s1.trigger, "installed");
  assert.equal(s2.trigger, "already installed");
  assert.deepEqual(JSON.parse(JSON.stringify(mine()[0].clock)), { hour: 11, minute: 0, everyDays: 1 });
  assert.equal(mine()[0].type, "CLOCK");
  assert.equal(s1.ready, true);
  assert.ok(!JSON.stringify(s1).includes(FU_SECRET) && !JSON.stringify(s1).includes("example.test"));
  // duplicates (e.g. created by hand) are removed, other handlers untouched
  env.gs.ScriptApp.newTrigger("sendWhatsAppFollowUps").timeBased().atHour(11).everyDays(1).create();
  env.gs.ScriptApp.newTrigger("sendFollowUpDigest").timeBased().atHour(9).everyDays(1).create();
  const s3 = env.gs.setupWhatsAppFollowUps();
  assert.equal(s3.duplicatesRemoved, 1);
  assert.equal(mine().length, 1);
  assert.equal(env.triggers.filter((t) => t.getHandlerFunction() === "sendFollowUpDigest").length, 1);
  // no project time zone: India time
  const noTz = createEnv({ props: READY, scriptTimeZone: "" });
  noTz.gs.setupWhatsAppFollowUps();
  assert.equal(noTz.triggers[0].clock.timeZone, "Asia/Kolkata");
});

// ---------- existing features unchanged ----------

test("existing features: new bot leads still write correctly after setup (follow-up columns left empty)", () => {
  const env = createEnv({ props: READY });
  postLead(env, qualifiedLead());
  env.gs.setupWhatsAppFollowUps();
  const res = postLead(env, qualifiedLead({ leadId: "L-ABCDEF0124", phone: "+919000000002" }));
  assert.equal(res.stored, true);
  const q = env.sheets.get("Qualified Leads");
  const row = rowObject(q, 3);
  assert.equal(row["Lead ID"], "L-ABCDEF0124");
  assert.equal(row["Status"], "New");
  assert.equal(row["Email Status"], "SENT");
  assert.equal(row["Auto Follow-up"], "");
  assert.equal(row[STATUS], "");
  assert.equal(env.fetches.length, 0, "writing a lead never calls the follow-up endpoint");
});

test("existing features: the digest, scoring, status edit and report never call the network", () => {
  // UrlFetchApp does not exist unless a test opts in, so any network call from these would throw.
  const env = createEnv({ props: Object.assign({}, READY) });
  assert.equal(typeof env.gs.UrlFetchApp, "undefined");
  postLead(env, qualifiedLead());
  env.gs.setupWhatsAppFollowUps();
  env.gs.recalculateLeadScores();
  env.gs.sendFollowUpDigest();
  env.gs.generateConversionReport();
  env.gs.setupLeadStatusTracking();
  env.gs.setupFollowUpReminders();
});

test("version is bumped for live follow-ups", () => {
  const env = createEnv();
  assert.equal(env.gs.BOT_CODE_VERSION, "bot-v6.6-follow-up-live");
});

test("source: the Apps Script never talks to Twilio or emails; the dry-run payload is exactly Phase A's", () => {
  const env = createEnv();
  const src = ["sendWhatsAppFollowUps", "callWaFollowUpEndpoint_", "collectWaFollowUpCandidates_", "waFollowUpConfig_", "setupWhatsAppFollowUps", "waFollowUpPayload_"]
    .map((f) => String(env.gs[f])).join("\n").replace(/\/\/[^\n]*/g, ""); // code only, not comments
  assert.doesNotMatch(src, /twilio|ContentSid|Messages\.json|MailApp/i);
  const lead = { id: "L-0000000001", phone: "+919000000001", guest: { destination: "Jaipur", property: "", checkIn: "2026-12-10", checkOut: "2026-12-13" } };
  assert.deepEqual(JSON.parse(JSON.stringify(env.gs.waFollowUpPayload_("dry_run", lead))), { leadId: "L-0000000001", phone: "+919000000001", mode: "dry_run" });
});

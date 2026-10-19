// Week 7: /api/guest-messages/run and /api/guest-messages/ask handlers (run.ts, assistant.ts, queue.ts).
// Intellistay and the Apps Script sink are fakes: no network, no Sheet, no guest is ever contacted.
// Proves: off by default, secret required, dry run stores nothing, queue mode stores each due message once
// (a second run is a duplicate), sink failures are reported and retried next run, Intellistay failures are safe,
// FAQ answers vs escalations, honest guest replies, and no credentials/tokens/guest data in responses or logs.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG, FAKE_PASSWORD, FAKE_TOKEN, GUEST_ADDRESS, GUEST_E164, GUEST_EMAIL, GUEST_MOBILE, GUEST_NAME, LOGIN_OK,
  SPECIAL_REQUEST_TEXT, bookingsResponse, intellistayFetch, rawBooking,
} from "../helpers/intellistay-fixtures.mjs";

const { createGuestMessagesRunHandler } = await import("../../lib/guest-messages/run.ts");
const { createGuestAskHandler, findGuestBooking } = await import("../../lib/guest-messages/assistant.ts");
const { postGuestEnvelope } = await import("../../lib/guest-messages/queue.ts");
const { createIntellistayClient } = await import("../../lib/intellistay/client.ts");
const { getGuestMessagesApiConfig } = await import("../../lib/guest-messages/http.ts");

const API_SECRET = "guest-api-secret-for-tests-0123456789"; // 37 chars, fake
const NOW = new Date("2026-10-18T03:30:00Z"); // 09:00 IST on 18 Oct: booking 101's pre-arrival is due
const SECRETS = [FAKE_PASSWORD, FAKE_TOKEN, GUEST_NAME, "Asha", GUEST_EMAIL, GUEST_MOBILE, GUEST_E164, GUEST_ADDRESS, SPECIAL_REQUEST_TEXT, API_SECRET];

function assertNoSecrets(text, label) {
  for (const s of SECRETS) assert.ok(!String(text).includes(s), label + " must not contain " + s);
}

// In-memory stand-in for the Apps Script sink: same idempotency contract (an ID is stored once).
function fakeSink({ fail = null } = {}) {
  const rows = new Map();
  const envelopes = [];
  const deliver = async (env) => {
    envelopes.push(env);
    if (fail) return { ok: false, reason: fail };
    const id = env.type === "guest_message" ? env.message.messageId : env.escalation.escalationId;
    if (rows.has(id)) return { ok: true, status: "duplicate" };
    rows.set(id, env);
    return { ok: true, status: "stored", emailStatus: "SENT" };
  };
  return { rows, envelopes, deliver };
}

function deps({ bookings = [rawBooking({ specialRequest: SPECIAL_REQUEST_TEXT })], login = LOGIN_OK, sink = fakeSink(), apiEnabled = true, sinkConfigured = true, isConfig } = {}) {
  const logs = [];
  const calls = [];
  return {
    logs, calls, sink,
    d: {
      getApiConfig: () => getGuestMessagesApiConfig(apiEnabled ? { GUEST_MESSAGES_ENABLED: "true", GUEST_MESSAGES_API_SECRET: API_SECRET } : {}),
      getIntellistayConfig: () => isConfig || { status: "ready", config: CONFIG },
      createClient: (config) => createIntellistayClient({
        config, log: (e, m) => logs.push(e + " " + JSON.stringify(m || {})),
        fetchImpl: intellistayFetch({ login, bookings: typeof bookings === "function" ? bookings : { status: 200, body: bookingsResponse(bookings) } }, calls),
      }),
      deliver: sink.deliver,
      sinkConfigured: () => sinkConfigured,
      now: () => NOW,
      nowMs: () => NOW.getTime(),
      log: (e, m) => logs.push(e + " " + JSON.stringify(m || {})),
    },
  };
}

function req(body, { secret = API_SECRET, contentType = "application/json" } = {}) {
  const headers = { "Content-Type": contentType };
  if (secret) headers.Authorization = "Bearer " + secret;
  return new Request("https://example.test/api/guest-messages/run", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}

async function call(handler, body, opts) {
  const res = await handler(req(body, opts));
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text), text };
}

// ---------- run: switches and auth ----------

test("run: OFF (404) unless enabled; misconfigured secret 503; wrong/missing secret 401; bad input 400/415", async () => {
  const off = deps({ apiEnabled: false });
  assert.equal((await call(createGuestMessagesRunHandler(off.d), { mode: "dry_run" })).status, 404);
  assert.equal(getGuestMessagesApiConfig({ GUEST_MESSAGES_ENABLED: "true", GUEST_MESSAGES_API_SECRET: "short" }).status, "invalid");
  const h = createGuestMessagesRunHandler(deps().d);
  assert.equal((await call(h, { mode: "dry_run" }, { secret: "wrong-secret-wrong-secret-wrong-secret" })).status, 401);
  assert.equal((await call(h, { mode: "dry_run" }, { secret: null })).status, 401);
  assert.equal((await call(h, { mode: "send" })).status, 400);
  assert.equal((await call(h, "{nope")).status, 400);
  assert.equal((await call(h, { mode: "dry_run" }, { contentType: "text/plain" })).status, 415);
  assert.equal((await call(h, { mode: "queue", today: "2026-10-20" })).body.field, "today", "today override only in dry_run");
  assert.equal((await call(h, { mode: "dry_run", today: "2026-02-30" })).status, 400);
});

test("run: Intellistay not configured -> 503; Intellistay down -> 502; nothing stored either way", async () => {
  const a = deps({ isConfig: { status: "invalid", problems: ["INTELLISTAY_PASSWORD is not set"] } });
  const r1 = await call(createGuestMessagesRunHandler(a.d), { mode: "queue" });
  assert.equal(r1.status, 503);
  assert.equal(a.sink.envelopes.length, 0);
  const b = deps({ login: { status: 401, body: {} } });
  const r2 = await call(createGuestMessagesRunHandler(b.d), { mode: "queue" });
  assert.deepEqual(r2.body, { ok: false, error: "intellistay_unavailable", reason: "auth_failed" });
  assert.equal(b.sink.envelopes.length, 0);
  const c = deps({ sinkConfigured: false });
  assert.equal((await call(createGuestMessagesRunHandler(c.d), { mode: "queue" })).status, 503);
  assert.equal(c.calls.length, 0, "Intellistay is not even called when the queue is not configured");
});

// ---------- run: dry run and queue ----------

test("run dry_run: plans only, stores nothing, returns no guest data", async () => {
  const x = deps();
  const r = await call(createGuestMessagesRunHandler(x.d), { mode: "dry_run" });
  assert.equal(r.status, 200);
  assert.equal(r.body.today, "2026-10-18");
  assert.equal(r.body.bookings, 1);
  assert.deepEqual(r.body.byStatus, { READY: 1 });
  assert.deepEqual(Object.keys(r.body.items[0]).sort(), ["bookingId", "messageId", "reason", "scheduledDate", "sendBy", "status", "type"]);
  assert.equal(r.body.items[0].sendBy, "2026-10-19");
  assert.equal(x.sink.envelopes.length, 0);
  assertNoSecrets(r.text, "response");
  assertNoSecrets(x.logs.join("\n"), "logs");
  // Preview another day (e.g. a future test booking's check-in date).
  const r2 = await call(createGuestMessagesRunHandler(deps().d), { mode: "dry_run", today: "2026-10-20" });
  assert.deepEqual(r2.body.items.map((i) => i.type + ":" + i.status), ["CHECK_IN:READY"]);
});

test("run queue: stores each due message once; a duplicate run creates nothing new", async () => {
  const sink = fakeSink();
  const bookings = [rawBooking({ specialRequest: SPECIAL_REQUEST_TEXT }), rawBooking({ bookingId: 102, bookingStatusId: 5, bookingStatus: "Cancelled" }),
    rawBooking({ bookingId: 103, checkInDate: "2026-10-01", checkOutDate: "2026-10-03" })];
  const h = createGuestMessagesRunHandler(deps({ bookings, sink }).d);
  const first = await call(h, { mode: "queue" });
  assert.equal(first.status, 200);
  assert.equal(first.body.complete, true);
  assert.deepEqual(first.body.deliveries, { stored: 2 });
  assert.deepEqual(first.body.byStatus, { READY: 1, SKIPPED: 1 }, "cancelled booking is SKIPPED, past booking ignored");
  const ready = Array.from(sink.rows.values()).find((e) => e.message.status === "READY").message;
  assert.equal(ready.type, "PRE_ARRIVAL");
  assert.equal(ready.guestPhone, GUEST_E164, "the team gets the phone to send the message");
  assert.match(ready.message, /^Hi Asha,/);
  assert.equal(ready.specialRequest, "yes");
  assert.equal(ready.scheduledDate, "2026-10-18");
  assert.equal(ready.sendBy, "2026-10-19", "the Send By date reaches the team queue");
  assertNoSecrets(first.text, "response");

  const second = await call(h, { mode: "queue" });
  assert.deepEqual(second.body.deliveries, { duplicate: 2 });
  assert.equal(sink.rows.size, 2, "no duplicate queue entries");
});

test("run queue: sink failures are reported (complete=false) and nothing pretends to be stored", async () => {
  const x = deps({ sink: fakeSink({ fail: "http_5xx" }) });
  const r = await call(createGuestMessagesRunHandler(x.d), { mode: "queue" });
  assert.equal(r.status, 200);
  assert.equal(r.body.complete, false);
  assert.deepEqual(r.body.deliveries, { failed: 1 });
  assert.equal(r.body.items[0].reason, "http_5xx");
  // The next run, with the sink back, stores it (same ID).
  const ok = fakeSink();
  const r2 = await call(createGuestMessagesRunHandler(deps({ sink: ok }).d), { mode: "queue" });
  assert.deepEqual(r2.body.deliveries, { stored: 1 });
  assert.equal(Array.from(ok.rows.keys())[0], r.body.items[0].messageId);
});

// ---------- queue sink (Apps Script delivery) ----------

test("sink: refuses non-Apps-Script URLs, maps replies, secret travels only in the body to script.google.com", async () => {
  const env = { type: "guest_message", message: { messageId: "GM-000000000000" } };
  assert.deepEqual(await postGuestEnvelope(env, { url: "https://evil.example/exec", secret: "s" }), { ok: false, reason: "not_configured" });
  assert.deepEqual(await postGuestEnvelope(env, { url: null, secret: "s" }), { ok: false, reason: "not_configured" });
  const sent = [];
  const reply = (body, status = 200) => async (url, init) => { sent.push({ url, init }); return new Response(typeof body === "string" ? body : JSON.stringify(body), { status }); };
  const url = "https://script.google.com/macros/s/x/exec";
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "sink-secret", fetchImpl: reply({ ok: true, stored: true }) }), { ok: true, status: "stored", emailStatus: "UNKNOWN" });
  assert.equal(JSON.parse(sent[0].init.body).secret, "sink-secret");
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "s", fetchImpl: reply({ ok: true, duplicate: true, updated: true }) }), { ok: true, status: "updated" });
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "s", fetchImpl: reply({ ok: true, duplicate: true }) }), { ok: true, status: "duplicate" });
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "s", fetchImpl: reply({ ok: false, error: "busy" }) }), { ok: false, reason: "busy" });
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "s", fetchImpl: reply({ ok: false, error: "rejected" }) }), { ok: false, reason: "rejected" });
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "s", fetchImpl: reply("<html>") }), { ok: false, reason: "bad_response" });
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "s", fetchImpl: reply({}, 500) }), { ok: false, reason: "http_5xx" });
  assert.deepEqual(await postGuestEnvelope(env, { url, secret: "s", fetchImpl: async () => { throw new TypeError("down"); } }), { ok: false, reason: "network" });
});

// ---------- ask: FAQ and escalation ----------

function ask(x, body) { return call(createGuestAskHandler(x.d), body); }

test("ask: a known question is answered (contact needs no booking lookup)", async () => {
  const x = deps();
  const r = await ask(x, { question: "How can I contact you?" });
  assert.deepEqual(r.body, { ok: true, outcome: "answered", intent: "contact", reply: "You can reach us on +91 95030 02629 or studios.jaipur@gmail.com." });
  assert.equal(x.calls.length, 0, "no Intellistay call");
  assert.equal(x.sink.envelopes.length, 0);
});

test("ask: booking status answered only for the verified guest (phone must match)", async () => {
  const x = deps();
  const r = await ask(x, { question: "Is my booking confirmed?", phone: GUEST_E164, bookingCode: "bk101" });
  assert.equal(r.body.outcome, "answered");
  assert.match(r.body.reply, /BK101 for 20 Oct 2026 to 22 Oct 2026 shows as "Reserved"/);
  // Someone else's phone with the right code gets nothing about the booking: escalated instead.
  const y = deps();
  const r2 = await ask(y, { question: "Is my booking confirmed?", phone: "+919000000001", bookingCode: "BK101" });
  assert.equal(r2.body.outcome, "escalated");
  assert.equal(r2.body.reason, "MISSING_INFORMATION");
  assert.ok(!r2.text.includes("20 Oct"));
});

test("ask: check-in time is answered end to end for a verified Studio 925 guest (engine-listed, confirmed mapping)", async () => {
  // Raw Intellistay room exactly as the confirmed mapping expects: branch 1, roomId 5, roomTypeId 2, "Studio 925".
  const studio925 = rawBooking({ branchId: 1, branchName: "Ritumbhara",
    roomDetails: [{ roomTypeName: "Studio", roomNo: "Studio 925", roomTypeId: 2, roomId: 5, rate: 3333 }] });
  const x = deps({ bookings: [studio925] });
  const r = await ask(x, { question: "What time is check-in?", phone: GUEST_E164 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, outcome: "answered", intent: "check_in_time", reply: "Check-in at Studio 925 is from 13:00 – 23:00." });
  assert.ok(x.calls.length >= 1, "the guest's booking was looked up in Intellistay");
  assert.equal(x.sink.envelopes.length, 0, "answered, so nothing is escalated or stored");
  assertNoSecrets(r.text, "response");
  // Without a phone the stay is unknown, so the same question still escalates (no guessed times).
  const y = deps({ bookings: [studio925] });
  const r2 = await ask(y, { question: "What time is check-in?" });
  assert.equal(r2.body.outcome, "escalated");
  assert.equal(r2.body.reason, "MISSING_INFORMATION");
  assert.equal(y.calls.length, 0, "no Intellistay lookup without guest details");
});

test("ask: unknown question -> escalation stored, honest reply, minimal context", async () => {
  const x = deps();
  const r = await ask(x, { question: "Can you recommend a restaurant nearby?", phone: GUEST_E164, channel: "whatsapp", messageId: "SM0123456789" });
  assert.equal(r.body.outcome, "escalated");
  assert.equal(r.body.reason, "UNSUPPORTED_QUESTION");
  assert.equal(r.body.stored, true);
  assert.match(r.body.escalationId, /^E-[0-9A-F]{10}$/);
  assert.match(r.body.reply, /passed it to our team/);
  const e = x.sink.envelopes[0].escalation;
  assert.deepEqual(Object.keys(e).sort(), ["bookingCode", "channel", "escalationId", "guestPhone", "intent", "question", "reason", "receivedAt"]);
  assert.equal(e.guestPhone, GUEST_E164);
  assert.equal(e.bookingCode, null);
  // The same incoming message retried -> same ID -> no second row.
  const again = await call(createGuestAskHandler(x.d), { question: "Can you recommend a restaurant nearby?", phone: GUEST_E164, channel: "whatsapp", messageId: "SM0123456789" });
  assert.equal(again.body.escalationId, r.body.escalationId);
  assert.equal(x.sink.rows.size, 1);
});

test("ask: explicit human request and cancellations escalate; no booking is touched", async () => {
  for (const [q, reason] of [["I want to talk to a human", "HUMAN_REQUESTED"], ["Please cancel my booking", "CANCELLATION"], ["I need a refund", "PAYMENT"]]) {
    const x = deps();
    const r = await ask(x, { question: q, phone: GUEST_E164 });
    assert.equal(r.body.reason, reason, q);
    assert.equal(x.calls.length, 0, "Intellistay is not called for an escalation that does not need the booking");
  }
});

test("ask: urgent problems, booking changes and unconfigured facts (Wi-Fi) escalate to the team queue; nothing is invented", async () => {
  // RIAA004 is the code of the real future test booking on the Intellistay TEST server.
  const booking = rawBooking({ bookingId: 4, bookingCode: "RIAA004", checkInDate: "2026-10-20T14:00:00", checkOutDate: "2026-10-21T11:00:00", noOfDays: 1 });
  const cases = [
    ["The water heater is not working", "URGENT_ISSUE", null],
    ["Can I extend my stay by one night?", "BOOKING_CHANGE", null],
    ["Can I check in early tomorrow?", "BOOKING_CHANGE", null],
    ["What is the wifi password?", "MISSING_INFORMATION", "wifi_details"],
    ["Do you have a swimming pool?", "UNSUPPORTED_QUESTION", null],
  ];
  for (const [question, reason, intent] of cases) {
    const x = deps({ bookings: [booking] });
    const r = await ask(x, { question, phone: GUEST_E164, bookingCode: "RIAA004", channel: "whatsapp" });
    assert.equal(r.body.outcome, "escalated", question);
    assert.equal(r.body.reason, reason, question);
    assert.equal(r.body.intent, intent, question);
    assert.equal(r.body.stored, true, question);
    assert.match(r.body.reply, /passed it to our team/, question);
    assert.equal(x.calls.length, 0, "no Intellistay call (and no booking change) for: " + question);
    const e = x.sink.envelopes[0];
    assert.equal(e.type, "guest_escalation", question);
    assert.equal(e.escalation.reason, reason, question);
    assert.ok(!/password|pool|minutes|hours/i.test(r.body.reply.replace(/passed it to our team/, "")), "no invented answer for: " + question);
  }
});

test("ask: when the escalation cannot be stored, the guest is told to call (never promised a reply)", async () => {
  const x = deps({ sink: fakeSink({ fail: "timeout" }) });
  const r = await ask(x, { question: "I want to talk to a human" });
  assert.equal(r.body.stored, false);
  assert.match(r.body.reply, /Please call us on \+91 95030 02629/);
});

test("ask: Intellistay failure during lookup -> safe escalation; input validation", async () => {
  const x = deps({ bookings: () => ({ status: 500, body: {} }) });
  const r = await ask(x, { question: "What time is check-in?", phone: GUEST_E164 });
  assert.equal(r.body.outcome, "escalated");
  assert.equal(r.body.reason, "MISSING_INFORMATION");
  const h = createGuestAskHandler(deps().d);
  assert.equal((await call(h, { question: "" })).body.field, "question");
  assert.equal((await call(h, { question: "x".repeat(501) })).body.field, "question");
  assert.equal((await call(h, { question: "hi", phone: "9876543210" })).body.field, "phone");
  assert.equal((await call(h, { question: "hi", bookingCode: "<script>" })).body.field, "bookingCode");
  assert.equal((await call(h, { question: "hi", messageId: "x" })).body.field, "messageId");
});

test("findGuestBooking: phone + code, or phone alone with exactly one current booking", () => {
  const b = (o) => Object.assign({ bookingId: "1", bookingCode: "A1", checkOutDate: "2026-10-22", guest: { firstName: null, phone: GUEST_E164 } }, o);
  assert.equal(findGuestBooking([b()], GUEST_E164, null, "2026-10-18").bookingCode, "A1");
  assert.equal(findGuestBooking([b(), b({ bookingId: "2", bookingCode: "A2" })], GUEST_E164, null, "2026-10-18"), null, "ambiguous");
  assert.equal(findGuestBooking([b(), b({ bookingId: "2", bookingCode: "A2" })], GUEST_E164, "a2", "2026-10-18").bookingId, "2");
  assert.equal(findGuestBooking([b({ checkOutDate: "2026-10-01" })], GUEST_E164, null, "2026-10-18"), null, "ended stays are ignored");
  assert.equal(findGuestBooking([b()], null, "A1", "2026-10-18"), null, "no phone, no booking");
});

test("security: responses and logs never contain credentials, tokens or guest PII", async () => {
  const x = deps();
  const out = [];
  out.push((await call(createGuestMessagesRunHandler(x.d), { mode: "dry_run" })).text);
  out.push((await call(createGuestMessagesRunHandler(x.d), { mode: "queue" })).text);
  out.push((await call(createGuestAskHandler(x.d), { question: "What time is check-in?", phone: GUEST_E164 })).text);
  assertNoSecrets(x.logs.join("\n"), "logs");
  // Responses may echo nothing but IDs, dates, counts and reason codes (the guest's own phone is never returned).
  out.forEach((t) => assertNoSecrets(t, "response"));
});

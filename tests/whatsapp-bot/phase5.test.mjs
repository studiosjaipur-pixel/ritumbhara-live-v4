// Week 5 stretch, Phase 5: qualified-lead and handoff delivery to the Google Apps Script sink.
// The Apps Script endpoint is mocked (idempotent by ID, counts rows and emails). No network, fake secrets only.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const { createConversationStore } = await import("../../lib/whatsapp-bot/store.ts");
const { createConversationHandler } = await import("../../lib/whatsapp-bot/conversation.ts");
const { postLeadEnvelope, SINK_TOTAL_BUDGET_MS } = await import("../../lib/leads/qualified-lead-sink.ts");
const { buildQualifiedLeadPayload, buildHandoffPayload } = await import("../../lib/leads/qualified-lead.ts");
const { buildCatalog } = await import("../../lib/whatsapp-bot/catalog.ts");
const { groqExtract } = await import("../../lib/whatsapp-bot/groq-extract.ts");

const GUEST = "+919000000001";
const SINK_URL = "https://script.google.com/macros/s/FAKE_DEPLOYMENT/exec";
const SINK_SECRET = "fake_qualified_sink_secret_ZZSINK";
const CONFIG = {
  enabled: true,
  twilioAuthToken: "fake_twilio_ZZTWILIO",
  twilioWebhookUrl: "https://example-preview.vercel.app/api/whatsapp/inbound",
  twilioAccountSid: null,
  botTo: "+14155238886",
  handoffNumber: "+919000000009",
  groqApiKey: null,
  groqModel: "llama-3.1-8b-instant",
  upstashRedisRestUrl: "https://fake-redis.example.com",
  upstashRedisRestToken: "fake_redis_ZZREDIS",
};
const catalog = buildCatalog();
const SUCCESS_REPLY = /Your request has been shared with our team/;
const FAILURE_REPLY = /couldn't submit your request to our team right now/;

// ---------- mock Apps Script endpoint ----------

function mockAppsScript(mode = {}) {
  const state = { rows: {}, emails: 0, requests: [], mode };
  async function fetchImpl(url, init) {
    const body = JSON.parse(init.body);
    state.requests.push({ url, init, body });
    const m = state.mode;
    if (m.hang) return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    if (m.network) throw new TypeError("fetch failed");
    if (m.status) { const s = m.status; if (m.onceStatus) state.mode = {}; return new Response("error", { status: s }); }
    if (m.html) return new Response("<html>Sign in</html>", { status: 200 });
    if (body.secret !== SINK_SECRET) return Response.json({ ok: false, error: "rejected" });
    const id = body.type === "qualified_lead" ? body.lead.leadId : body.handoff.handoffId;
    if (state.rows[id]) return Response.json({ ok: true, duplicate: true });
    state.rows[id] = body;
    const emailOk = !m.emailFails;
    if (emailOk) state.emails++;
    return Response.json({ ok: true, stored: true, emailStatus: emailOk ? "SENT" : "FAILED" });
  }
  return { state, fetchImpl };
}

function sinkOpts(sink, extra = {}) {
  return { url: SINK_URL, secret: SINK_SECRET, fetchImpl: sink.fetchImpl, sleep: async () => {}, log: () => {}, ...extra };
}

function setup({ sink = mockAppsScript(), extract, logs = [] } = {}) {
  const fake = createFakeRedis();
  const store = createConversationStore(fake.client);
  const events = { qualified: [], handoffs: [] };
  let n = 0;
  const handler = createConversationHandler({
    createStore: () => store,
    now: () => new Date(fake.state.nowMs),
    log: (e, m) => logs.push(e + " " + JSON.stringify(m || {})),
    sleep: async (ms) => fake.advance(ms),
    emitQualified: (lead) => { events.qualified.push(lead); return postLeadEnvelope({ type: "qualified_lead", lead }, sinkOpts(sink, { log: (e, m) => logs.push("sink:" + e + " " + JSON.stringify(m || {})) })); },
    emitHandoff: (handoff) => { events.handoffs.push(handoff); return postLeadEnvelope({ type: "lead_handoff", handoff }, sinkOpts(sink)); },
    extract,
  });
  async function send(text, config = CONFIG) {
    n++;
    const res = await handler({ messageSid: "SM" + String(n).padStart(32, "0"), accountSid: "AC" + "ab".repeat(16), from: GUEST, to: "+14155238886", body: text, numMedia: 0, profileName: "Test Guest", waId: null, bodyStatus: "ok" }, config);
    fake.advance(5000);
    return res.reply;
  }
  return { fake, store, sink, events, logs, send, conv: () => store.getConversation(GUEST) };
}

async function toConfirm(h, details = "Studio 925 from 10 Dec to 13 Dec, 2 guests") {
  await h.send("Hi");
  await h.send(details);
  return h.send("airport pickup");
}

// ======================================================================

test("1. LEAD_QUALIFIED is emitted only after YES", async () => {
  const h = setup();
  const summary = await toConfirm(h);
  assert.match(summary, /Please confirm/);
  assert.equal(h.events.qualified.length, 0);
  await h.send("hmm");
  assert.equal(h.events.qualified.length, 0);
  assert.match(await h.send("YES"), SUCCESS_REPLY);
  assert.equal(h.events.qualified.length, 1);
});

test("2-4. payload has the required fields, a stable lead ID and recalculated nights", async () => {
  const h = setup();
  await toConfirm(h);
  await h.send("yes");
  const lead = h.events.qualified[0];
  assert.deepEqual(Object.keys(lead).sort(), ["checkIn", "checkOut", "conversationState", "destination", "guests", "handoffNumber", "leadId", "nights", "notes", "phone", "property", "qualificationStatus", "receivedAt", "ref", "requirements", "site", "source", "timestamp"].sort());
  assert.match(lead.leadId, /^L-[0-9A-F]{10}$/);
  assert.deepEqual(
    [lead.phone, lead.destination, lead.property, lead.checkIn, lead.checkOut, lead.nights, lead.guests, lead.requirements, lead.ref, lead.source, lead.conversationState, lead.qualificationStatus, lead.site, lead.handoffNumber],
    [GUEST, "Jaipur", "Studio 925", "2026-12-10", "2026-12-13", 3, 2, "airport pickup", "DIRECT", "whatsapp-bot-sandbox", "HANDED_OFF", "QUALIFIED", "example-preview.vercel.app", "+91 9000000009"]);
  const body = JSON.stringify(lead);
  for (const s of ["Test Guest", "wa:conv", "ZZTWILIO", "ZZREDIS", "attempts", "botTurns"]) assert.equal(body.includes(s), false, s); // minimal data only
  const c = await h.conv();
  assert.equal(c.leadId, lead.leadId); // same ID stored with the conversation
});

const QUALIFIED = {
  leadId: "L-0123456789", outcome: "QUALIFIED", channel: "sandbox", guestWhatsApp: GUEST, guestName: "x", ref: "W-FLOATING", prefillSource: "none",
  fields: { checkIn: "2026-12-10", checkOut: "2026-12-13", guests: 2, guestsHint: null, destination: "jaipur", property: "studio-925", requirements: "" },
  nights: 99, notes: [], conversationStartedAt: "x", handedOffAt: "2026-10-07T10:00:00.000Z", botTurns: 5,
};
const CTX = { catalog, site: "example.com", handoffNumber: "+91 9000000009", now: new Date("2026-10-07T10:00:01Z") };

test("4b. nights come from the dates, never from the incoming value", () => {
  const r = buildQualifiedLeadPayload(QUALIFIED, CTX);
  assert.ok(r.ok);
  assert.equal(r.payload.nights, 3);
});

test("5-8. invalid property / destination / dates / guests are rejected before sending", () => {
  const f = QUALIFIED.fields;
  const cases = [
    [{ property: "fake-palace" }, "property"],
    [{ property: "studio-502-alwar" }, "property"], // real property, wrong destination
    [{ destination: "goa", property: null }, "destination"],
    [{ checkIn: "2026-02-30" }, "dates"],
    [{ checkIn: "10 Dec" }, "dates"],
    [{ checkOut: "2026-12-10" }, "nights"],
    [{ checkOut: "2027-06-01" }, "nights"],
    [{ guests: 0 }, "guests"],
    [{ guests: 21 }, "guests"],
    [{ guests: 2.5 }, "guests"],
    [{ requirements: "x".repeat(301) }, "requirements"],
    [{ requirements: null }, "requirements"],
  ];
  for (const [patch, problem] of cases) {
    const r = buildQualifiedLeadPayload({ ...QUALIFIED, fields: { ...f, ...patch } }, CTX);
    assert.equal(r.ok, false, JSON.stringify(patch));
    assert.ok(r.problems.includes(problem), JSON.stringify(patch) + " -> " + r.problems);
  }
  assert.equal(buildQualifiedLeadPayload({ ...QUALIFIED, outcome: "HUMAN_REQUESTED" }, CTX).ok, false);
  assert.equal(buildQualifiedLeadPayload({ ...QUALIFIED, leadId: "L-1" }, CTX).ok, false);
  assert.equal(buildQualifiedLeadPayload({ ...QUALIFIED, guestWhatsApp: "9000" }, CTX).ok, false);
  assert.equal(buildQualifiedLeadPayload({ ...QUALIFIED, ref: "<script>" }, CTX).payload.ref, "DIRECT");
});

test("5-8b. a corrupted conversation is never sent: the guest is told it could not be submitted", async () => {
  const h = setup();
  await toConfirm(h);
  const c = await h.conv();
  c.fields.destination = "goa"; // simulate bad stored data
  c.fields.property = null;
  await h.store.saveConversation(c, 3600);
  const reply = await h.send("YES");
  assert.match(reply, FAILURE_REPLY);
  assert.equal(h.sink.state.requests.length, 0);
  assert.equal((await h.conv()).state, "CONFIRM");
  assert.ok(h.logs.some((l) => l.startsWith("lead_invalid") && l.includes("destination")));
});

test("9-10. the sink posts the expected envelope; the secret is in the JSON body, never in the URL or headers", async () => {
  const sink = mockAppsScript();
  const r = buildQualifiedLeadPayload(QUALIFIED, CTX);
  const res = await postLeadEnvelope({ type: "qualified_lead", lead: r.payload }, sinkOpts(sink));
  assert.deepEqual(res, { ok: true, status: "stored", emailStatus: "SENT" });
  const req = sink.state.requests[0];
  assert.equal(req.url, SINK_URL);
  assert.equal(req.init.method, "POST");
  assert.equal(req.init.headers["Content-Type"], "application/json");
  assert.equal(req.init.redirect, "follow");
  assert.deepEqual(Object.keys(req.body).sort(), ["lead", "secret", "type"]);
  assert.equal(req.body.secret, SINK_SECRET);
  assert.equal(req.body.type, "qualified_lead");
  assert.deepEqual(req.body.lead, r.payload);
  assert.equal(JSON.stringify(req.init.headers).includes(SINK_SECRET), false);
  assert.equal(req.url.includes(SINK_SECRET), false);
});

test("sink configuration: missing settings or a non-Apps-Script URL -> not_configured, nothing sent", async () => {
  const sink = mockAppsScript();
  const payload = buildQualifiedLeadPayload(QUALIFIED, CTX).payload;
  for (const extra of [{ url: null }, { secret: null }, { url: "https://evil.example.com/hook" }, { url: "http://script.google.com/x" }]) {
    assert.deepEqual(await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(sink, extra)), { ok: false, reason: "not_configured" });
  }
  assert.equal(sink.state.requests.length, 0);
});

test("11. timeout: one bounded retry, then a failure result", async () => {
  const sink = mockAppsScript({ hang: true });
  const payload = buildQualifiedLeadPayload(QUALIFIED, CTX).payload;
  const t0 = Date.now();
  const res = await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(sink, { attemptTimeoutMs: 40, totalBudgetMs: 2000 }));
  assert.deepEqual(res, { ok: false, reason: "timeout" });
  assert.equal(sink.state.requests.length, 2);
  assert.ok(Date.now() - t0 < 2000);
  assert.ok(SINK_TOTAL_BUDGET_MS <= 8000);
});

test("12. 4xx: not retried", async () => {
  const sink = mockAppsScript({ status: 403 });
  const payload = buildQualifiedLeadPayload(QUALIFIED, CTX).payload;
  assert.deepEqual(await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(sink)), { ok: false, reason: "http_4xx" });
  assert.equal(sink.state.requests.length, 1);
  const html = mockAppsScript({ html: true });
  assert.deepEqual(await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(html)), { ok: false, reason: "bad_response" });
  const wrongSecret = mockAppsScript();
  assert.deepEqual(await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(wrongSecret, { secret: "nope" })), { ok: false, reason: "rejected" });
});

test("13. 5xx: retried once; succeeds when the second attempt works", async () => {
  const payload = buildQualifiedLeadPayload(QUALIFIED, CTX).payload;
  const always = mockAppsScript({ status: 503 });
  assert.deepEqual(await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(always)), { ok: false, reason: "http_5xx" });
  assert.equal(always.state.requests.length, 2);
  const once = mockAppsScript({ status: 500, onceStatus: true });
  assert.deepEqual(await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(once)), { ok: true, status: "stored", emailStatus: "SENT" });
  assert.equal(once.state.requests.length, 2);
});

test("14-15. the same lead sent twice is idempotent: one row, one email, both treated as delivered", async () => {
  const sink = mockAppsScript();
  const payload = buildQualifiedLeadPayload(QUALIFIED, CTX).payload;
  const a = await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(sink));
  const b = await postLeadEnvelope({ type: "qualified_lead", lead: payload }, sinkOpts(sink));
  assert.equal(a.ok && a.status, "stored");
  assert.equal(b.ok && b.status, "duplicate");
  assert.equal(Object.keys(sink.state.rows).length, 1);
  assert.equal(sink.state.emails, 1);
});

test("16. successful delivery -> success reply, HANDED_OFF, delivered flag set", async () => {
  const h = setup();
  await toConfirm(h);
  const reply = await h.send("YES");
  assert.equal(reply, "Thanks! Your request has been shared with our team. This is not a booking yet: they'll check availability and continue with you on WhatsApp at +91 9000000009.");
  assert.doesNotMatch(reply, /wa\.me/);
  const c = await h.conv();
  assert.equal(c.state, "HANDED_OFF");
  assert.equal(c.outcome, "QUALIFIED");
  assert.equal(c.leadDelivered, true);
  assert.equal(h.sink.state.emails, 1);
});

test("17. failed delivery never claims success; YES again retries the SAME lead ID", async () => {
  const sink = mockAppsScript({ status: 503 });
  const h = setup({ sink });
  await toConfirm(h);
  const reply = await h.send("YES");
  assert.match(reply, FAILURE_REPLY);
  assert.doesNotMatch(reply, /shared with our team|Apps Script|503|Redis|Groq/i);
  let c = await h.conv();
  assert.equal(c.state, "CONFIRM");
  assert.equal(c.outcome, null);
  assert.equal(c.leadDelivered, false);
  sink.state.mode = {}; // the sink recovers
  assert.match(await h.send("yes"), SUCCESS_REPLY);
  c = await h.conv();
  assert.equal(c.state, "HANDED_OFF");
  assert.equal(h.events.qualified.length, 2);
  assert.equal(h.events.qualified[0].leadId, h.events.qualified[1].leadId);
  assert.equal(Object.keys(sink.state.rows).length, 1);
});

test("18. email failure after storage: guest told it was received, no second row on a later retry", async () => {
  const sink = mockAppsScript({ emailFails: true });
  const h = setup({ sink });
  await toConfirm(h);
  assert.match(await h.send("YES"), SUCCESS_REPLY);
  assert.equal(Object.keys(sink.state.rows).length, 1);
  assert.equal(sink.state.emails, 0);
  assert.ok(h.logs.some((l) => l.startsWith("lead_delivered") && l.includes('"email":"FAILED"')));
  // A re-sent event (e.g. a retried delivery) is recognised as a duplicate.
  const again = await postLeadEnvelope({ type: "qualified_lead", lead: h.events.qualified[0] }, sinkOpts(sink));
  assert.equal(again.ok && again.status, "duplicate");
  assert.equal(Object.keys(sink.state.rows).length, 1);
  assert.equal(await h.send("YES"), null); // handed off: the bot stays silent, nothing is resent
});

test("19. HUMAN is never QUALIFIED: it is delivered as a separate LEAD_HANDOFF", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("Jaipur 10 Dec to 13 Dec");
  const reply = await h.send("HUMAN");
  assert.equal(reply, "Sure. Our team will continue with you on WhatsApp at +91 9000000009.");
  assert.equal(h.events.qualified.length, 0);
  assert.equal(h.events.handoffs.length, 1);
  const ho = h.events.handoffs[0];
  assert.equal(ho.qualificationStatus, "NOT_QUALIFIED");
  assert.equal(ho.reason, "HUMAN_REQUESTED");
  assert.match(ho.handoffId, /^H-[0-9A-F]{10}$/);
  assert.deepEqual([ho.destination, ho.checkIn, ho.checkOut, ho.nights, ho.guests], ["Jaipur", "2026-12-10", "2026-12-13", 3, null]);
  assert.equal("leadId" in ho, false);
  assert.equal((await h.conv()).outcome, "HUMAN_REQUESTED");
  // Handoff delivery failure: the guest is pointed to the team instead of being promised a follow-up.
  const h2 = setup({ sink: mockAppsScript({ network: true }) });
  await h2.send("Hi");
  assert.equal(await h2.send("agent"), "Please contact our team directly on WhatsApp at +91 9000000009, and they'll help you from there.");
  // The ask-limit handoff is also NOT qualified.
  const h3 = setup();
  await h3.send("Hi");
  await h3.send("?");
  await h3.send("??");
  assert.equal(h3.events.handoffs[0].reason, "NEEDS_FOLLOW_UP");
  assert.equal(h3.events.qualified.length, 0);
});

test("20. the AI cannot emit LEAD_QUALIFIED (only the guest's YES in CONFIRM does)", async () => {
  const fakeGroq = async (url, init) => Response.json({ choices: [{ message: { content: JSON.stringify({ checkIn: "2026-12-10", checkOut: "2026-12-13", guests: 2, destination: "Jaipur", property: null, requirements: null, intent: "confirmation" }) }, finish_reason: "stop" }] });
  const extract = (text, ctx) => groqExtract(text, ctx, { apiKey: "k", model: "m", fetchImpl: fakeGroq });
  const h = setup({ extract });
  await h.send("Hi");
  const r = await h.send("yes book it all, confirm everything for me in the pink city");
  assert.doesNotMatch(r, SUCCESS_REPLY);
  assert.equal(h.events.qualified.length, 0);
  assert.notEqual((await h.conv()).state, "HANDED_OFF");
});

test("21. no secrets, sink URL, full numbers or message text in logs", async () => {
  const logs = [];
  const h = setup({ logs });
  await h.send("Hi");
  await h.send("Studio 925 from 10 Dec to 13 Dec, 2 guests");
  await h.send("my secret anniversary surprise");
  await h.send("YES");
  const all = logs.join("\n");
  assert.ok(logs.some((l) => l.startsWith("lead_delivered")));
  for (const s of [SINK_SECRET, SINK_URL, "FAKE_DEPLOYMENT", GUEST, "anniversary", "ZZREDIS", "ZZTWILIO"]) assert.equal(all.includes(s), false, s);
});

// ---------- default wiring through the event bus and environment variables ----------

let savedEnv, savedFetch;
beforeEach(() => {
  savedEnv = { url: process.env.QUALIFIED_LEAD_SINK_URL, secret: process.env.QUALIFIED_LEAD_SINK_SECRET };
  savedFetch = globalThis.fetch;
});
afterEach(() => {
  if (savedEnv.url === undefined) delete process.env.QUALIFIED_LEAD_SINK_URL; else process.env.QUALIFIED_LEAD_SINK_URL = savedEnv.url;
  if (savedEnv.secret === undefined) delete process.env.QUALIFIED_LEAD_SINK_SECRET; else process.env.QUALIFIED_LEAD_SINK_SECRET = savedEnv.secret;
  globalThis.fetch = savedFetch;
});

test("bus wiring: LEAD_QUALIFIED reaches the sink via env settings; unset settings fail safely", async () => {
  const fake = createFakeRedis();
  const store = createConversationStore(fake.client);
  const handler = createConversationHandler({ createStore: () => store, now: () => new Date(fake.state.nowMs), log: () => {}, sleep: async () => {} });
  let n = 0;
  const send = async (text) => { n++; const r = await handler({ messageSid: "SM" + String(n).padStart(32, "0"), accountSid: "", from: GUEST, to: "+14155238886", body: text, numMedia: 0, profileName: null, waId: null, bodyStatus: "ok" }, CONFIG); fake.advance(5000); return r.reply; };
  const origWarn = console.warn; console.warn = () => {};
  try {
    delete process.env.QUALIFIED_LEAD_SINK_URL;
    delete process.env.QUALIFIED_LEAD_SINK_SECRET;
    await send("Hi"); await send("Studio 925 from 10 Dec to 13 Dec, 2 guests"); await send("no");
    assert.match(await send("YES"), FAILURE_REPLY); // not configured -> never claims success
    process.env.QUALIFIED_LEAD_SINK_URL = SINK_URL;
    process.env.QUALIFIED_LEAD_SINK_SECRET = SINK_SECRET;
    const sink = mockAppsScript();
    globalThis.fetch = sink.fetchImpl;
    assert.match(await send("YES"), SUCCESS_REPLY);
    assert.equal(sink.state.requests.length, 1);
    assert.equal(sink.state.requests[0].body.type, "qualified_lead");
  } finally {
    console.warn = origWarn;
  }
});

test("handoff payload keeps only valid known fields", () => {
  const h = { handoffId: "H-0123456789", reason: "HUMAN_REQUESTED", channel: "sandbox", guestWhatsApp: GUEST, ref: null, conversationStartedAt: "x", handedOffAt: "y", botTurns: 2,
    fields: { checkIn: "2026-12-10", checkOut: "2026-12-09", guests: 40, guestsHint: null, destination: "goa", property: "fake", requirements: "late\u0000 arrival" } };
  const r = buildHandoffPayload(h, CTX);
  assert.ok(r.ok);
  assert.deepEqual([r.payload.checkIn, r.payload.checkOut, r.payload.nights, r.payload.guests, r.payload.destination, r.payload.property, r.payload.requirements, r.payload.ref],
    ["2026-12-10", null, null, null, null, null, "late arrival", "DIRECT"]);
  assert.equal(buildHandoffPayload({ ...h, reason: "QUALIFIED" }, CTX).ok, false);
});

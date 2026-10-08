// Post-handoff acknowledgement, Groq model/request fix and handoff-number checks.
// Fake Redis and mocked Groq only: no network, fake credentials. "Today" is 7 Oct 2026, 12:00 India time.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const { createConversationStore, STORE_TTL } = await import("../../lib/whatsapp-bot/store.ts");
const { createConversationHandler } = await import("../../lib/whatsapp-bot/conversation.ts");
const { MESSAGES, postHandoffAck, handoffHuman, handoffDeliveryFailed } = await import("../../lib/whatsapp-bot/messages.ts");
const { POST_HANDOFF_ACK_INTERVAL_MS } = await import("../../lib/whatsapp-bot/state-machine.ts");
const { getBotConfig, DEFAULT_GROQ_MODEL } = await import("../../lib/whatsapp-bot/config.ts");
const { formatPhoneForDisplay } = await import("../../lib/whatsapp-bot/address.ts");
const {
  groqExtract, buildGroqRequestBody, isReasoningModel, GROQ_MAX_OUTPUT_TOKENS, GROQ_MAX_OUTPUT_TOKENS_REASONING,
} = await import("../../lib/whatsapp-bot/groq-extract.ts");

const GUEST = "+919000000001";
const HANDOFF_E164 = "+919503002629";
const HANDOFF_DISPLAY = "+91 9503002629";
const GROQ_KEY = "fake_groq_key_for_tests_only_QQKEY";
const CONFIG = {
  enabled: true,
  twilioAuthToken: "fake_twilio_token_QQTWILIO",
  twilioWebhookUrl: "https://example-preview.vercel.app/api/whatsapp/inbound",
  twilioAccountSid: null,
  botTo: "+14155238886",
  handoffNumber: HANDOFF_E164,
  groqApiKey: GROQ_KEY,
  groqModel: DEFAULT_GROQ_MODEL,
  upstashRedisRestUrl: "https://fake-redis.example.com",
  upstashRedisRestToken: "fake_redis_token_QQREDIS",
  redisNamespace: "production",
};
const ACK = "Our team already has your request and will continue with you here on WhatsApp. For urgent help, contact +91 9503002629. To start a new enquiry, reply RESTART.";
const FORBIDDEN = /\b(is available|are available|booking is confirmed|reservation is confirmed|you are booked|confirmed|price|rs\.?\s?\d|₹)/i;
const HOUR = 3600 * 1000;
const NULLS = { checkIn: null, checkOut: null, guests: null, destination: null, property: null, requirements: null, intent: null };

function groqJson(obj) {
  return { status: 200, body: JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(obj) }, finish_reason: "stop" }] }) };
}

function mockGroq(responder) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    const r = responder(body);
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

function setup({ deliver = true, responder = () => groqJson(NULLS), config = CONFIG } = {}) {
  const fake = createFakeRedis();
  const store = createConversationStore(fake.client, "production");
  const leads = [];
  const handoffs = [];
  const logs = [];
  const groq = mockGroq(responder);
  let n = 0;
  const handler = createConversationHandler({
    createStore: () => store,
    now: () => new Date(fake.state.nowMs),
    emitQualified: async (l) => { leads.push(l); return deliver ? { ok: true, status: "stored", emailStatus: "SENT" } : { ok: false, reason: "network" }; },
    emitHandoff: async (x) => { handoffs.push(x); return deliver ? { ok: true, status: "stored", emailStatus: "SENT" } : { ok: false, reason: "network" }; },
    log: (e, m) => logs.push(e + " " + JSON.stringify(m || {})),
    sleep: async (ms) => fake.advance(ms),
    extract: (text, ctx, cfg) => groqExtract(text, ctx, { apiKey: cfg.groqApiKey, model: cfg.groqModel, fetchImpl: groq.fetchImpl }),
  });
  async function send(text, extra = {}) {
    n++;
    const res = await handler({
      messageSid: "SM" + String(n).padStart(32, "0"), accountSid: "AC" + "ab".repeat(16), from: GUEST, to: "+14155238886",
      body: text, numMedia: 0, profileName: "Test Guest", waId: null, bodyStatus: text ? "ok" : "empty", ...extra,
    }, config);
    fake.advance(5000);
    return res.reply;
  }
  const key = "production:wa:conv:" + GUEST;
  return { fake, store, leads, handoffs, logs, groq, send, key, conv: () => store.getConversation(GUEST) };
}

// Qualifies a lead the same way as the Production test: website message, answers, YES.
async function qualify(h) {
  await h.send("Hi");
  await h.send("10 Dec to 13 Dec");
  await h.send("2 guests");
  await h.send("Jaipur");
  await h.send("airport pickup");
  const reply = await h.send("YES");
  assert.match(reply, /This is not a booking yet/);
  assert.equal((await h.conv()).state, "HANDED_OFF");
  assert.equal(h.leads.length, 1);
}

// ======================================================================
// Post-handoff behaviour
// ======================================================================

test("post-handoff 1: a normal message after a delivered lead gets the acknowledgement (exact wording)", async () => {
  const h = setup();
  await qualify(h);
  const reply = await h.send("Hi, I'd like to know more about staying with Ritumbhara. Ref: W-FLOATING");
  assert.equal(reply, ACK);
  assert.equal(postHandoffAck(HANDOFF_DISPLAY), ACK);
  assert.doesNotMatch(reply, FORBIDDEN);
  assert.doesNotMatch(reply, /wa\.me/);
  const c = await h.conv();
  assert.equal(c.state, "HANDED_OFF"); // qualification did not restart
  assert.equal(c.outcome, "QUALIFIED");
  assert.equal(c.ref, "DIRECT"); // the new Ref is not adopted
  assert.ok(c.lastReminderAt);
  assert.ok(h.logs.some((l) => l.startsWith("message_processed") && l.includes('"state":"HANDED_OFF"')));
});

test("post-handoff 2: reminder suppressed within 24 hours, sent again after 24 hours", async () => {
  const h = setup();
  await qualify(h);
  assert.equal(await h.send("hello?"), ACK);
  assert.equal(await h.send("anyone there?"), null);
  h.fake.advance(23 * HOUR);
  assert.equal(await h.send("still waiting"), null);
  h.fake.advance(1 * HOUR);
  assert.equal(await h.send("hello again"), ACK);
  assert.equal(await h.send("ok"), null);
  assert.equal(POST_HANDOFF_ACK_INTERVAL_MS, 24 * HOUR);
});

test("post-handoff 3: acknowledgements never extend the 30-day handoff window", async () => {
  const h = setup();
  await qualify(h);
  const ttl0 = h.fake.ttlSeconds(h.key);
  assert.ok(Math.abs(ttl0 - STORE_TTL.conversationAfterHandoff) <= 10);
  h.fake.advance(10 * 24 * HOUR);
  assert.equal(await h.send("any update?"), ACK);
  const ttl1 = h.fake.ttlSeconds(h.key);
  assert.ok(Math.abs(ttl1 - (STORE_TTL.conversationAfterHandoff - 10 * 24 * 3600)) <= 20, String(ttl1));
});

test("post-handoff 4: AGENT / HUMAN still return the team number", async () => {
  for (const word of ["AGENT", "human", "Human!"]) {
    const h = setup();
    await qualify(h);
    assert.equal(await h.send(word), handoffHuman(HANDOFF_DISPLAY));
    assert.equal(await h.send(word), handoffHuman(HANDOFF_DISPLAY)); // not rate-limited
    assert.equal(await h.send("thanks"), ACK); // AGENT does not consume the acknowledgement
    assert.equal((await h.conv()).state, "HANDED_OFF");
    assert.equal(h.leads.length, 1);
  }
});

test("post-handoff 5: RESTART still starts a new enquiry", async () => {
  for (const word of ["RESTART", "start"]) {
    const h = setup();
    await qualify(h);
    await h.send("hello?");
    assert.equal(await h.send(word), MESSAGES.greeting + "\n\n" + MESSAGES.askDates);
    const c = await h.conv();
    assert.equal(c.state, "ASK_DATES");
    assert.equal(c.fields.checkIn, null);
    assert.equal(c.lastReminderAt, null);
    assert.ok(Math.abs(h.fake.ttlSeconds(h.key) - STORE_TTL.conversation) <= 10);
  }
});

test("post-handoff 6: STOP still opts out, and the opted-out guest gets no acknowledgement", async () => {
  const h = setup();
  await qualify(h);
  assert.equal(await h.send("STOP"), MESSAGES.optedOut);
  assert.equal(h.fake.get("production:wa:optout:" + GUEST), "1");
  assert.equal(await h.conv(), null);
  assert.equal(await h.send("hello?"), null);
  h.fake.advance(48 * HOUR);
  assert.equal(await h.send("hello?"), null);
});

test("post-handoff 7: no duplicate lead or handoff event after handoff, whatever the guest sends", async () => {
  const h = setup();
  await qualify(h);
  const before = JSON.stringify(await h.conv());
  for (const text of ["YES", "yes", "NO", "12 Nov to 15 Nov", "3 guests", "Jaipur", "", "Ref: W-FLOATING hello"]) {
    await h.send(text, text ? {} : { bodyStatus: "empty", numMedia: 1 });
    h.fake.advance(25 * HOUR);
  }
  assert.equal(h.leads.length, 1);
  assert.equal(h.handoffs.length, 0);
  const after = await h.conv();
  assert.equal(after.leadId, JSON.parse(before).leadId);
  assert.deepEqual(after.fields, JSON.parse(before).fields);
  assert.equal(after.botTurns, JSON.parse(before).botTurns);
  await h.send("next friday please"); // would reach Groq in a collecting state
  assert.equal(h.groq.calls.length, 0); // never called after the handoff
});

test("post-handoff 8: if the team was never notified, the guest is pointed at the team number instead", async () => {
  const h = setup({ deliver: false });
  await h.send("Hi");
  assert.equal(await h.send("HUMAN"), handoffDeliveryFailed(HANDOFF_DISPLAY));
  const c = await h.conv();
  assert.equal(c.state, "HANDED_OFF");
  assert.equal(c.leadDelivered, false);
  const reply = await h.send("hello?");
  assert.equal(reply, handoffDeliveryFailed(HANDOFF_DISPLAY));
  assert.doesNotMatch(reply, /already has your request/);
  assert.equal(await h.send("hello?"), null);
});

test("post-handoff 9: conversations handed off before this change (no lastReminderAt) get one acknowledgement", async () => {
  const h = setup();
  const nowIso = new Date(h.fake.state.nowMs).toISOString();
  await h.store.saveConversation({
    version: 1, sender: GUEST, state: "HANDED_OFF",
    fields: { checkIn: "2026-12-10", checkOut: "2026-12-13", guests: 2, guestsHint: null, destination: "jaipur", property: null, requirements: "airport pickup" },
    ref: "DIRECT", prefillSource: "none", attempts: {}, botTurns: 6, profileName: null, channel: "production",
    startedAt: nowIso, updatedAt: nowIso, leadId: "L-ABCDEF1234", outcome: "QUALIFIED", leadDelivered: true, lastReminderAt: null,
  }, STORE_TTL.conversationAfterHandoff);
  assert.equal(await h.send("Hi, I'd like to know more about staying with Ritumbhara."), ACK);
  assert.equal(await h.send("Hello?"), null);
  assert.equal(h.leads.length, 0);
});

// ======================================================================
// Groq: retired default model and request format
// ======================================================================

test("groq 1: the default model is no longer the retired llama-3.1-8b-instant", () => {
  assert.equal(DEFAULT_GROQ_MODEL, "openai/gpt-oss-20b");
  const env = {
    WHATSAPP_BOT_ENABLED: "true", TWILIO_AUTH_TOKEN: "x", TWILIO_WEBHOOK_URL: "https://www.example.com/api/whatsapp/inbound",
    WHATSAPP_BOT_TO: "whatsapp:+918306312778", WHATSAPP_HANDOFF_NUMBER: "+919503002629", GROQ_API_KEY: "k",
    UPSTASH_REDIS_REST_URL: "https://fake-redis.example.com", UPSTASH_REDIS_REST_TOKEN: "t",
  };
  assert.equal(getBotConfig(env).config.groqModel, "openai/gpt-oss-20b"); // GROQ_MODEL unset, as in Production
  assert.equal(getBotConfig({ ...env, GROQ_MODEL: "qwen/qwen3.8-27b" }).config.groqModel, "qwen/qwen3.8-27b");
});

test("groq 2: request format for reasoning (gpt-oss) and other models", () => {
  const ctx = { todayIst: "2026-10-07", currentStep: "ASK_DATES", known: {}, destinations: ["Jaipur"], properties: [] };
  const r = buildGroqRequestBody("next friday", ctx, "openai/gpt-oss-20b");
  assert.equal(isReasoningModel("openai/gpt-oss-20b"), true);
  assert.equal(isReasoningModel("openai/gpt-oss-120b"), true);
  assert.equal(r.max_completion_tokens, GROQ_MAX_OUTPUT_TOKENS_REASONING);
  assert.equal(r.reasoning_effort, "low");
  assert.equal(r.include_reasoning, false);
  assert.equal("max_tokens" in r, false); // deprecated parameter no longer sent
  assert.equal("reasoning_format" in r, false); // not supported by gpt-oss
  assert.deepEqual(r.response_format, { type: "json_object" });
  assert.match(r.messages[0].content, /\bjson\b/); // json mode needs JSON instructions in the prompt
  const o = buildGroqRequestBody("next friday", ctx, "qwen/qwen3.8-27b");
  assert.equal(isReasoningModel("qwen/qwen3.8-27b"), false);
  assert.equal(o.max_completion_tokens, GROQ_MAX_OUTPUT_TOKENS);
  assert.equal("reasoning_effort" in o, false);
  assert.equal("include_reasoning" in o, false);
});

test("groq 3: works end to end through the existing provider abstraction (default extract -> groqExtract)", async () => {
  const h = setup({ responder: () => groqJson({ ...NULLS, checkIn: "2026-10-16", checkOut: "2026-10-18" }) });
  await h.send("Hi");
  const reply = await h.send("next friday till sunday please");
  assert.match(reply, /How many guests/);
  const c = await h.conv();
  assert.equal(c.fields.checkIn, "2026-10-16");
  assert.equal(c.fields.checkOut, "2026-10-18");
  assert.equal(h.groq.calls[0].body.model, "openai/gpt-oss-20b");
  assert.equal(h.groq.calls[0].init.headers.Authorization, "Bearer " + GROQ_KEY);
  assert.ok(h.logs.some((l) => l.startsWith("ai_extracted")));
  assert.equal(h.logs.some((l) => l.startsWith("ai_failed")), false);
});

test("groq 4: a provider error is logged with status and error code only (never the message or the key)", async () => {
  const h = setup({
    responder: () => ({ status: 404, body: JSON.stringify({ error: { message: "The model `x` does not exist. " + GROQ_KEY + " next friday", type: "invalid_request_error", code: "model_not_found" } }) }),
  });
  await h.send("Hi");
  const reply = await h.send("next friday till sunday please");
  assert.match(reply, /check-in and check-out dates/); // deterministic flow carries on
  assert.doesNotMatch(reply, /groq|model|error|404/i);
  const line = h.logs.find((l) => l.startsWith("ai_failed"));
  assert.ok(line);
  assert.match(line, /"reason":"http_4xx"/);
  assert.match(line, /"status":404/);
  assert.match(line, /"code":"model_not_found"/);
  const all = h.logs.join("\n");
  for (const s of [GROQ_KEY, "does not exist", "next friday", "Bearer", GUEST]) assert.equal(all.includes(s), false, s);
  // Unsafe or missing codes are dropped; the error type is used when there is no code.
  const ctx = { todayIst: "2026-10-07", currentStep: "ASK_DATES", known: {}, destinations: [], properties: [] };
  const typed = mockGroq(() => ({ status: 400, body: JSON.stringify({ error: { message: "m", type: "invalid_request_error" } }) }));
  assert.deepEqual(await groqExtract("x", ctx, { apiKey: "k", model: "m", fetchImpl: typed.fetchImpl }), { ok: false, reason: "http_4xx", status: 400, code: "invalid_request_error" });
  const unsafe = mockGroq(() => ({ status: 400, body: JSON.stringify({ error: { code: "bad code with spaces " + GROQ_KEY } }) }));
  assert.deepEqual(await groqExtract("x", ctx, { apiKey: "k", model: "m", fetchImpl: unsafe.fetchImpl }), { ok: false, reason: "http_4xx", status: 400 });
  const html = mockGroq(() => ({ status: 403, body: "<html>forbidden</html>" }));
  assert.deepEqual(await groqExtract("x", ctx, { apiKey: "k", model: "m", fetchImpl: html.fetchImpl }), { ok: false, reason: "http_4xx", status: 403 });
});

// ======================================================================
// Handoff number
// ======================================================================

test("handoff number: +919503002629 is accepted, shown as +91 9503002629, and mistyped Indian numbers are rejected", () => {
  const base = {
    WHATSAPP_BOT_ENABLED: "true", TWILIO_AUTH_TOKEN: "x", TWILIO_WEBHOOK_URL: "https://www.example.com/api/whatsapp/inbound",
    WHATSAPP_BOT_TO: "whatsapp:+918306312778", UPSTASH_REDIS_REST_URL: "https://fake-redis.example.com", UPSTASH_REDIS_REST_TOKEN: "t",
  };
  for (const v of ["+919503002629", "+91 95030 02629", "+91-9503002629"]) {
    const r = getBotConfig({ ...base, WHATSAPP_HANDOFF_NUMBER: v });
    assert.equal(r.status, "ready", v);
    assert.equal(r.config.handoffNumber, "+919503002629");
  }
  assert.equal(formatPhoneForDisplay("+919503002629"), HANDOFF_DISPLAY);
  for (const v of ["+91950302629", "+91 950302629", "+9195030026290"]) { // 9 or 11 digits after +91
    const r = getBotConfig({ ...base, WHATSAPP_HANDOFF_NUMBER: v });
    assert.equal(r.status, "invalid", v);
    assert.ok(r.problems.includes("WHATSAPP_HANDOFF_NUMBER must have exactly 10 digits after +91"));
    assert.equal(JSON.stringify(r).includes("95030"), false); // values never echoed
  }
  // Non-Indian numbers keep the general E.164 rule.
  assert.equal(getBotConfig({ ...base, WHATSAPP_HANDOFF_NUMBER: "+14155550123" }).status, "ready");
});

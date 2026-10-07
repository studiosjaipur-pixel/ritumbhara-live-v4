// Week 5 stretch, Phase 3: Redis-backed store, deterministic state machine, conversation handler, webhook flow.
// Uses a test-only fake Redis (tests/helpers/fake-redis.mjs) through the real store code. No network, no AI,
// fake credentials only. "Today" is fixed at 7 Oct 2026, 12:00 India time.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const { createConversationStore, STORE_TTL, storeKeys } = await import("../../lib/whatsapp-bot/store.ts");
const { createUpstashClient, RedisUnavailableError } = await import("../../lib/whatsapp-bot/upstash.ts");
const { createConversationHandler, RATE_LIMIT_MAX } = await import("../../lib/whatsapp-bot/conversation.ts");
const { createInboundWebhookHandler } = await import("../../lib/whatsapp-bot/webhook.ts");
const { computeTwilioSignature } = await import("../../lib/twilio/signature.ts");
const { MESSAGES } = await import("../../lib/whatsapp-bot/messages.ts");
const { MAX_BOT_TURNS } = await import("../../lib/whatsapp-bot/state-machine.ts");
const { parseDates } = await import("../../lib/whatsapp-bot/dates.ts");

const GUEST = "+919000000001";
const HANDOFF_E164 = "+919000000009";
const HANDOFF_DISPLAY = "+91 9000000009";
const CONFIG = {
  enabled: true,
  twilioAuthToken: "fake_auth_token_for_tests_only_00000",
  twilioWebhookUrl: "https://example-preview.vercel.app/api/whatsapp/inbound",
  twilioAccountSid: null,
  botTo: "+14155238886",
  handoffNumber: HANDOFF_E164,
  groqApiKey: "fake_groq_key_for_tests_only",
  groqModel: "llama-3.1-8b-instant",
  upstashRedisRestUrl: "https://fake-redis.example.com",
  upstashRedisRestToken: "fake_redis_token_for_tests_only",
};

// ---------- harness ----------

function setup(opts = {}) {
  const fake = createFakeRedis();
  const store = createConversationStore(fake.client);
  const leads = [];
  const handoffs = [];
  const logs = [];
  let sidCounter = 0;
  const handler = createConversationHandler({
    createStore: () => store,
    now: () => new Date(fake.state.nowMs),
    // Phase 5: lead delivery is mocked as successful here (delivery itself is tested in phase5.test.mjs).
    emitQualified: async (lead) => { leads.push(lead); return { ok: true, status: "stored", emailStatus: "SENT" }; },
    emitHandoff: async (handoff) => { handoffs.push(handoff); return { ok: true, status: "stored", emailStatus: "SENT" }; },
    log: (event, meta) => logs.push(event + " " + JSON.stringify(meta || {})),
    sleep: async (ms) => fake.advance(ms),
    ...opts,
  });
  function message(text, extra = {}) {
    sidCounter++;
    return {
      messageSid: "SM" + String(sidCounter).padStart(32, "0"),
      accountSid: "AC" + "ab".repeat(16),
      from: GUEST,
      to: "+14155238886",
      body: text,
      numMedia: 0,
      profileName: "Test Guest",
      waId: GUEST.slice(1),
      bodyStatus: text ? "ok" : "empty",
      ...extra,
    };
  }
  async function send(text, extra) {
    const res = await handler(message(text, extra), CONFIG);
    fake.advance(5000); // 5 s between messages
    return res.reply;
  }
  async function conv() { return store.getConversation(GUEST); }
  return { fake, store, handler, message, send, conv, leads, handoffs, logs };
}

const FORBIDDEN = /\b(is available|are available|booking is confirmed|reservation is confirmed|you are booked|price is|rs\.?\s?\d|₹)/i;

// ======================================================================
// REDIS / STORE
// ======================================================================

test("store 1-3: save, retrieve and TTL of a conversation", async () => {
  const { fake, store } = setup();
  const state = { version: 1, sender: GUEST, state: "ASK_GUESTS", fields: { checkIn: "2026-11-12", checkOut: "2026-11-15", guests: null, guestsHint: null, destination: null, property: null, requirements: null }, ref: "DIRECT", prefillSource: "none", attempts: {}, botTurns: 2, profileName: null, channel: "sandbox", startedAt: "x", updatedAt: "x", leadId: null, outcome: null, leadDelivered: false, lastReminderAt: null };
  await store.saveConversation(state, STORE_TTL.conversation);
  assert.deepEqual(await store.getConversation(GUEST), state);
  assert.equal(fake.ttlSeconds("wa:conv:" + GUEST), 7 * 24 * 3600);
  fake.advance(7 * 24 * 3600 * 1000 + 1000);
  assert.equal(await store.getConversation(GUEST), null); // expired
  // Unreadable or foreign records are ignored rather than trusted.
  await fake.client.command(["SET", "wa:conv:" + GUEST, "{not json"]);
  assert.equal(await store.getConversation(GUEST), null);
  await fake.client.command(["SET", "wa:conv:" + GUEST, JSON.stringify({ ...state, sender: "+919000000002" })]);
  assert.equal(await store.getConversation(GUEST), null);
  await store.deleteConversation(GUEST);
  assert.equal(fake.get("wa:conv:" + GUEST), null);
});

test("store 4-6: MessageSid claim, duplicate and completion", async () => {
  const { fake, store } = setup();
  const sid = "SM" + "a".repeat(32);
  assert.equal(await store.claimMessage(sid), "claimed");
  assert.equal(fake.ttlSeconds("wa:msg:" + sid), 60);
  assert.equal(await store.claimMessage(sid), "duplicate"); // concurrent duplicate
  await store.markMessageProcessed(sid);
  assert.equal(fake.get("wa:msg:" + sid), "done");
  assert.equal(fake.ttlSeconds("wa:msg:" + sid), 48 * 3600);
  fake.advance(47 * 3600 * 1000);
  assert.equal(await store.claimMessage(sid), "duplicate"); // still remembered ~48 h
  fake.advance(2 * 3600 * 1000);
  assert.equal(await store.claimMessage(sid), "claimed"); // forgotten after 48 h
  // A crashed processor's claim expires after 60 s, letting a redelivery through.
  const sid2 = "SM" + "b".repeat(32);
  await store.claimMessage(sid2);
  fake.advance(61000);
  assert.equal(await store.claimMessage(sid2), "claimed");
  await store.releaseMessageClaim(sid2);
  assert.equal(await store.claimMessage(sid2), "claimed");
});

test("store 7-9: lock acquisition, release and contention", async () => {
  const { fake, store } = setup();
  const a = await store.acquireSenderLock(GUEST, STORE_TTL.senderLockMs);
  assert.ok(a);
  assert.equal(fake.ttlSeconds("wa:lock:" + GUEST), 15); // Phase 5: covers a lead delivery of up to 8 s
  assert.equal(await store.acquireSenderLock(GUEST, STORE_TTL.senderLockMs), null); // contention
  await store.releaseSenderLock(GUEST, "someone-elses-token");
  assert.equal(await store.acquireSenderLock(GUEST, STORE_TTL.senderLockMs), null); // wrong token does not release
  await store.releaseSenderLock(GUEST, a);
  const b = await store.acquireSenderLock(GUEST, STORE_TTL.senderLockMs);
  assert.ok(b && b !== a);
  fake.advance(15001); // never permanent: expires on its own
  const c = await store.acquireSenderLock(GUEST, STORE_TTL.senderLockMs);
  assert.ok(c);
  await store.releaseSenderLock(GUEST, b); // the old holder cannot release the new holder's lock
  assert.equal(fake.get("wa:lock:" + GUEST), c);
});

test("store 10-11: opt-out storage (no expiry) and detection", async () => {
  const { fake, store } = setup();
  assert.equal(await store.isOptedOut(GUEST), false);
  await store.setOptedOut(GUEST, true);
  assert.equal(await store.isOptedOut(GUEST), true);
  assert.equal(fake.ttlSeconds("wa:optout:" + GUEST), -1); // no expiry
  fake.advance(400 * 24 * 3600 * 1000);
  assert.equal(await store.isOptedOut(GUEST), true);
  await store.setOptedOut(GUEST, false);
  assert.equal(await store.isOptedOut(GUEST), false);
});

test("store 12: fixed-window rate limit counter", async () => {
  const { fake, store } = setup();
  const t = fake.state.nowMs;
  assert.equal(await store.incrementRateLimit("sender:" + GUEST, 600, t), 1);
  assert.equal(await store.incrementRateLimit("sender:" + GUEST, 600, t), 2);
  const key = fake.keys().find((k) => k.startsWith("wa:rl:sender:" + GUEST));
  assert.ok(key);
  assert.ok(fake.ttlSeconds(key) > 0 && fake.ttlSeconds(key) <= 605);
  assert.equal(await store.incrementRateLimit("sender:+919000000002", 600, t), 1); // per sender
  assert.equal(await store.incrementRateLimit("sender:" + GUEST, 600, t + 600000), 1); // next window
});

test("store: keys refuse unvalidated input", () => {
  assert.throws(() => storeKeys.conversation("whatsapp:+919000000001"));
  assert.throws(() => storeKeys.senderLock("+91 9000"));
  assert.throws(() => storeKeys.rateLimit("a b", 0));
});

test("upstash client: request format, pipeline, and errors without secrets", async () => {
  const requests = [];
  const fakeFetch = async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/pipeline")) return new Response(JSON.stringify([{ result: "OK" }, { result: 3 }]), { status: 200 });
    return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
  };
  const client = createUpstashClient({ url: "https://fake-redis.example.com/", token: "secret-token-xyz", fetchImpl: fakeFetch });
  assert.equal(await client.command(["SET", "k", "v", "NX", "EX", 60]), "OK");
  assert.equal(requests[0].url, "https://fake-redis.example.com");
  assert.equal(requests[0].init.headers.Authorization, "Bearer secret-token-xyz");
  assert.equal(requests[0].init.body, JSON.stringify(["SET", "k", "v", "NX", "EX", "60"]));
  assert.deepEqual(await client.pipeline([["SET", "a", 0], ["INCR", "a"]]), ["OK", 3]);
  assert.equal(requests[1].url, "https://fake-redis.example.com/pipeline");

  const cases = [
    async () => new Response("unauthorized secret-token-xyz", { status: 401 }),
    async () => { throw new TypeError("connect ECONNREFUSED fake-redis.example.com"); },
    async () => new Response(JSON.stringify({ error: "ERR wrong number of arguments for secret-token-xyz" }), { status: 200 }),
    async () => new Response("not json", { status: 200 }),
  ];
  for (const f of cases) {
    const c = createUpstashClient({ url: "https://fake-redis.example.com", token: "secret-token-xyz", fetchImpl: f });
    await assert.rejects(c.command(["GET", "k"]), (err) => {
      assert.ok(err instanceof RedisUnavailableError);
      assert.equal(String(err.message).includes("secret-token-xyz"), false);
      assert.equal(String(err.message).includes("fake-redis.example.com"), false);
      return true;
    });
  }
  const slow = createUpstashClient({ url: "https://x.example.com", token: "t", timeoutMs: 20, fetchImpl: (u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))) });
  await assert.rejects(slow.command(["GET", "k"]), (err) => err.reason === "timeout");
});

// ======================================================================
// STATE MACHINE (through the conversation handler and the real store)
// ======================================================================

test("13. NEW greeting introduces an automated assistant, STOP and HUMAN, and asks for dates", async () => {
  const h = setup();
  const reply = await h.send("Hi");
  assert.match(reply, /automated assistant/);
  assert.match(reply, /STOP/);
  assert.match(reply, /HUMAN/);
  assert.match(reply, /can't check availability or make bookings/);
  assert.match(reply, /check-in and check-out dates/);
  assert.doesNotMatch(reply, FORBIDDEN);
  assert.equal((await h.conv()).state, "ASK_DATES");
});

test("14. date collection: both dates in one reply", async () => {
  const h = setup();
  await h.send("Hello");
  const reply = await h.send("12 Nov to 15 Nov");
  assert.equal(reply, MESSAGES.askGuests);
  const c = await h.conv();
  assert.equal(c.fields.checkIn, "2026-11-12");
  assert.equal(c.fields.checkOut, "2026-11-15");
  assert.equal(c.state, "ASK_GUESTS");
});

test("15. check-out collection, including 'N nights'", async () => {
  const h = setup();
  await h.send("Hi");
  assert.equal(await h.send("arriving 12 Nov"), MESSAGES.askCheckOut);
  assert.equal((await h.conv()).state, "ASK_CHECKOUT");
  assert.equal(await h.send("15th November"), MESSAGES.askGuests);
  assert.equal((await h.conv()).fields.checkOut, "2026-11-15");
  const h2 = setup();
  await h2.send("Hi");
  await h2.send("checking in 10/12");
  await h2.send("3 nights");
  const c = await h2.conv();
  assert.equal(c.fields.checkIn, "2026-12-10");
  assert.equal(c.fields.checkOut, "2026-12-13");
});

test("16. guest count in several forms", async () => {
  for (const [text, n] of [["two people", 2], ["we are 4", 4], ["3", 3], ["2 adults and 1 child", 3], ["just me", 1], ["6 guests", 6]]) {
    const h = setup();
    await h.send("Hi");
    await h.send("12 Nov to 15 Nov");
    await h.send(text);
    assert.equal((await h.conv()).fields.guests, n, text);
  }
});

test("17. property / destination collection from the website configuration", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("12 Nov to 15 Nov, 2 guests");
  const ask = (await h.conv()).state;
  assert.equal(ask, "ASK_STAY");
  const reply = await h.send("Jaipur please");
  assert.equal(reply, MESSAGES.askRequirements);
  assert.equal((await h.conv()).fields.destination, "jaipur");
  for (const [text, prop, dest] of [["Studio 925", "studio-925", "jaipur"], ["studio 502", "studio-502-alwar", "alwar"], ["Villa 65", "villa-65-sariska", "sariska"], ["apartment 813", "apartment-813", "alwar"]]) {
    const h2 = setup();
    await h2.send("Hi");
    await h2.send("12 Nov to 15 Nov, 2 guests");
    await h2.send(text);
    const c = await h2.conv();
    assert.equal(c.fields.property, prop, text);
    assert.equal(c.fields.destination, dest, text);
  }
});

test("18. requirements are optional free text, capped at 300 characters", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("12 Nov to 15 Nov, 2 guests, Jaipur");
  const reply = await h.send("Need airport pickup");
  assert.match(reply, /Requirements: Need airport pickup/);
  const h2 = setup();
  await h2.send("Hi");
  await h2.send("12 Nov to 15 Nov, 2 guests, Jaipur");
  assert.match(await h2.send("No"), /Requirements: None/);
  assert.equal((await h2.conv()).fields.requirements, "");
  const h3 = setup();
  await h3.send("Hi");
  await h3.send("12 Nov to 15 Nov, 2 guests, Jaipur");
  await h3.send("x".repeat(400));
  assert.equal((await h3.conv()).fields.requirements.length, 300);
});

test("19. multiple fields in one message skip straight to what is missing", async () => {
  const h = setup();
  await h.send("Hi");
  const reply = await h.send("2 guests, checking in Dec 10 and leaving Dec 13");
  const c = await h.conv();
  assert.equal(c.fields.guests, 2);
  assert.equal(c.fields.checkIn, "2026-12-10");
  assert.equal(c.fields.checkOut, "2026-12-13");
  assert.equal(c.state, "ASK_STAY");
  assert.match(reply, /Which destination/);
  // Everything at once on the first message goes straight to requirements.
  const h2 = setup();
  const r2 = await h2.send("Hi, Studio 925 from 10 Dec to 13 Dec for 2 guests");
  assert.match(r2, /automated assistant/);
  assert.match(r2, /noted the details/);
  assert.match(r2, /special requirements/);
  assert.equal((await h2.conv()).state, "ASK_REQUIREMENTS");
});

async function toConfirm(h) {
  await h.send("Hi");
  await h.send("10 Dec to 13 Dec, 2 guests, Jaipur");
  return h.send("Airport pickup");
}

test("20. confirmation summary lists the details and asks YES/NO", async () => {
  const h = setup();
  const reply = await toConfirm(h);
  assert.equal(reply, [
    "Please confirm your request:",
    "Stay: Jaipur",
    "Check-in: Thu 10 Dec 2026",
    "Check-out: Sun 13 Dec 2026 (3 nights)",
    "Guests: 2",
    "Requirements: Airport pickup",
    "",
    "Is this correct? Reply YES to confirm or NO to change something.",
  ].join("\n"));
  assert.equal((await h.conv()).state, "CONFIRM");
  assert.equal(h.leads.length, 0); // not qualified before YES
});

test("21. YES -> QUALIFIED (lead emitted) -> HANDED_OFF, kept 30 days", async () => {
  for (const yes of ["YES", "y", "Correct", " confirm. "]) {
    const h = setup();
    await toConfirm(h);
    const reply = await h.send(yes);
    assert.match(reply, /This is not a booking yet/);
    assert.match(reply, new RegExp("\\+91 9000000009"));
    assert.doesNotMatch(reply, FORBIDDEN);
    assert.doesNotMatch(reply, /wa\.me/);
    const c = await h.conv();
    assert.equal(c.state, "HANDED_OFF");
    assert.equal(c.outcome, "QUALIFIED");
    assert.match(c.leadId, /^L-[0-9A-F]{10}$/);
    assert.ok(Math.abs(h.fake.ttlSeconds("wa:conv:" + GUEST) - 30 * 24 * 3600) <= 10); // send() advances the clock 5 s
    assert.equal(h.leads.length, 1);
    const lead = h.leads[0];
    // Phase 5: the emitted event is the validated wire payload.
    assert.equal(lead.qualificationStatus, "QUALIFIED");
    assert.equal(lead.phone, GUEST);
    assert.equal(lead.ref, "DIRECT");
    assert.equal(lead.nights, 3);
    assert.equal(lead.source, "whatsapp-bot-sandbox");
    assert.deepEqual([lead.checkIn, lead.checkOut, lead.guests, lead.destination, lead.property, lead.requirements], ["2026-12-10", "2026-12-13", 2, "Jaipur", null, "Airport pickup"]);
    assert.equal(lead.leadId, c.leadId);
    assert.equal(c.leadDelivered, true);
  }
});

test("22. NO -> correction without losing the other details", async () => {
  const h = setup();
  await toConfirm(h);
  assert.equal(await h.send("No"), MESSAGES.askCorrection);
  assert.equal((await h.conv()).fields.guests, 2); // nothing discarded
  const r1 = await h.send("change guests to 3");
  assert.match(r1, /Guests: 3/);
  assert.match(r1, /Stay: Jaipur/);
  const r2 = await h.send("check-in should be Dec 11");
  assert.match(r2, /Check-in: Fri 11 Dec 2026/);
  assert.match(r2, /Check-out: Sun 13 Dec 2026 \(2 nights\)/);
  const r3 = await h.send("change dates");
  assert.equal(r3, MESSAGES.askDates);
  const r4 = await h.send("14 Dec to 16 Dec");
  assert.match(r4, /Check-in: Mon 14 Dec 2026/);
  assert.match(r4, /Guests: 3/);
  const r5 = await h.send("requirements: late arrival");
  assert.match(r5, /Requirements: late arrival/);
  assert.match(await h.send("hmm"), /didn't catch that/);
});

test("23. STOP opts out, clears the conversation and silences the bot", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("12 Nov to 15 Nov");
  for (const stop of ["STOP"]) assert.equal(await h.send(stop), MESSAGES.optedOut);
  assert.equal(h.fake.get("wa:optout:" + GUEST), "1");
  assert.equal(await h.conv(), null);
  assert.equal(await h.send("Hi again"), null);
  assert.equal(await h.send("HUMAN"), null);
  assert.equal(await h.send("unsubscribe"), null);
  const h2 = setup();
  await h2.send("Hi");
  assert.equal(await h2.send("  unsubscribe "), MESSAGES.optedOut);
  // "stop" inside a sentence is not an opt-out.
  const h3 = setup();
  await h3.send("Hi");
  assert.notEqual(await h3.send("please don't stop, 2 guests"), MESSAGES.optedOut);
});

test("24. START / RESTART after STOP clears the opt-out and starts fresh", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("12 Nov to 15 Nov");
  await h.send("STOP");
  const reply = await h.send("start");
  assert.match(reply, /automated assistant/);
  assert.equal(h.fake.get("wa:optout:" + GUEST), null);
  const c = await h.conv();
  assert.equal(c.state, "ASK_DATES");
  assert.equal(c.fields.checkIn, null); // no stale fields
  await h.send("12 Nov to 15 Nov");
  assert.equal(await h.send("RESTART"), MESSAGES.greeting + "\n\n" + MESSAGES.askDates);
  assert.equal((await h.conv()).fields.checkIn, null);
});

test("25. HUMAN / AGENT hands off with the configured team number (no wa.me link, no lead yet)", async () => {
  for (const word of ["HUMAN", "agent", "Human!"]) {
    const h = setup();
    await h.send("Hi");
    const reply = await h.send(word);
    assert.equal(reply, "Sure. Our team will continue with you on WhatsApp at " + HANDOFF_DISPLAY + ".");
    const c = await h.conv();
    assert.equal(c.state, "HANDED_OFF");
    assert.equal(c.outcome, "HUMAN_REQUESTED");
    assert.equal(h.leads.length, 0);
  }
});

test("26. HANDED_OFF stays silent; only START/RESTART resets; HUMAN repeats the number", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("HUMAN");
  assert.equal(await h.send("Hello?"), null);
  assert.equal(await h.send("12 Nov to 15 Nov"), null);
  assert.equal(await h.send("", { bodyStatus: "empty", numMedia: 1 }), null);
  assert.match(await h.send("human"), /9000000009/);
  assert.equal((await h.conv()).state, "HANDED_OFF");
  assert.match(await h.send("RESTART"), /automated assistant/);
  assert.equal((await h.conv()).state, "ASK_DATES");
});

test("27. a required field is asked at most twice, then the guest is handed to the team", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("12 Nov to 15 Nov");
  const r1 = await h.send("hmm, not sure");
  assert.match(r1, /didn't catch that/);
  assert.match(r1, /How many guests/);
  const r2 = await h.send("still not sure");
  assert.match(r2, /pass your details to our team/);
  const c = await h.conv();
  assert.equal(c.state, "HANDED_OFF");
  assert.equal(c.outcome, "NEEDS_FOLLOW_UP");
  assert.equal(h.leads.length, 0); // an incomplete lead is never qualified
});

test("28. at most 15 bot turns per conversation", async () => {
  const h = setup();
  await toConfirm(h); // 3 turns
  let last;
  for (let i = 0; i < 20; i++) {
    last = await h.send("guests " + ((i % 5) + 1)); // each correction re-sends the summary
    if ((await h.conv()).state === "HANDED_OFF") break;
  }
  const c = await h.conv();
  assert.equal(c.state, "HANDED_OFF");
  assert.equal(c.outcome, "NEEDS_FOLLOW_UP");
  assert.equal(c.botTurns, MAX_BOT_TURNS);
  assert.match(last, /pass your details to our team/);
  assert.equal(await h.send("guests 2"), null);
});

test("29. invalid dates are rejected with a reason and asked again", async () => {
  const cases = [
    ["1 Oct 2026 to 3 Oct 2026", /can't be in the past/],
    ["31 Feb", /doesn't seem to exist/],
    ["10 Dec 2027 to 12 Dec 2027", /within the next 12 months/],
    ["10 Dec to 9 Dec 2026", /must be after the check-in/],
    ["1 Nov to 1 Mar 2027", /up to 90 nights/],
  ];
  for (const [text, err] of cases) {
    const h = setup();
    await h.send("Hi");
    const reply = await h.send(text);
    assert.match(reply, err, text);
    assert.notEqual((await h.conv()).state, "ASK_GUESTS", text);
  }
  // Ambiguous input is not guessed.
  const h = setup();
  await h.send("Hi");
  assert.match(await h.send("the 12th"), /didn't catch that/);
  assert.equal((await h.conv()).fields.checkIn, null);
});

test("30. invalid guest counts are rejected, not converted", async () => {
  for (const text of ["0 guests", "25 guests", "we are 40"]) {
    const h = setup();
    await h.send("Hi");
    await h.send("12 Nov to 15 Nov");
    const reply = await h.send(text);
    assert.match(reply, /between 1 and 20/, text);
    assert.equal((await h.conv()).fields.guests, null, text);
  }
});

test("31. unknown property asks for clarification and invents nothing", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("12 Nov to 15 Nov, 2 guests");
  const reply = await h.send("Studio 999");
  assert.match(reply, /couldn't find that property/);
  assert.match(reply, /Which destination/);
  const c = await h.conv();
  assert.equal(c.fields.property, null);
  assert.equal(c.fields.destination, null);
  // Agra is accepted but flagged as coming soon (website status).
  const h2 = setup();
  await h2.send("Hi");
  await h2.send("12 Nov to 15 Nov, 2 guests, Agra");
  assert.match(await h2.send("no"), /Agra is listed as coming soon on our website/);
});

test("32. missing ref -> DIRECT", async () => {
  const h = setup();
  await h.send("Hello there");
  assert.equal((await h.conv()).ref, "DIRECT");
});

test("33. ref extraction and safe pre-fill from the website message", async () => {
  const h = setup();
  const reply = await h.send("Hi, I'd like to check availability in Jaipur from 2026-11-12 to 2026-11-15 for 3 guests.\n\nRef: W-DEST-jaipur-AVAILABILITY");
  const c = await h.conv();
  assert.equal(c.ref, "W-DEST-jaipur-AVAILABILITY");
  assert.equal(c.prefillSource, "destination-ref");
  assert.deepEqual([c.fields.destination, c.fields.checkIn, c.fields.checkOut, c.fields.guests], ["jaipur", "2026-11-12", "2026-11-15", 3]);
  assert.match(reply, /special requirements/);
  // Property CTA
  const h2 = setup();
  await h2.send("Hi, I'd like to check availability for Studio 925\n\nRef: W-PROP-studio-925");
  const c2 = await h2.conv();
  assert.equal(c2.ref, "W-PROP-studio-925");
  assert.equal(c2.fields.property, "studio-925");
  assert.equal(c2.prefillSource, "property-ref");
  // Home widget with "6+" guests: exact number still asked.
  const h3 = setup();
  const r3 = await h3.send("Hi, I'd like to check availability in a Ritumbhara stay from 2026-11-12 to 2026-11-15 for 6+ guests.\n\nRef: W-HOME-AVAILABILITY");
  const c3 = await h3.conv();
  assert.equal(c3.prefillSource, "website-availability");
  assert.equal(c3.fields.guestsHint, "6+");
  assert.equal(c3.fields.guests, null);
  assert.match(r3, /How many guests exactly/);
  // An invalid ref is not stored; the ref's digits are never read as guests.
  const h4 = setup();
  await h4.send("Hi Ref: W-<script>");
  assert.equal((await h4.conv()).ref, "DIRECT");
  // Only the first message sets the ref.
  await h4.send("Ref: W-FLOATING");
  assert.equal((await h4.conv()).ref, "DIRECT");
});

test("34. Redis failure: fixed message with the team number, nothing pretends to be saved", async () => {
  const h = setup();
  await h.send("Hi");
  h.fake.state.down = true;
  const reply = await h.send("12 Nov to 15 Nov");
  assert.equal(reply, "We're having trouble processing your request right now. Please contact our team on " + HANDOFF_DISPLAY + ".");
  h.fake.state.down = false;
  assert.equal((await h.conv()).fields.checkIn, null);
  assert.ok(h.logs.some((l) => l.startsWith("redis_unavailable")));
});

test("state machine: no reply ever claims availability, prices or a confirmed booking", async () => {
  const h = setup();
  const replies = [];
  for (const t of ["Hi", "Studio 925 10 Dec to 13 Dec", "3 guests", "airport pickup", "no", "guests 2", "YES"]) replies.push(await h.send(t));
  for (const r of replies) assert.doesNotMatch(r || "", FORBIDDEN);
  assert.match(replies[3], /Studio 925 is listed for up to 2 guests\. Our team will advise\./); // capacity noted, not rejected
});

test("dates: day-first numeric dates, ranges, and year roll-over", () => {
  const ctx = { today: "2026-10-07", knownCheckIn: null, knownCheckOut: null, askingCheckOut: false };
  assert.deepEqual([parseDates("10/12", ctx).checkIn], ["2026-12-10"]);
  const r = parseDates("Dec 30 to Jan 2", ctx);
  assert.deepEqual([r.checkIn, r.checkOut], ["2026-12-30", "2027-01-02"]);
  const r2 = parseDates("10-13 Dec", ctx);
  assert.deepEqual([r2.checkIn, r2.checkOut], ["2026-12-10", "2026-12-13"]);
  assert.equal(parseDates("5 Jan", ctx).checkIn, "2027-01-05"); // already passed this year -> next year
  assert.equal(parseDates("I want to come on 10 Dec", ctx).checkIn, "2026-12-10"); // "to" far from the date is not a cue
  assert.equal(parseDates("Dec 10 2026", ctx).checkIn, "2026-12-10");
  assert.equal(parseDates("tomorrow", ctx).checkIn, "2026-10-08");
});

// ======================================================================
// WEBHOOK (signed requests -> real webhook -> conversation handler -> fake Redis)
// ======================================================================

function webhookSetup() {
  const h = setup();
  const env = {
    status: "ready",
    config: { ...CONFIG, twilioWebhookUrl: "https://example-preview.vercel.app/api/whatsapp/inbound" },
  };
  const webhook = createInboundWebhookHandler({ getConfig: () => env, handleMessage: h.handler, log: () => {} });
  let n = 0;
  function request(body, sid) {
    n++;
    const params = new URLSearchParams({
      MessageSid: sid || "SM" + String(1000 + n).padStart(32, "0"),
      AccountSid: "AC" + "ab".repeat(16),
      From: "whatsapp:" + GUEST,
      To: "whatsapp:+14155238886",
      Body: body,
      NumMedia: "0",
    });
    const sig = computeTwilioSignature(CONFIG.twilioAuthToken, env.config.twilioWebhookUrl, params);
    return new Request("http://internal/api/whatsapp/inbound", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": sig }, body: params.toString() });
  }
  return { ...h, webhook, request };
}

test("35. a duplicate webhook delivery is not processed twice", async () => {
  const w = webhookSetup();
  const sid = "SM" + "c".repeat(32);
  const first = await (await w.webhook(w.request("Hi", sid))).text();
  assert.match(first, /automated assistant/);
  const turns = (await w.conv()).botTurns;
  const second = await (await w.webhook(w.request("Hi", sid))).text();
  assert.equal(second, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  assert.equal((await w.conv()).botTurns, turns);
  // Concurrent duplicates: only one gets processed.
  const sid2 = "SM" + "d".repeat(32);
  const [a, b] = await Promise.all([w.webhook(w.request("12 Nov to 15 Nov", sid2)), w.webhook(w.request("12 Nov to 15 Nov", sid2))]);
  const texts = [await a.text(), await b.text()];
  assert.equal(texts.filter((t) => t.includes("<Message>")).length, 1);
});

test("36. opt-out prevents processing", async () => {
  const w = webhookSetup();
  await w.webhook(w.request("Hi"));
  assert.match(await (await w.webhook(w.request("STOP"))).text(), /won&apos;t receive further automated messages/);
  const after = await (await w.webhook(w.request("12 Nov to 15 Nov, 2 guests"))).text();
  assert.equal(after, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  assert.equal(await w.conv(), null);
});

test("37. rate limiting: one warning, then silence, for the rest of the window", async () => {
  const w = webhookSetup();
  const replies = [];
  for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) replies.push(await (await w.webhook(w.request("hello " + i))).text());
  assert.ok(replies.slice(0, RATE_LIMIT_MAX).every((r) => !r.includes("a little quickly")));
  assert.match(replies[RATE_LIMIT_MAX], /a little quickly/);
  assert.equal(replies[RATE_LIMIT_MAX + 1], '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  // STOP still works while rate limited.
  assert.match(await (await w.webhook(w.request("STOP"))).text(), /Reply START/);
  // A new window allows messages again.
  w.fake.advance(600 * 1000);
  assert.match(await (await w.webhook(w.request("START"))).text(), /automated assistant/);
});

test("38. the per-sender lock prevents concurrent processing of one conversation", async () => {
  const w = webhookSetup();
  await w.webhook(w.request("Hi"));
  // Another request is mid-way through this guest's conversation.
  await w.fake.client.command(["SET", "wa:lock:" + GUEST, "other-request", "PX", 8000]);
  const sid = "SM" + "e".repeat(32);
  const busy = await (await w.webhook(w.request("12 Nov to 15 Nov", sid))).text();
  assert.match(busy, /still working on your previous message/);
  assert.equal((await w.conv()).fields.checkIn, null); // not processed
  assert.equal(w.fake.get("wa:msg:" + sid), null); // claim released so a redelivery can be processed
  assert.equal(w.fake.get("wa:lock:" + GUEST), "other-request"); // the other request's lock is untouched
  await w.fake.client.command(["DEL", "wa:lock:" + GUEST]);
  assert.match(await (await w.webhook(w.request("12 Nov to 15 Nov", sid))).text(), /How many guests/);
  assert.equal(w.fake.get("wa:lock:" + GUEST), null); // released after processing
});

test("39. bot disabled still short-circuits before any Redis call", async () => {
  const h = setup();
  const webhook = createInboundWebhookHandler({ getConfig: () => ({ status: "disabled" }), handleMessage: h.handler });
  const res = await webhook(new Request("http://internal/x", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "Body=hi" }));
  assert.equal(await res.text(), '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  assert.equal(h.fake.state.calls.length, 0);
});

test("logs carry no message text or full phone numbers", async () => {
  const w = webhookSetup();
  for (const t of ["Hi", "secret plan 12 Nov to 15 Nov", "STOP", "start"]) await w.webhook(w.request(t));
  const all = w.logs.join("\n");
  assert.ok(w.logs.length > 0);
  assert.equal(all.includes(GUEST), false);
  assert.equal(all.includes("secret plan"), false);
  assert.ok(all.includes("***0001"));
});

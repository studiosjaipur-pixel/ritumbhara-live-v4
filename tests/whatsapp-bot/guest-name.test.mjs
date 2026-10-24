// WhatsApp lead bot: asking the guest's name (the first question of a new enquiry).
// The name is saved only as the guest typed it, never from the WhatsApp profile name, never guessed; it travels with
// the lead (guestName) to the Apps Script, which writes the Sheet's "Guest Name" column (see
// tests/apps-script/guest-name-and-columns.test.mjs). No network, fake secrets only.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const { createConversationStore } = await import("../../lib/whatsapp-bot/store.ts");
const { createConversationHandler } = await import("../../lib/whatsapp-bot/conversation.ts");
const { parseGuestName } = await import("../../lib/whatsapp-bot/parse.ts");
const { buildHandoffPayload, buildQualifiedLeadPayload } = await import("../../lib/leads/qualified-lead.ts");
const { buildCatalog } = await import("../../lib/whatsapp-bot/catalog.ts");

const GUEST = "+919000000001";
const CONFIG = {
  enabled: true, twilioAuthToken: "fake_twilio", twilioWebhookUrl: "https://example-preview.vercel.app/api/whatsapp/inbound",
  twilioAccountSid: null, botTo: "+14155238886", handoffNumber: "+919000000009", groqApiKey: null, groqModel: "llama-3.1-8b-instant",
  upstashRedisRestUrl: "https://fake-redis.example.com", upstashRedisRestToken: "fake_redis",
};
const ASK_NAME = /May I have your name, please\?/;

function setup() {
  const fake = createFakeRedis();
  const store = createConversationStore(fake.client);
  const events = { qualified: [], handoffs: [] };
  let n = 0;
  const handler = createConversationHandler({
    createStore: () => store,
    now: () => new Date(fake.state.nowMs),
    log: () => {},
    sleep: async (ms) => fake.advance(ms),
    emitQualified: async (lead) => { events.qualified.push(lead); return { ok: true, stored: true, emailStatus: "SENT" }; },
    emitHandoff: async (h) => { events.handoffs.push(h); return { ok: true, stored: true, emailStatus: "SENT" }; },
  });
  async function send(text) {
    n++;
    const res = await handler({ messageSid: "SM" + String(n).padStart(32, "0"), accountSid: "", from: GUEST, to: "+14155238886", body: text, numMedia: 0, profileName: "WhatsApp Profile", waId: null, bodyStatus: "ok" }, CONFIG);
    fake.advance(5000);
    return res.reply;
  }
  return { store, events, send, conv: () => store.getConversation(GUEST) };
}

test("the name is the first question; then check-in, check-out, guests, stay, requirements; the name goes with the lead", async () => {
  const h = setup();
  const first = await h.send("Hi");
  assert.match(first, /automated assistant/);
  assert.match(first, ASK_NAME);
  assert.equal((await h.conv()).state, "ASK_NAME");
  assert.match(await h.send("My name is Asha Verma."), /check-in and check-out dates/);
  assert.equal((await h.conv()).fields.guestName, "Asha Verma");
  assert.match(await h.send("arriving 10 Dec"), /check-out date/);
  assert.match(await h.send("13 Dec"), /How many guests/);
  assert.match(await h.send("2 guests"), /Which destination/);
  assert.match(await h.send("Jaipur"), /special requirements/);
  const summary = await h.send("airport pickup");
  assert.match(summary, /^Please confirm your request:\nName: Asha Verma\nStay: Jaipur/);
  await h.send("YES");
  assert.equal(h.events.qualified.length, 1);
  assert.equal(h.events.qualified[0].guestName, "Asha Verma");
  assert.equal(JSON.stringify(h.events.qualified[0]).includes("WhatsApp Profile"), false, "the profile name is never used");
});

test("details in the first message are kept; the name is still asked first, then only what is missing", async () => {
  const h = setup();
  const first = await h.send("Hi, Studio 925 from 10 Dec to 13 Dec for 2 guests");
  assert.match(first, /noted the details/);
  assert.match(first, ASK_NAME);
  const c = await h.conv();
  assert.deepEqual([c.fields.property, c.fields.checkIn, c.fields.checkOut, c.fields.guests, c.fields.guestName], ["studio-925", "2026-12-10", "2026-12-13", 2, null]);
  assert.match(await h.send("Ravi"), /special requirements/);
});

test("SKIP / NO: no name is saved and none is invented; the flow continues with the dates", async () => {
  for (const answer of ["skip", "No"]) {
    const h = setup();
    await h.send("Hi");
    assert.match(await h.send(answer), /check-in and check-out dates/);
    assert.equal((await h.conv()).fields.guestName, "");
    await h.send("10 Dec to 13 Dec, 2 guests, Jaipur");
    const summary = await h.send("no");
    assert.doesNotMatch(summary, /Name:/);
    await h.send("YES");
    assert.equal(h.events.qualified[0].guestName, null);
  }
});

test("an unclear answer is asked once more; a second unclear answer leaves the name blank and moves on (no handoff)", async () => {
  const h = setup();
  await h.send("Hi");
  const again = await h.send("12345");
  assert.match(again, /couldn't read that as a name/);
  assert.match(again, ASK_NAME);
  const next = await h.send("looking for a quiet stay");
  assert.match(next, /check-in and check-out dates/);
  const c = await h.conv();
  assert.equal(c.state, "ASK_DATES");
  assert.equal(c.fields.guestName, "");
  assert.equal(h.events.handoffs.length, 0);
});

test("stay details sent instead of the name are kept (never saved as a name) and the name is asked again", async () => {
  const h = setup();
  await h.send("Hi");
  assert.match(await h.send("Jaipur, 2 guests"), ASK_NAME);
  const c = await h.conv();
  assert.deepEqual([c.fields.destination, c.fields.guests, c.fields.guestName], ["jaipur", 2, null]);
  assert.match(await h.send("May Sharma"), /check-in and check-out dates/);
  assert.equal((await h.conv()).fields.guestName, "May Sharma");
});

test("the name can be corrected from the summary", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("Asha");
  await h.send("10 Dec to 13 Dec, 2 guests, Jaipur");
  await h.send("no");
  assert.match(await h.send("change name"), ASK_NAME);
  assert.match(await h.send("Asha Verma"), /Name: Asha Verma/);
});

test("a conversation stored before this change (no guestName key) is asked for the name next", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("skip");
  const c = await h.conv();
  delete c.fields.guestName;
  c.state = "ASK_DATES";
  await h.store.saveConversation(c, 3600);
  const r = await h.send("10 Dec to 13 Dec");
  assert.match(r, ASK_NAME);
  assert.equal((await h.conv()).fields.checkIn, "2026-12-10", "the answer is kept");
});

test("handoff before the name was given: guestName null; after it was given: included", async () => {
  const h = setup();
  await h.send("Hi");
  await h.send("HUMAN");
  assert.equal(h.events.handoffs[0].guestName, null);
  const h2 = setup();
  await h2.send("Hi");
  await h2.send("Ravi Kumar");
  await h2.send("HUMAN");
  assert.equal(h2.events.handoffs[0].guestName, "Ravi Kumar");
});

test("parseGuestName: takes what the guest typed, strips 'my name is', rejects non-names", () => {
  const ok = [["Asha", "Asha"], ["my name is Asha Verma", "Asha Verma"], ["I'm Ravi.", "Ravi"], ["This is Dr. Mehta", "Dr. Mehta"],
    ["Hi, I am José", "José"], ["name: O'Brien-Smith", "O'Brien-Smith"], ["राहुल शर्मा", "राहुल शर्मा"]];
  for (const [input, want] of ok) assert.equal(parseGuestName(input), want, input);
  for (const bad of ["", "ok", "Thanks", "yes", "skip", "12 Dec", "2 guests", "a".repeat(61), "one two three four five six", "<b>", "=cmd", "Asha 123",
    "looking for a stay", "I want to book", "somewhere nice and quiet", "next weekend", "availability please"]) {
    assert.equal(parseGuestName(bad), null, bad);
  }
});

test("payload builders: guestName is the typed name or null, never the profile name", () => {
  const catalog = buildCatalog();
  const ctx = { catalog, site: "example.com", handoffNumber: "+91 9000000009", now: new Date("2026-10-07T10:00:01Z") };
  const fields = { checkIn: "2026-12-10", checkOut: "2026-12-13", guests: 2, guestsHint: null, destination: "jaipur", property: null, requirements: "" };
  const q = (f) => buildQualifiedLeadPayload({ leadId: "L-0123456789", outcome: "QUALIFIED", channel: "sandbox", guestWhatsApp: GUEST, guestName: "WhatsApp Profile", ref: null, prefillSource: "none", fields: f, nights: 3, notes: [], conversationStartedAt: "x", handedOffAt: "2026-10-07T10:00:00.000Z", botTurns: 5 }, ctx);
  assert.equal(q(Object.assign({}, fields, { guestName: "  Asha   Verma " })).payload.guestName, "Asha Verma");
  assert.equal(q(Object.assign({}, fields, { guestName: "" })).payload.guestName, null);
  assert.equal(q(fields).payload.guestName, null, "older stored conversation without the key");
  const hp = buildHandoffPayload({ handoffId: "H-0123456789", reason: "HUMAN_REQUESTED", channel: "sandbox", guestWhatsApp: GUEST, ref: null, fields: Object.assign({}, fields, { guestName: "Ravi" }), conversationStartedAt: "x", handedOffAt: "x", botTurns: 1 }, ctx);
  assert.equal(hp.payload.guestName, "Ravi");
});

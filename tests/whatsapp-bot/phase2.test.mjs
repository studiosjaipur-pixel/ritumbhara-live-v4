// Week 5 stretch, Phase 2: tests for the Twilio WhatsApp inbound webhook.
// Fake credentials only. No network access: global fetch is replaced with a counter that fails the test if called.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { computeTwilioSignature } = await import("../../lib/twilio/signature.ts");
const webhook = await import("../../lib/whatsapp-bot/webhook.ts");
const route = await import("../../app/api/whatsapp/inbound/route.ts");
const { getBotConfig } = await import("../../lib/whatsapp-bot/config.ts");
const { REPLIES, MAX_BODY_CHARS, createInboundWebhookHandler } = webhook;

// ---------- fixtures (all fake) ----------

const TOKEN = "fake_auth_token_for_tests_only_00000";
const WEBHOOK_URL = "https://example-preview.vercel.app/api/whatsapp/inbound";
const ACCOUNT_SID = "AC" + "ab".repeat(16);
const HANDOFF = "+919000000009";
const GUEST = "+919000000001";

const ENV = {
  WHATSAPP_BOT_ENABLED: "true",
  TWILIO_AUTH_TOKEN: TOKEN,
  TWILIO_WEBHOOK_URL: WEBHOOK_URL,
  TWILIO_ACCOUNT_SID: ACCOUNT_SID,
  WHATSAPP_BOT_TO: "whatsapp:+14155238886",
  WHATSAPP_HANDOFF_NUMBER: HANDOFF,
  GROQ_API_KEY: "fake_groq_key_for_tests_only",
  UPSTASH_REDIS_REST_URL: "https://fake-redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "fake_redis_token_for_tests_only",
};
const ENV_KEYS = Object.keys(ENV).concat(["GROQ_MODEL"]);

function baseParams(overrides) {
  return Object.assign({
    MessageSid: "SM" + "0123456789abcdef".repeat(2),
    AccountSid: ACCOUNT_SID,
    From: "whatsapp:" + GUEST,
    To: "whatsapp:+14155238886",
    Body: "Hi, I'd like to check availability. Ref: W-FLOATING",
    NumMedia: "0",
    ProfileName: "Test Guest",
    WaId: GUEST.slice(1),
  }, overrides || {});
}

function encode(params) {
  return new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString();
}

// Builds a request the way Twilio would send it. `requestUrl` is where it "arrives" (as seen behind a proxy);
// the signature is computed over `signUrl` (what Twilio has configured).
function twilioRequest(params, opts) {
  const o = Object.assign({ token: TOKEN, signUrl: WEBHOOK_URL, requestUrl: "http://internal-host:3000/api/whatsapp/inbound", signature: undefined, contentType: "application/x-www-form-urlencoded; charset=UTF-8", rawBody: undefined }, opts || {});
  const body = o.rawBody !== undefined ? o.rawBody : encode(params);
  const signedParams = new URLSearchParams(body);
  const headers = { "content-type": o.contentType };
  const signature = o.signature !== undefined ? o.signature : computeTwilioSignature(o.token, o.signUrl, signedParams);
  if (signature !== null) headers["x-twilio-signature"] = signature;
  return new Request(o.requestUrl, { method: "POST", headers, body });
}

// ---------- environment / network / log isolation ----------

let savedEnv;
let fetchCalls;
let savedFetch;
let logs;
let savedWarn;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  fetchCalls = 0;
  savedFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls++; throw new Error("network access is not allowed in tests"); };
  logs = [];
  savedWarn = console.warn;
  console.warn = (...args) => { logs.push(args.map(String).join(" ")); };
});

afterEach(() => {
  for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  globalThis.fetch = savedFetch;
  console.warn = savedWarn;
});

function enable(extra) { Object.assign(process.env, ENV, extra || {}); }

function spyHandler(reply) {
  const calls = [];
  const fn = async (message, config) => { calls.push({ message, config }); return { reply: reply === undefined ? "ok" : reply }; };
  fn.calls = calls;
  return fn;
}

// Handler with spies, using the real config from process.env.
function handlerWith(spy) {
  return createInboundWebhookHandler({ handleMessage: spy });
}

async function xml(res) {
  assert.equal(res.headers.get("content-type"), "text/xml; charset=utf-8");
  return res.text();
}

// ---------- 1. valid request ----------

test("1. valid Twilio signature -> 200 TwiML from the message handler", async () => {
  enable();
  const res = await handlerWith(spyHandler("Fixed test reply"))(twilioRequest(baseParams()));
  assert.equal(res.status, 200);
  assert.equal(await xml(res), '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Fixed test reply</Message></Response>');
});

test("1a. the real route with Redis unreachable replies with the team number and saves nothing", async () => {
  enable();
  const res = await route.POST(twilioRequest(baseParams()));
  assert.equal(res.status, 200);
  const body = await xml(res);
  assert.match(body, /having trouble processing your request/);
  assert.match(body, /\+91 9000000009/);
  assert.ok(fetchCalls >= 1); // it tried the (fake, blocked) Redis URL and did not fall back to memory
});

test("1b. the configured URL is used, not the request's host", async () => {
  enable();
  const spy = spyHandler();
  // Arrives on a different host/protocol (as behind Vercel's proxy) but was signed for the configured URL: accepted.
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams(), { requestUrl: "http://10.0.0.5:8080/x" }))).status, 200);
  // Signed for the URL it arrived on (not the configured one): rejected.
  const res = await handlerWith(spy)(twilioRequest(baseParams(), { signUrl: "https://attacker.example/api/whatsapp/inbound", requestUrl: "https://attacker.example/api/whatsapp/inbound" }));
  assert.equal(res.status, 403);
  assert.equal(spy.calls.length, 1);
});

// ---------- 2-6. signature failures ----------

test("2. invalid signature -> 403, nothing processed", async () => {
  enable();
  const spy = spyHandler();
  const res = await handlerWith(spy)(twilioRequest(baseParams(), { signature: "AAAAAAAAAAAAAAAAAAAAAAAAAAA=" }));
  assert.equal(res.status, 403);
  assert.equal(await res.text(), "");
  assert.equal(spy.calls.length, 0);
});

test("3. modified body -> 403", async () => {
  enable();
  const spy = spyHandler();
  const good = encode(baseParams());
  const sig = computeTwilioSignature(TOKEN, WEBHOOK_URL, new URLSearchParams(good));
  const tampered = good.replace("W-FLOATING", "W-CONTACT");
  const res = await handlerWith(spy)(twilioRequest(null, { rawBody: tampered, signature: sig }));
  assert.equal(res.status, 403);
  assert.equal(spy.calls.length, 0);
});

test("4. wrong auth token -> 403", async () => {
  enable();
  const spy = spyHandler();
  const res = await handlerWith(spy)(twilioRequest(baseParams(), { token: "some_other_token" }));
  assert.equal(res.status, 403);
  assert.equal(spy.calls.length, 0);
});

test("5. wrong webhook URL -> 403", async () => {
  enable();
  const spy = spyHandler();
  for (const signUrl of [WEBHOOK_URL + "/", "http://example-preview.vercel.app/api/whatsapp/inbound", "https://example-preview.vercel.app/api/wa-click"]) {
    assert.equal((await handlerWith(spy)(twilioRequest(baseParams(), { signUrl }))).status, 403, signUrl);
  }
  assert.equal(spy.calls.length, 0);
});

test("6. missing signature -> 403", async () => {
  enable();
  const spy = spyHandler();
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams(), { signature: null }))).status, 403);
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams(), { signature: "" }))).status, 403);
  assert.equal(spy.calls.length, 0);
});

// ---------- 7-8. account and destination ----------

test("7. wrong AccountSid -> 403 (only checked when TWILIO_ACCOUNT_SID is set)", async () => {
  enable();
  const spy = spyHandler();
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ AccountSid: "AC" + "cd".repeat(16) })))).status, 403);
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ AccountSid: undefined })))).status, 403);
  assert.equal(spy.calls.length, 0);
  // Without TWILIO_ACCOUNT_SID configured, any well-formed AccountSid is accepted.
  delete process.env.TWILIO_ACCOUNT_SID;
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ AccountSid: "AC" + "cd".repeat(16) })))).status, 200);
  assert.equal(spy.calls.length, 1);
});

test("8. wrong To -> 403 (the production number is not accepted by a Sandbox configuration)", async () => {
  enable();
  const spy = spyHandler();
  for (const To of ["whatsapp:+918306312778", "whatsapp:+14155238887", "+14155238886", "whatsapp:", ""]) {
    assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ To })))).status, 403, To);
  }
  assert.equal(spy.calls.length, 0);
});

// ---------- 9-10. required fields ----------

test("9. missing or malformed MessageSid -> 400", async () => {
  enable();
  const spy = spyHandler();
  for (const MessageSid of [undefined, "", "SM123", "XX" + "0".repeat(32), "SM" + "g".repeat(32)]) {
    assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ MessageSid })))).status, 400, String(MessageSid));
  }
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ MessageSid: "MM" + "0".repeat(32) })))).status, 200);
  assert.equal(spy.calls.length, 1);
});

test("10. malformed From -> 400", async () => {
  enable();
  const spy = spyHandler();
  for (const From of [undefined, "", GUEST, "whatsapp:abc", "whatsapp:+12", "sms:" + GUEST]) {
    assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ From })))).status, 400, String(From));
  }
  assert.equal(spy.calls.length, 0);
});

// ---------- 11-13. body handling and XML ----------

test("11. empty Body (with or without media): handler gets no text, only bodyStatus \"empty\"", async () => {
  enable();
  const spy = spyHandler("handled");
  for (const extra of [{ Body: "" }, { Body: "   \n " }, { Body: undefined }, { Body: "", NumMedia: "1", MediaUrl0: "https://example.com/m.jpg", MediaContentType0: "image/jpeg" }]) {
    const res = await handlerWith(spy)(twilioRequest(baseParams(extra)));
    assert.equal(res.status, 200);
  }
  assert.equal(spy.calls.length, 4);
  for (const c of spy.calls) { assert.equal(c.message.body, ""); assert.equal(c.message.bodyStatus, "empty"); }
  assert.equal(spy.calls[3].message.numMedia, 1);
  assert.equal(fetchCalls, 0); // media is never downloaded
});

test("12. oversized Body: the text never reaches the handler (bodyStatus \"too_long\")", async () => {
  enable();
  const spy = spyHandler();
  const long = "x".repeat(MAX_BODY_CHARS + 1);
  const res = await handlerWith(spy)(twilioRequest(baseParams({ Body: long })));
  assert.equal(res.status, 200);
  assert.equal(spy.calls.length, 1);
  assert.equal(spy.calls[0].message.body, "");
  assert.equal(spy.calls[0].message.bodyStatus, "too_long");
  // Exactly at the limit is accepted, and the handler gets the trimmed text.
  await handlerWith(spy)(twilioRequest(baseParams({ Body: "  " + "y".repeat(MAX_BODY_CHARS) + "  " })));
  assert.equal(spy.calls[1].message.body.length, MAX_BODY_CHARS);
  assert.equal(spy.calls[1].message.bodyStatus, "ok");
  // A raw request above the byte limit is refused before anything else.
  assert.equal((await handlerWith(spy)(twilioRequest(baseParams({ Body: "z".repeat(20000) })))).status, 413);
  assert.equal(spy.calls.length, 2);
});

test("13. reply text is XML-escaped", async () => {
  enable();
  const res = await handlerWith(spyHandler(`<b>Tom & "Jerry"</b> it's </Message><Redirect>x</Redirect>`))(twilioRequest(baseParams()));
  const body = await xml(res);
  assert.equal(body, '<?xml version="1.0" encoding="UTF-8"?><Response><Message>&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt; it&apos;s &lt;/Message&gt;&lt;Redirect&gt;x&lt;/Redirect&gt;</Message></Response>');
  assert.equal(body.match(/<Message>/g).length, 1);
});

test("13b. the handler receives normalized, validated fields", async () => {
  enable();
  const spy = spyHandler();
  await handlerWith(spy)(twilioRequest(baseParams({ ProfileName: "  Asha  ", NumMedia: "abc" })));
  const m = spy.calls[0].message;
  assert.equal(m.from, GUEST);
  assert.equal(m.to, "+14155238886");
  assert.equal(m.profileName, "Asha");
  assert.equal(m.numMedia, 0);
  assert.equal(m.waId, GUEST.slice(1));
});

// ---------- 14-15. disabled by default ----------

test("14. bot is disabled by default: empty TwiML, body never read", async () => {
  // No WHATSAPP_BOT_ENABLED at all, even with every other setting present.
  Object.assign(process.env, ENV);
  delete process.env.WHATSAPP_BOT_ENABLED;
  assert.equal(getBotConfig(process.env).status, "disabled");
  let bodyRead = false;
  const stream = new ReadableStream({ pull(controller) { bodyRead = true; controller.enqueue(new TextEncoder().encode(encode(baseParams()))); controller.close(); } }, { highWaterMark: 0 }); // pull() only runs if someone reads the body
  const req = new Request("http://internal-host/api/whatsapp/inbound", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: stream, duplex: "half" });
  const res = await route.POST(req);
  assert.equal(res.status, 200);
  assert.equal(await xml(res), '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  assert.equal(bodyRead, false);
  for (const value of ["false", "0", "1", "yes", ""]) {
    process.env.WHATSAPP_BOT_ENABLED = value;
    assert.equal(await (await route.POST(twilioRequest(baseParams()))).text(), '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', value);
  }
});

test("15. while disabled, no handler, store, Groq or network call happens", async () => {
  const { createConversationHandler } = await import("../../lib/whatsapp-bot/conversation.ts");
  let storesCreated = 0;
  const realHandler = createConversationHandler({ createStore: () => { storesCreated++; throw new Error("must not be called"); } });
  let handlerCalls = 0;
  const handler = createInboundWebhookHandler({ handleMessage: async (m, c) => { handlerCalls++; return realHandler(m, c); } });
  const res = await handler(twilioRequest(baseParams()));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  assert.equal(handlerCalls, 0);
  assert.equal(storesCreated, 0);
  assert.equal(fetchCalls, 0);
  assert.equal(logs.length, 0);
  // Phase 4: the only AI code is the fallback extractor; the webhook, state machine and parsers have none.
  for (const f of ["webhook", "state-machine", "parse", "dates", "store", "upstash", "messages", "catalog", "extraction"]) {
    const src = readFileSync(new URL("../../lib/whatsapp-bot/" + f + ".ts", import.meta.url), "utf8");
    assert.equal(/groq|openai|anthropic|\bllm\b|chat\/completions/i.test(src.replace(/\/\/.*$/gm, "")), false, f);
  }
});

// ---------- 16. no secrets in output or logs ----------

test("16. no secrets, signatures, full numbers or message text in responses or logs", async () => {
  const secretSig = computeTwilioSignature(TOKEN, WEBHOOK_URL, new URLSearchParams(encode(baseParams())));
  const body = "My secret plans for the 12th, call me";
  const outputs = [];
  enable();
  const cases = [
    twilioRequest(baseParams({ Body: body })),
    twilioRequest(baseParams({ Body: body }), { signature: secretSig.slice(0, -2) + "x=" }),
    twilioRequest(baseParams({ Body: body, AccountSid: "AC" + "cd".repeat(16) })),
    twilioRequest(baseParams({ Body: body, To: "whatsapp:+918306312778" })),
    twilioRequest(baseParams({ Body: body, MessageSid: "bad" })),
    twilioRequest(baseParams({ Body: "x".repeat(MAX_BODY_CHARS + 5) })),
    twilioRequest(baseParams({ Body: "" })),
  ];
  for (const req of cases) outputs.push(await (await route.POST(req)).text());
  // Misconfigured: setting names are logged, values are not.
  process.env.TWILIO_WEBHOOK_URL = "http://not-https.example/hook";
  process.env.UPSTASH_REDIS_REST_TOKEN = "";
  const misconfigured = await route.POST(twilioRequest(baseParams()));
  assert.equal(misconfigured.status, 503);
  outputs.push(await misconfigured.text());
  // Internal error after verification: fixed fallback reply, no details.
  enable();
  const boom = createInboundWebhookHandler({ handleMessage: async () => { throw new Error("db password=" + ENV.UPSTASH_REDIS_REST_TOKEN); } });
  const fallback = await boom(twilioRequest(baseParams()));
  assert.equal(fallback.status, 200);
  const fallbackText = await fallback.text();
  assert.match(fallbackText, /something went wrong/);
  outputs.push(fallbackText);

  const everything = outputs.join("\n") + "\n" + logs.join("\n");
  assert.ok(logs.length >= 8, "expected sanitized log lines");
  assert.ok(logs.some((l) => l.includes("TWILIO_WEBHOOK_URL") && l.includes("UPSTASH_REDIS_REST_TOKEN")));
  for (const secret of [TOKEN, ENV.GROQ_API_KEY, ENV.UPSTASH_REDIS_REST_TOKEN, secretSig, ACCOUNT_SID, GUEST, GUEST.slice(1), body, "not-https.example", "db password"]) {
    assert.equal(everything.includes(secret), false, "leaked: " + secret.slice(0, 12));
  }
  assert.ok(logs.some((l) => l.includes("***0001")), "masked number expected in logs");
});

// ---------- misc HTTP behaviour ----------

test("other requests: wrong content type 415, GET 405, error before verification 500", async () => {
  enable();
  assert.equal((await route.POST(twilioRequest(baseParams(), { contentType: "application/json" }))).status, 415);
  assert.equal((await route.GET()).status, 405);
  const broken = createInboundWebhookHandler({ getConfig: () => { throw new Error("boom"); } });
  const res = await broken(twilioRequest(baseParams()));
  assert.equal(res.status, 500);
  assert.equal(await res.text(), "");
  assert.equal(route.maxDuration, 15); // Phase 4: room for the 4 s AI fallback
});

// Week 5 stretch, Phase 1: tests for the pure WhatsApp bot helpers.
// No network access, no real credentials, no Twilio requests.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
//
// The signature vectors below were generated with the official Twilio Node SDK (twilio@5.13.1,
// getExpectedTwilioSignature / validateRequest) using the fake token below, so they pin this helper to Twilio's
// own algorithm. The SDK is not a dependency of this project.

import { test } from "node:test";
import assert from "node:assert/strict";

const { verifyTwilioSignature, computeTwilioSignature } = await import("../../lib/twilio/signature.ts");
const { escapeXml, twimlMessage, twimlEmpty, twimlMessageXml } = await import("../../lib/twilio/twiml.ts");
const { isBotEnabled, getBotConfig, describeBotConfig, DEFAULT_GROQ_MODEL } = await import("../../lib/whatsapp-bot/config.ts");
const { parseWhatsAppAddress, normalizePhoneNumber, maskPhoneNumber } = await import("../../lib/whatsapp-bot/address.ts");
const { storeKeys } = await import("../../lib/whatsapp-bot/store.ts");
const { CONVERSATION_STATES } = await import("../../lib/whatsapp-bot/types.ts");

// ---------- Twilio signature ----------

const TOKEN = "test_auth_token_not_real_0123456789"; // fake, test-only
const URL_ = "https://example-preview.vercel.app/api/whatsapp/inbound";
const PARAMS = {
  MessageSid: "SM00000000000000000000000000000001",
  AccountSid: "AC00000000000000000000000000000000",
  From: "whatsapp:+919000000001",
  To: "whatsapp:+14155238886",
  Body: "Hi, I'd like to check availability in Jaipur from 2026-11-12 to 2026-11-15 for 3 guests.\n\nRef: W-DEST-jaipur-AVAILABILITY & <test> \"q\" 'a'",
  NumMedia: "0",
  ProfileName: "Test Guest",
  WaId: "919000000001",
};
const SDK = {
  simple: "D5HZPNHVOXj5LS/mW4TkX6UQb5I=",
  withQuery: "Pw3AFt1EeFsWZfLgmOoMToGEtOA=",
  multi: "aFePVO534jxkYjGPySszOU9oIGE=",
  empty: "p8qx9jlbBJNccS1Cv3NdSlwVW7I=",
};

function formBody(params) {
  return new URLSearchParams(Object.entries(params)).toString();
}

test("signature: computes the same value as the official Twilio SDK", () => {
  assert.equal(computeTwilioSignature(TOKEN, URL_, PARAMS), SDK.simple);
  assert.equal(computeTwilioSignature(TOKEN, URL_ + "?x-vercel-protection-bypass=abc123&b=2", PARAMS), SDK.withQuery);
  assert.equal(computeTwilioSignature(TOKEN, URL_, { To: "x", Media: ["b", "a"] }), SDK.multi);
  assert.equal(computeTwilioSignature(TOKEN, URL_, {}), SDK.empty);
});

test("signature: accepts a known-good signature (object params and raw form body)", () => {
  assert.equal(verifyTwilioSignature({ url: URL_, params: PARAMS, signature: SDK.simple, authToken: TOKEN }), true);
  const fromBody = new URLSearchParams(formBody(PARAMS));
  assert.equal(verifyTwilioSignature({ url: URL_, params: fromBody, signature: SDK.simple, authToken: TOKEN }), true);
});

test("signature: accepts a URL with query string and repeated parameters", () => {
  assert.equal(verifyTwilioSignature({ url: URL_ + "?x-vercel-protection-bypass=abc123&b=2", params: PARAMS, signature: SDK.withQuery, authToken: TOKEN }), true);
  const repeated = new URLSearchParams("To=x&Media=b&Media=a");
  assert.equal(verifyTwilioSignature({ url: URL_, params: repeated, signature: SDK.multi, authToken: TOKEN }), true);
});

test("signature: accepts the standard-port variant, as the Twilio SDK does", () => {
  const withPort = "https://example-preview.vercel.app:443/api/whatsapp/inbound";
  assert.equal(verifyTwilioSignature({ url: withPort, params: PARAMS, signature: SDK.simple, authToken: TOKEN }), true);
});

test("signature: rejects a modified parameter", () => {
  const tampered = Object.assign({}, PARAMS, { Body: PARAMS.Body + "!" });
  assert.equal(verifyTwilioSignature({ url: URL_, params: tampered, signature: SDK.simple, authToken: TOKEN }), false);
  const extra = Object.assign({}, PARAMS, { Extra: "1" });
  assert.equal(verifyTwilioSignature({ url: URL_, params: extra, signature: SDK.simple, authToken: TOKEN }), false);
  const fromChanged = Object.assign({}, PARAMS, { From: "whatsapp:+919000000002" });
  assert.equal(verifyTwilioSignature({ url: URL_, params: fromChanged, signature: SDK.simple, authToken: TOKEN }), false);
});

test("signature: rejects a wrong signature, wrong token or different URL", () => {
  assert.equal(verifyTwilioSignature({ url: URL_, params: PARAMS, signature: "D5HZPNHVOXj5LS/mW4TkX6UQb5J=", authToken: TOKEN }), false);
  assert.equal(verifyTwilioSignature({ url: URL_, params: PARAMS, signature: SDK.simple, authToken: TOKEN + "x" }), false);
  assert.equal(verifyTwilioSignature({ url: URL_ + "/", params: PARAMS, signature: SDK.simple, authToken: TOKEN }), false);
  assert.equal(verifyTwilioSignature({ url: "http://example-preview.vercel.app/api/whatsapp/inbound", params: PARAMS, signature: SDK.simple, authToken: TOKEN }), false);
});

test("signature: rejects missing or malformed input without throwing", () => {
  const base = { url: URL_, params: PARAMS, signature: SDK.simple, authToken: TOKEN };
  for (const patch of [
    { signature: null }, { signature: undefined }, { signature: "" }, { signature: "   " },
    { signature: "x".repeat(500) }, { signature: 12345 },
    { authToken: "" }, { authToken: undefined },
    { url: "" }, { url: "not a url" }, { params: null },
  ]) {
    assert.equal(verifyTwilioSignature(Object.assign({}, base, patch)), false, JSON.stringify(Object.keys(patch)));
  }
});

// ---------- TwiML ----------

test("twiml: escapes & < > \" '", () => {
  assert.equal(escapeXml(`a & b < c > d " e ' f`), "a &amp; b &lt; c &gt; d &quot; e &apos; f");
  assert.equal(escapeXml("&amp;"), "&amp;amp;");
  assert.equal(escapeXml("</Message><Redirect>x</Redirect>"), "&lt;/Message&gt;&lt;Redirect&gt;x&lt;/Redirect&gt;");
});

test("twiml: strips characters that are invalid in XML, keeps emoji and newlines", () => {
  assert.equal(escapeXml("a\u0000b\u0007c\u001Fd"), "abcd");
  assert.equal(escapeXml("line1\nline2\tx\r"), "line1\nline2\tx\r");
  assert.equal(escapeXml("ok 😀 done"), "ok 😀 done");
  assert.equal(escapeXml("lone \uD83D high"), "lone  high");
  assert.equal(escapeXml("lone \uDE00\uDE00 low"), "lone  low");
  assert.equal(escapeXml(null), "");
});

test("twiml: message response has the right body, status and content type", async () => {
  const res = twimlMessage(`Hi <guest> & "friends"`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/xml; charset=utf-8");
  assert.equal(await res.text(),
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Hi &lt;guest&gt; &amp; &quot;friends&quot;</Message></Response>');
  assert.equal(twimlMessageXml("x").match(/<Message>/g).length, 1);
});

test("twiml: empty response sends no message", async () => {
  const res = twimlEmpty();
  assert.equal(res.headers.get("content-type"), "text/xml; charset=utf-8");
  const body = await res.text();
  assert.equal(body, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  assert.equal(body.includes("<Message"), false);
});

// ---------- Config ----------

const FULL_ENV = {
  WHATSAPP_BOT_ENABLED: "true",
  TWILIO_AUTH_TOKEN: "fake-token-value-123",
  TWILIO_WEBHOOK_URL: "https://example-preview.vercel.app/api/whatsapp/inbound",
  TWILIO_ACCOUNT_SID: "AC" + "0".repeat(32),
  WHATSAPP_BOT_TO: "whatsapp:+14155238886",
  WHATSAPP_HANDOFF_NUMBER: "+91 95030 02629",
  GROQ_API_KEY: "fake-groq-key-456",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "fake-redis-token-789",
};

test("config: bot is disabled by default and for any value other than \"true\"", () => {
  assert.equal(isBotEnabled({}), false);
  for (const v of ["", "false", "0", "1", "yes", "on", "enabled", " false "]) {
    assert.equal(isBotEnabled({ WHATSAPP_BOT_ENABLED: v }), false, v);
  }
  assert.equal(isBotEnabled({ WHATSAPP_BOT_ENABLED: "true" }), true);
  assert.equal(isBotEnabled({ WHATSAPP_BOT_ENABLED: " TRUE " }), true);
  assert.deepEqual(getBotConfig({}), { status: "disabled" });
  assert.deepEqual(getBotConfig(Object.assign({}, FULL_ENV, { WHATSAPP_BOT_ENABLED: "false" })), { status: "disabled" });
});

test("config: the real environment of this test run leaves the bot disabled", () => {
  if (process.env.WHATSAPP_BOT_ENABLED === undefined) assert.equal(isBotEnabled(), false);
});

test("config: a complete environment is ready and normalized", () => {
  const result = getBotConfig(FULL_ENV);
  assert.equal(result.status, "ready");
  assert.equal(result.config.botTo, "+14155238886");
  assert.equal(result.config.handoffNumber, "+919503002629");
  assert.equal(result.config.groqModel, DEFAULT_GROQ_MODEL);
  assert.equal(result.config.twilioAccountSid, "AC" + "0".repeat(32));
});

test("config: missing or invalid settings are reported by name, never by value", () => {
  const env = Object.assign({}, FULL_ENV, {
    TWILIO_AUTH_TOKEN: "", TWILIO_WEBHOOK_URL: "http://insecure.example/x", TWILIO_ACCOUNT_SID: "bad",
    WHATSAPP_HANDOFF_NUMBER: "call us", UPSTASH_REDIS_REST_TOKEN: "",
  });
  const result = getBotConfig(env);
  assert.equal(result.status, "invalid");
  const text = JSON.stringify(result);
  for (const name of ["TWILIO_AUTH_TOKEN", "TWILIO_WEBHOOK_URL", "TWILIO_ACCOUNT_SID", "WHATSAPP_HANDOFF_NUMBER", "UPSTASH_REDIS_REST_TOKEN"]) {
    assert.ok(text.includes(name), name);
  }
  for (const secret of ["fake-groq-key-456", "fake-redis-token-789", "insecure.example", "call us"]) {
    assert.equal(text.includes(secret), false, secret);
  }
  assert.equal(getBotConfig(Object.assign({}, FULL_ENV, { TWILIO_WEBHOOK_URL: FULL_ENV.TWILIO_WEBHOOK_URL + "#rc=2" })).status, "invalid");
});

test("config: describeBotConfig never contains secret values", () => {
  const text = JSON.stringify(describeBotConfig(FULL_ENV));
  for (const value of Object.values(FULL_ENV)) {
    if (value !== "true") assert.equal(text.includes(value), false, value);
  }
});

// ---------- Address helpers ----------

test("address: parses Twilio WhatsApp addresses and normalizes phone numbers", () => {
  assert.equal(parseWhatsAppAddress("whatsapp:+919000000001"), "+919000000001");
  assert.equal(parseWhatsAppAddress("+919000000001"), null);
  assert.equal(parseWhatsAppAddress("whatsapp:919000000001"), null);
  assert.equal(parseWhatsAppAddress("whatsapp:+12"), null);
  assert.equal(parseWhatsAppAddress(undefined), null);
  assert.equal(normalizePhoneNumber("+91 95030 02629"), "+919503002629");
  assert.equal(normalizePhoneNumber("+91-9503002629"), "+919503002629");
  assert.equal(normalizePhoneNumber("919503002629"), "+919503002629");
  assert.equal(normalizePhoneNumber("call 9503"), null);
  assert.equal(maskPhoneNumber("+919503002629"), "***2629");
});

// ---------- Store placeholder ----------

// Phase 3 replaced the Phase 1 placeholder store with the real Redis store (tested in phase3.test.mjs).
test("store: key layout only accepts validated senders and MessageSids", () => {
  assert.equal(storeKeys.conversation("+919000000001"), "wa:conv:+919000000001");
  assert.equal(storeKeys.message("SM" + "0".repeat(32)), "wa:msg:SM" + "0".repeat(32));
  assert.throws(() => storeKeys.conversation("919000000001"));
  assert.throws(() => storeKeys.conversation("+91*"));
  assert.throws(() => storeKeys.message("SM1"));
});

test("types: conversation states match the agreed architecture", () => {
  assert.deepEqual([...CONVERSATION_STATES], [
    "NEW", "ASK_DATES", "ASK_CHECKOUT", "ASK_GUESTS", "ASK_STAY", "ASK_REQUIREMENTS",
    "CONFIRM", "QUALIFIED", "HANDED_OFF", "OPTED_OUT",
  ]);
});

// Meta WhatsApp alongside Twilio: the OS-facing lead bot endpoint, the Meta template sender and the follow-up
// provider switch. No network, fake credentials only. The Twilio paths are covered (unchanged) by the existing suites.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const { createMetaLeadBotHandler, getMetaLeadBotConfig, verifyOsSignature } = await import("../../lib/whatsapp-bot/lead-bot-meta.ts");
const { createConversationStore } = await import("../../lib/whatsapp-bot/store.ts");
const { createConversationHandler } = await import("../../lib/whatsapp-bot/conversation.ts");
const { sendMetaTemplate, getMetaConfig } = await import("../../lib/meta/send.ts");
const { sendFollowUpViaMeta, isMetaFollowUpProvider } = await import("../../lib/meta/follow-up.ts");

const SECRET = "lead_bot_os_secret_for_tests_only_0123456789";
const NOW_MS = Date.UTC(2026, 9, 7, 6, 30); // 7 Oct 2026, 12:00 India time
const ENV = {
  WHATSAPP_BOT_META_ENABLED: "true",
  LEAD_BOT_OS_SECRET: SECRET,
  WHATSAPP_META_BOT_TO: "+15550001111",
  WHATSAPP_HANDOFF_NUMBER: "+919000000009",
  UPSTASH_REDIS_REST_URL: "https://fake-redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "fake_redis_token",
  VERCEL_ENV: "preview",
};

function sign(body, t = Math.floor(NOW_MS / 1000), secret = SECRET) {
  return "t=" + t + ",v1=" + createHmac("sha256", secret).update(t + "." + body).digest("hex");
}
function request(bodyObj, header) {
  const body = typeof bodyObj === "string" ? bodyObj : JSON.stringify(bodyObj);
  const headers = { "Content-Type": "application/json" };
  if (header !== null) headers["X-Ritumbhara-Signature"] = header === undefined ? sign(body) : header;
  return new Request("https://www.ritumbhara.com/api/whatsapp/lead-bot", { method: "POST", headers, body });
}
const MSG = { messageId: "wamid.HBgMOTE5MDAwMDAwMDAxFQIAEhgg", from: "+919000000001", text: "Hi", numMedia: 0, profileName: "Asha" };

// ---------- config ----------
test("config: off unless WHATSAPP_BOT_META_ENABLED=true; needs no Twilio setting; reports names only", () => {
  assert.deepEqual(getMetaLeadBotConfig({}), { status: "disabled" });
  const ready = getMetaLeadBotConfig(ENV);
  assert.equal(ready.status, "ready");
  assert.equal(ready.config.botTo, "+15550001111");
  assert.equal(ready.config.redisNamespace, "preview");
  const bad = getMetaLeadBotConfig({ WHATSAPP_BOT_META_ENABLED: "true", LEAD_BOT_OS_SECRET: "short" });
  assert.equal(bad.status, "invalid");
  assert.ok(bad.problems.every((p) => !p.includes(SECRET)));
});

// ---------- signature ----------
test("signature: valid within ±5 min; wrong secret, tampered body, stale time and junk rejected", () => {
  const body = JSON.stringify(MSG);
  const now = Math.floor(NOW_MS / 1000);
  assert.equal(verifyOsSignature(SECRET, body, sign(body), now), true);
  assert.equal(verifyOsSignature(SECRET, body + " ", sign(body), now), false);
  assert.equal(verifyOsSignature(SECRET, body, sign(body, now, "x".repeat(40)), now), false);
  assert.equal(verifyOsSignature(SECRET, body, sign(body, now - 301), now), false);
  assert.equal(verifyOsSignature(SECRET, body, "garbage", now), false);
  assert.equal(verifyOsSignature(SECRET, body, null, now), false);
});

// ---------- endpoint ----------
function handlerWith(overrides = {}) {
  const calls = [];
  const h = createMetaLeadBotHandler({
    getConfig: () => getMetaLeadBotConfig(ENV),
    handleMessage: async (m, c) => { calls.push({ m, c }); return { reply: "When would you like to check in?" }; },
    now: () => NOW_MS,
    log: () => {},
    ...overrides,
  });
  return { h, calls };
}

test("endpoint: signed request -> conversation handler with the Meta message id and number; reply returned as JSON", async () => {
  const { h, calls } = handlerWith();
  const res = await h(request(MSG));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, replies: ["When would you like to check in?"] });
  assert.match(calls[0].m.messageSid, /^SM[0-9a-f]{32}$/); // stable store id derived from the Meta id
  assert.equal(calls[0].m.from, "+919000000001");
  assert.equal(calls[0].m.to, "+15550001111");
  assert.equal(calls[0].m.bodyStatus, "ok");
  assert.equal(calls[0].m.profileName, "Asha");
});

test("endpoint: disabled 404, misconfigured 503, unsigned/forged 403, wrong type 415, malformed 400 — handler never called", async () => {
  const { h, calls } = handlerWith();
  assert.equal((await createMetaLeadBotHandler({ getConfig: () => ({ status: "disabled" }), log: () => {} })(request(MSG))).status, 404);
  assert.equal((await createMetaLeadBotHandler({ getConfig: () => getMetaLeadBotConfig({ WHATSAPP_BOT_META_ENABLED: "true" }), log: () => {} })(request(MSG))).status, 503);
  assert.equal((await h(request(MSG, null))).status, 403);
  assert.equal((await h(request(MSG, sign(JSON.stringify(MSG), undefined, "y".repeat(40))))).status, 403);
  assert.equal((await h(new Request("https://x/api", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "a" }))).status, 415);
  assert.equal((await h(request({ ...MSG, messageId: "" }))).status, 400);
  assert.equal((await h(request({ ...MSG, from: "abc" }))).status, 400);
  assert.equal(calls.length, 0);
});

test("endpoint: media-only / over-long text is never passed on as text", async () => {
  const { h, calls } = handlerWith();
  await h(request({ ...MSG, text: "", numMedia: 1 }));
  await h(request({ ...MSG, messageId: "wamid.SECOND123", text: "x".repeat(1001) }));
  assert.deepEqual(calls.map((c) => [c.m.body, c.m.bodyStatus, c.m.numMedia]), [["", "empty", 1], ["", "too_long", 0]]);
});

test("end to end with the real conversation handler: first message is answered, a retried Meta message id is not", async () => {
  const fake = createFakeRedis();
  fake.state.nowMs = NOW_MS;
  const store = createConversationStore(fake.client);
  const real = createConversationHandler({
    createStore: () => store,
    now: () => new Date(fake.state.nowMs),
    emitQualified: async () => ({ ok: true, status: "stored", emailStatus: "SENT" }),
    emitHandoff: async () => ({ ok: true, status: "stored", emailStatus: "SENT" }),
    log: () => {},
    sleep: async (ms) => fake.advance(ms),
  });
  const { h } = handlerWith({ handleMessage: real });
  const first = await (await h(request(MSG))).json();
  assert.equal(first.ok, true);
  assert.equal(first.replies.length, 1);
  assert.ok(first.replies[0].length > 0);
  const retry = await (await h(request(MSG))).json();
  assert.deepEqual(retry, { ok: true, replies: [] });
});

// ---------- Meta template sender + follow-up switch ----------
function fakeFetch(status, body, calls) {
  return async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status }); };
}

test("meta send: Graph API template payload; result shape matches the Twilio sender; errors stay short", async () => {
  const calls = [];
  const cfg = getMetaConfig({ META_WA_ACCESS_TOKEN: "t", META_WA_PHONE_NUMBER_ID: "1234567890" });
  assert.equal(cfg.graphApiVersion, "v23.0");
  const ok = await sendMetaTemplate(cfg, { to: "+919000000001", name: "lead_follow_up", language: "en", params: ["Jaipur", "12 Nov"] }, fakeFetch(200, { messages: [{ id: "wamid.F1" }] }, calls));
  assert.deepEqual(ok, { ok: true, sid: "wamid.F1" });
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(calls[0].url, "https://graph.facebook.com/v23.0/1234567890/messages");
  assert.equal(sent.to, "919000000001");
  assert.deepEqual(sent.template.components[0].parameters, [{ type: "text", text: "Jaipur" }, { type: "text", text: "12 Nov" }]);
  const bad = await sendMetaTemplate(cfg, { to: "+919000000001", name: "lead_follow_up", language: "en", params: [] }, fakeFetch(401, { error: { code: 190, message: "token for +9190..." } }, calls));
  assert.deepEqual(bad, { ok: false, reason: "http_401", status: 401, systemic: true, code: 190 });
  assert.equal((await sendMetaTemplate(cfg, { to: "919", name: "x", language: "en", params: [] })).reason, "invalid_input");
  assert.equal(getMetaConfig({}), null);
});

test("follow-up switch: Twilio unless WHATSAPP_FOLLOW_UP_PROVIDER=meta; Meta uses the configured template and ordered variables", async () => {
  assert.equal(isMetaFollowUpProvider({}), false);
  assert.equal(isMetaFollowUpProvider({ WHATSAPP_FOLLOW_UP_PROVIDER: "twilio" }), false);
  assert.equal(isMetaFollowUpProvider({ WHATSAPP_FOLLOW_UP_PROVIDER: "Meta" }), true);
  const calls = [];
  const msg = { accountSid: "AC" + "0".repeat(32), authToken: "x", from: "+918306312778", to: "+919000000001", contentSid: "HX" + "0".repeat(32), contentVariables: { "2": "12 Nov", "1": "Jaipur" } };
  const env = { META_WA_ACCESS_TOKEN: "t", META_WA_PHONE_NUMBER_ID: "1234567890", WHATSAPP_FOLLOW_UP_META_TEMPLATE: "lead_follow_up" };
  const r = await sendFollowUpViaMeta(msg, env, fakeFetch(200, { messages: [{ id: "wamid.F2" }] }, calls));
  assert.deepEqual(r, { ok: true, sid: "wamid.F2" });
  assert.deepEqual(JSON.parse(calls[0].init.body).template.components[0].parameters.map((p) => p.text), ["Jaipur", "12 Nov"]);
  assert.deepEqual(await sendFollowUpViaMeta(msg, { META_WA_ACCESS_TOKEN: "t" }), { ok: false, reason: "meta_not_configured", systemic: true });
});

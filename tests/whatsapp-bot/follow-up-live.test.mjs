// Week 6 Stretch 2: LIVE automatic WhatsApp follow-ups (POST /api/whatsapp/follow-up, mode "live").
// Twilio is always a fake here: no network, no real message. Proves live is fail-closed (own switch + inbound bot
// enabled + Account SID + approved template), opt-out before claim, permanent claim before send, no resend after a
// failure, Message SID returned, only guest-safe template variables, and no secrets/full numbers in logs.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const { createFollowUpHandler, getFollowUpConfig, getFollowUpLiveStatus, parseContentVariables, buildTemplateVariables, FOLLOW_UP_PHONE_COOLDOWN_SECONDS } =
  await import("../../lib/whatsapp-bot/follow-up.ts");
const { createStoreKeys } = await import("../../lib/whatsapp-bot/store.ts");

const SECRET = "f".repeat(20) + "0123456789abcdef";
const AUTH_TOKEN = "fake-twilio-auth-token-value";
const ACCOUNT_SID = "AC" + "a".repeat(32);
const CONTENT_SID = "HX" + "b".repeat(32);
const MSG_SID = "SM" + "c".repeat(32);
const REDIS_TOKEN = "test-redis-token-value";
const LEAD = "L-0123456789";
const LEAD2 = "L-ABCDEF0123";
const PHONE = "+919000000001";
const BOT_NUMBER = "+14155238886";
const NOW = new Date("2026-10-12T07:30:00Z");

// Everything live needs (fake values). Tests remove or change one item at a time.
const LIVE_ENV = {
  WHATSAPP_FOLLOW_UP_ENABLED: "true",
  WHATSAPP_FOLLOW_UP_SECRET: SECRET,
  UPSTASH_REDIS_REST_URL: "https://example-redis.test",
  UPSTASH_REDIS_REST_TOKEN: REDIS_TOKEN,
  VERCEL_ENV: "production",
  WHATSAPP_FOLLOW_UP_LIVE_ENABLED: "true",
  WHATSAPP_FOLLOW_UP_CONTENT_SID: CONTENT_SID,
  WHATSAPP_BOT_ENABLED: "true",
  TWILIO_AUTH_TOKEN: AUTH_TOKEN,
  TWILIO_WEBHOOK_URL: "https://example.test/api/whatsapp/inbound",
  TWILIO_ACCOUNT_SID: ACCOUNT_SID,
  WHATSAPP_BOT_TO: "whatsapp:" + BOT_NUMBER,
  WHATSAPP_HANDOFF_NUMBER: "+919000000009",
};

const KEYS = createStoreKeys("production");

function setup(envOverrides = {}, { send } = {}) {
  const env = Object.assign({}, LIVE_ENV, envOverrides);
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  const redis = createFakeRedis();
  redis.state.nowMs = NOW.getTime();
  const logs = [];
  const sends = [];
  let redisCreated = 0;
  const handler = createFollowUpHandler({
    getConfig: () => getFollowUpConfig(env),
    createRedis: () => { redisCreated++; return redis.client; },
    sendTemplate: async (msg) => {
      // what the live claim keys held at the moment Twilio was called
      const claims = redis.keys().filter((k) => k.indexOf(":wa:fu:") !== -1).map((k) => redis.get(k));
      sends.push({ msg, claimsAtSend: claims });
      return send ? send(msg, redis) : { ok: true, sid: MSG_SID };
    },
    now: () => NOW,
    log: (event, meta) => logs.push(event + (meta ? " " + JSON.stringify(meta) : "")),
  });
  return { handler, redis, logs, sends, redisCount: () => redisCreated };
}
async function call(t, body) {
  const res = await t.handler(new Request("https://example.test/api/whatsapp/follow-up", {
    method: "POST", headers: { Authorization: "Bearer " + SECRET, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  return { status: res.status, body: JSON.parse(await res.text()) };
}

const live = (leadId = LEAD, extra = {}) => Object.assign({ leadId, phone: PHONE, mode: "live" }, extra);

function assertNoSecrets(logs) {
  const all = logs.join("\n");
  for (const s of [SECRET, AUTH_TOKEN, REDIS_TOKEN, PHONE, ACCOUNT_SID]) assert.ok(!all.includes(s), "logged a secret or full number");
}

// ---------- fail closed ----------

test("live is OFF by default: no live switch -> 409 live_flag_off, Redis and Twilio untouched", async () => {
  for (const v of [undefined, "", "false", "1", "yes"]) {
    const t = setup({ WHATSAPP_FOLLOW_UP_LIVE_ENABLED: v });
    const r = await call(t, live());
    assert.equal(r.status, 409, String(v));
    assert.deepEqual(r.body, { ok: false, error: "live_not_available", reason: "live_flag_off" });
    assert.equal(t.redisCount(), 0);
    assert.equal(t.sends.length, 0);
  }
});

test("live requires WHATSAPP_BOT_ENABLED=true (so STOP replies are recorded) and a valid bot configuration", async () => {
  for (const over of [{ WHATSAPP_BOT_ENABLED: undefined }, { WHATSAPP_BOT_ENABLED: "false" }, { TWILIO_AUTH_TOKEN: undefined }, { WHATSAPP_BOT_TO: "not-a-number" }]) {
    const t = setup(over);
    const r = await call(t, live());
    assert.equal(r.status, 409, JSON.stringify(over));
    assert.equal(r.body.reason, "bot_disabled");
    assert.equal(t.sends.length, 0);
    assert.equal(t.redisCount(), 0);
    assertNoSecrets(t.logs);
  }
});

test("live requires the approved template Content SID and the Account SID; never invents one", async () => {
  // A malformed Account SID already makes the bot's own configuration invalid, so it reports bot_disabled.
  for (const [over, reason] of [[{ WHATSAPP_FOLLOW_UP_CONTENT_SID: undefined }, "live_misconfigured"], [{ WHATSAPP_FOLLOW_UP_CONTENT_SID: "HX123" }, "live_misconfigured"],
    [{ WHATSAPP_FOLLOW_UP_CONTENT_SID: "SM" + "b".repeat(32) }, "live_misconfigured"], [{ TWILIO_ACCOUNT_SID: undefined }, "live_misconfigured"],
    [{ TWILIO_ACCOUNT_SID: "AC123" }, "bot_disabled"]]) {
    const t = setup(over);
    const r = await call(t, live());
    assert.equal(r.status, 409, JSON.stringify(over));
    assert.equal(r.body.reason, reason, JSON.stringify(over));
    assert.equal(t.sends.length, 0);
    assert.equal(t.redisCount(), 0);
    assert.ok(t.logs.some((l) => l.startsWith("follow_up_live_config_problems")));
    assertNoSecrets(t.logs);
  }
});

test("template variable mapping may only use guest-safe fields", () => {
  assert.deepEqual(parseContentVariables("1=destination, 2=checkIn,3=checkOut,4=property").problems, []);
  for (const bad of ["1=leadId", "1=score", "1=priority", "1=source", "1=ref", "1=notes", "1=phone", "0=destination", "x=destination", "1=destination,1=checkIn"]) {
    assert.ok(parseContentVariables(bad).problems.length > 0, bad);
    const s = getFollowUpLiveStatus(Object.assign({}, LIVE_ENV, { WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES: bad }));
    assert.equal(s.status, "off", bad);
    assert.equal(s.reason, "live_misconfigured", bad);
  }
  assert.equal(getFollowUpLiveStatus(LIVE_ENV).status, "ready");
});

// ---------- dry run stays dry ----------

test("dry_run never calls Twilio and never touches the live claim, even when live is fully configured", async () => {
  const t = setup();
  const r = await call(t, { leadId: LEAD, phone: PHONE, mode: "dry_run" });
  assert.equal(r.status, 200);
  assert.equal(r.body.result, "would_send");
  assert.equal(r.body.liveReady, true);
  assert.equal(t.sends.length, 0);
  assert.deepEqual(t.redis.keys(), [KEYS.followUpDryRun(LEAD)]);
});

// ---------- live behaviour ----------

test("live: opted-out guest -> opted_out, never claimed, never sent", async () => {
  const t = setup();
  await t.redis.client.command(["SET", KEYS.optOut(PHONE), "1"]);
  const r = await call(t, live());
  assert.equal(r.status, 200);
  assert.equal(r.body.result, "opted_out");
  assert.equal(t.sends.length, 0);
  assert.equal(t.redis.get(KEYS.followUp(LEAD)), null);
});

test("live: the permanent claim is taken BEFORE Twilio is called; success records the Message SID", async () => {
  const t = setup();
  const r = await call(t, live());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, mode: "live", leadId: LEAD, result: "sent", messageSid: MSG_SID, liveReady: true, botEnabled: true });
  assert.equal(t.sends.length, 1);
  assert.deepEqual(t.sends[0].claimsAtSend.map((c) => JSON.parse(c)), [{ state: "sending", at: NOW.toISOString() }], "claim existed at send time");
  const claim = JSON.parse(t.redis.get(KEYS.followUp(LEAD)));
  assert.deepEqual(claim, { state: "sent", at: NOW.toISOString(), sid: MSG_SID });
  assert.equal(t.redis.ttlSeconds(KEYS.followUp(LEAD)), -1, "permanent: no expiry");
  assert.equal(KEYS.followUp(LEAD), "production:wa:fu:" + LEAD);
  assert.ok(!t.redis.get(KEYS.followUp(LEAD)).includes(PHONE), "claim holds no phone number");
  assert.equal(t.redis.get(KEYS.followUpDryRun(LEAD)), null, "live never writes the dry-run key");
});

test("live: a second call for the same lead is duplicate and sends nothing; another lead is independent", async () => {
  const t = setup();
  assert.equal((await call(t, live())).body.result, "sent");
  assert.equal((await call(t, live())).body.result, "duplicate");
  t.redis.advance(400 * 24 * 3600 * 1000); // the claim never expires
  assert.equal((await call(t, live())).body.result, "duplicate");
  assert.equal(t.sends.length, 1);
  assert.equal((await call(t, live(LEAD2))).body.result, "sent");
  assert.equal(t.sends.length, 2);
});

test("live: an earlier dry-run claim does not block the real follow-up", async () => {
  const t = setup();
  await call(t, { leadId: LEAD, phone: PHONE, mode: "dry_run" });
  assert.equal((await call(t, live())).body.result, "sent");
});

test("live: Twilio failure keeps the claim (state failed) and the lead is never sent again", async () => {
  for (const failure of [{ ok: false, reason: "http_400", status: 400, code: 21211, systemic: false }, { ok: false, reason: "timeout", systemic: true }]) {
    const t = setup({}, { send: () => failure });
    const r = await call(t, live());
    assert.equal(r.status, 200);
    assert.equal(r.body.result, "send_failed");
    assert.equal(r.body.reason, failure.reason);
    assert.equal(r.body.systemic, failure.systemic);
    if (failure.code) assert.equal(r.body.twilioCode, failure.code);
    assert.equal(JSON.parse(t.redis.get(KEYS.followUp(LEAD))).state, "failed");
    assert.equal(t.redis.ttlSeconds(KEYS.followUp(LEAD)), -1);
    assert.equal((await call(t, live())).body.result, "duplicate");
    assert.equal(t.sends.length, 1);
    assertNoSecrets(t.logs);
  }
});

test("live: a sender that throws is treated as send_failed and the claim is kept", async () => {
  const t = setup({}, { send: () => { throw new Error("boom " + AUTH_TOKEN); } });
  const r = await call(t, live());
  assert.equal(r.body.result, "send_failed");
  assert.equal(r.body.reason, "internal");
  assert.ok(t.redis.get(KEYS.followUp(LEAD)));
  assertNoSecrets(t.logs);
});

test("live: if Redis fails after a successful send, the result is still 'sent' and the 'sending' claim still blocks", async () => {
  const t = setup({}, { send: (msg, redis) => { redis.state.down = true; return { ok: true, sid: MSG_SID }; } });
  const r = await call(t, live());
  assert.equal(r.body.result, "sent");
  assert.equal(r.body.messageSid, MSG_SID);
  t.redis.state.down = false;
  assert.equal(JSON.parse(t.redis.get(KEYS.followUp(LEAD))).state, "sending");
  assert.equal(t.redis.ttlSeconds(KEYS.followUp(LEAD)), -1, "the 'sending' claim itself never expires");
  t.redis.advance(400 * 24 * 3600 * 1000);
  assert.equal((await call(t, live())).body.result, "duplicate");
  assert.ok(t.logs.some((l) => l.startsWith("follow_up_claim_update_failed")));
});

test("live: Redis down before the claim -> 503, nothing sent", async () => {
  const t = setup();
  t.redis.state.down = true;
  const r = await call(t, live());
  assert.equal(r.status, 503);
  assert.equal(r.body.error, "redis_unavailable");
  assert.equal(t.sends.length, 0);
});

// ---------- guest-facing content ----------

test("message: only the approved template, sender and guest number; no Lead ID, score, source, Ref or notes", async () => {
  const t = setup({ WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES: "1=destination,2=checkIn" });
  const r = await call(t, live(LEAD, {
    destination: "Jaipur", checkIn: "2026-12-10", checkOut: "2026-12-13", property: "Studio 925",
    score: 95, priority: "Hot", source: "whatsapp-bot", ref: "W-PROP-STUDIO-925", notes: "internal note", handoffNumber: "+919000000009",
  }));
  assert.equal(r.body.result, "sent");
  const msg = t.sends[0].msg;
  assert.deepEqual(Object.keys(msg).sort(), ["accountSid", "authToken", "contentSid", "contentVariables", "from", "to"]);
  assert.equal(msg.to, PHONE);
  assert.equal(msg.from, BOT_NUMBER);
  assert.equal(msg.contentSid, CONTENT_SID);
  assert.deepEqual(msg.contentVariables, { 1: "Jaipur", 2: "10 Dec 2026" });
  const guestVisible = JSON.stringify(msg.contentVariables) + msg.contentSid;
  for (const leak of [LEAD, "95", "Hot", "whatsapp-bot", "W-PROP", "internal note", "+919000000009", "Studio 925", "2026-12-13"]) {
    assert.ok(!guestVisible.includes(leak), "leaked: " + leak);
  }
});

test("message: without a variable mapping the template is sent with no variables at all", async () => {
  const t = setup();
  await call(t, live(LEAD, { destination: "Jaipur", score: 95 }));
  assert.deepEqual(t.sends[0].msg.contentVariables, {});
});

test("message: a missing or unsafe mapped field is 400 (field name only), before any claim or send", async () => {
  const cases = [
    [{}, "destination"],
    [{ destination: "" }, "destination"],
    [{ destination: "Call +919000000001 now" }, "destination"],
    [{ destination: "https://evil.example" }, "destination"],
    [{ destination: "x".repeat(61) }, "destination"],
    [{ destination: "a@b.c" }, "destination"],
    [{ destination: "Jaipur", checkIn: "2026-02-30" }, "checkIn"],
    [{ destination: "Jaipur", checkIn: "10/12/2026" }, "checkIn"],
  ];
  for (const [extra, field] of cases) {
    const t = setup({ WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES: "1=destination,2=checkIn" });
    const r = await call(t, live(LEAD, extra));
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.deepEqual(r.body, { ok: false, error: "bad_request", field });
    assert.equal(t.sends.length, 0);
    assert.equal(t.redisCount(), 0);
  }
});

test("buildTemplateVariables formats dates for the guest and uses only the mapping", () => {
  const r = buildTemplateVariables([["1", "checkOut"], ["2", "property"]], { checkOut: "2027-01-05", property: "Studio 711", leadId: LEAD });
  assert.deepEqual(r, { ok: true, values: { 1: "5 Jan 2027", 2: "Studio 711" } });
});

test("logs: sent and failed events carry the lead, masked number and Message SID only", async () => {
  const t = setup();
  await call(t, live());
  const line = t.logs.find((l) => l.startsWith("follow_up_sent"));
  assert.match(line, /"to":"\*\*\*0001"/);
  assert.match(line, new RegExp(MSG_SID));
  assertNoSecrets(t.logs);
});

// ---------- one automatic follow-up per guest number (final review fix) ----------

test("per-guest cooldown: a second Lead ID for the same number is duplicate (phone_recently_contacted) and never sent", async () => {
  const t = setup();
  assert.equal((await call(t, live(LEAD))).body.result, "sent");
  const r = await call(t, live(LEAD2));
  assert.equal(r.status, 200);
  assert.equal(r.body.result, "duplicate");
  assert.equal(r.body.reason, "phone_recently_contacted");
  assert.equal(t.sends.length, 1);
  // the second lead is now permanently claimed as skipped, so it is never sent later either
  assert.deepEqual(JSON.parse(t.redis.get(KEYS.followUp(LEAD2))), { state: "skipped", at: NOW.toISOString(), reason: "phone_recently_contacted" });
  assert.equal(t.redis.ttlSeconds(KEYS.followUp(LEAD2)), -1);
  // the number's cooldown is 30 days; it holds no phone in its value
  assert.equal(t.redis.ttlSeconds(KEYS.followUpPhone(PHONE)), FOLLOW_UP_PHONE_COOLDOWN_SECONDS);
  assert.ok(!t.redis.get(KEYS.followUpPhone(PHONE)).includes(PHONE));
  // a different guest is unaffected
  assert.equal((await call(t, { leadId: "L-1111111111", phone: "+919000000002", mode: "live" })).body.result, "sent");
});

test("per-guest cooldown expires after 30 days for a NEW lead; earlier leads stay blocked", async () => {
  const t = setup();
  await call(t, live(LEAD));
  t.redis.advance(FOLLOW_UP_PHONE_COOLDOWN_SECONDS * 1000 - 1000);
  assert.equal((await call(t, live(LEAD2))).body.result, "duplicate");
  t.redis.advance(2000);
  assert.equal((await call(t, live("L-2222222222"))).body.result, "sent");
  assert.equal((await call(t, live(LEAD2))).body.result, "duplicate", "a lead skipped earlier stays claimed");
  assert.equal(t.sends.length, 2);
});

test("per-guest claim is taken before Twilio is called, kept after a failed send, and not taken for an opted-out guest", async () => {
  let phoneClaimAtSend = null;
  const t = setup({}, { send: (msg, redis) => { phoneClaimAtSend = redis.get(KEYS.followUpPhone(PHONE)); return { ok: false, reason: "http_400", status: 400, systemic: false }; } });
  await call(t, live());
  assert.ok(phoneClaimAtSend, "phone claimed before send");
  assert.ok(t.redis.get(KEYS.followUpPhone(PHONE)), "kept after failure");
  assert.equal((await call(t, live(LEAD2))).body.reason, "phone_recently_contacted");

  const o = setup();
  await o.redis.client.command(["SET", KEYS.optOut(PHONE), "1"]);
  await call(o, live());
  assert.equal(o.redis.get(KEYS.followUpPhone(PHONE)), null);
  assert.equal(o.redis.get(KEYS.followUp(LEAD)), null);
});

test("template text: tabs, new lines and 4+ consecutive spaces are rejected (WhatsApp variable rules)", async () => {
  for (const destination of ["Jai\tpur", "Jai\npur", "Jai    pur"]) {
    const t = setup({ WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES: "1=destination" });
    const r = await call(t, live(LEAD, { destination }));
    assert.equal(r.status, 400, JSON.stringify(destination));
    assert.equal(t.sends.length, 0);
  }
  const ok = setup({ WHATSAPP_FOLLOW_UP_CONTENT_VARIABLES: "1=destination" });
  assert.equal((await call(ok, live(LEAD, { destination: "Jai   pur" }))).body.result, "sent");
});

// Week 6 Stretch 2, Phase A: the dry-run follow-up check endpoint (POST /api/whatsapp/follow-up).
// Proves every gate (feature switch, configuration, shared secret, body limits, field validation, live refused,
// opt-out, one claim per lead) and that the endpoint never sends anything, never writes the live claim key and
// never logs a secret or a full phone number.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const {
  createFollowUpHandler, getFollowUpConfig, secretMatches,
  FOLLOW_UP_DRY_RUN_TTL_SECONDS, FOLLOW_UP_MAX_BODY_BYTES, FOLLOW_UP_MIN_SECRET_LENGTH,
} = await import("../../lib/whatsapp-bot/follow-up.ts");
const { createStoreKeys } = await import("../../lib/whatsapp-bot/store.ts");
const route = await import("../../app/api/whatsapp/follow-up/route.ts");

const SECRET = "f".repeat(20) + "0123456789abcdef"; // 36 chars, test-only
const REDIS_URL = "https://example-redis.test";
const REDIS_TOKEN = "test-redis-token-value";
const LEAD = "L-0123456789";
const LEAD2 = "L-ABCDEF0123";
const PHONE = "+919000000001";
const NOW = new Date("2026-10-12T07:30:00Z");

const BASE_ENV = {
  WHATSAPP_FOLLOW_UP_ENABLED: "true",
  WHATSAPP_FOLLOW_UP_SECRET: SECRET,
  UPSTASH_REDIS_REST_URL: REDIS_URL,
  UPSTASH_REDIS_REST_TOKEN: REDIS_TOKEN,
  VERCEL_ENV: "production",
};

function setup(envOverrides = {}, opts = {}) {
  const redis = createFakeRedis();
  redis.state.nowMs = NOW.getTime();
  const logs = [];
  let redisCreated = 0;
  const env = Object.assign({}, BASE_ENV, envOverrides);
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  const handler = createFollowUpHandler({
    getConfig: () => getFollowUpConfig(env),
    createRedis: () => { redisCreated++; if (opts.throwOnCreate) throw new Error("boom " + SECRET); return redis.client; },
    now: () => NOW,
    log: (event, meta) => logs.push(event + (meta ? " " + JSON.stringify(meta) : "")),
  });
  return { handler, redis, logs, env, redisCount: () => redisCreated };
}

function req(body, { auth = "Bearer " + SECRET, contentType = "application/json", raw, headers = {} } = {}) {
  const h = Object.assign({}, headers);
  if (auth !== null) h.Authorization = auth;
  if (contentType !== null) h["Content-Type"] = contentType;
  return new Request("https://example.test/api/whatsapp/follow-up", {
    method: "POST", headers: h, body: raw !== undefined ? raw : JSON.stringify(body),
  });
}

const dry = (leadId = LEAD, phone = PHONE) => ({ leadId, phone, mode: "dry_run" });

async function call(t, body, opts) {
  const res = await t.handler(req(body, opts));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}

function assertNoSecrets(logs) {
  const all = logs.join("\n");
  assert.ok(!all.includes(SECRET), "secret must not be logged");
  assert.ok(!all.includes(REDIS_TOKEN), "redis token must not be logged");
  assert.ok(!all.includes(REDIS_URL), "redis url must not be logged");
  assert.ok(!all.includes(PHONE), "full phone must not be logged");
}

// ---------- configuration ----------

test("config: disabled unless WHATSAPP_FOLLOW_UP_ENABLED is exactly true", () => {
  for (const v of [undefined, "", "false", "1", "yes", "TRUE "]) {
    const env = Object.assign({}, BASE_ENV, { WHATSAPP_FOLLOW_UP_ENABLED: v });
    if (v === undefined) delete env.WHATSAPP_FOLLOW_UP_ENABLED;
    const r = getFollowUpConfig(env);
    // "TRUE " trims to TRUE, which is accepted (case-insensitive) like the bot's own switch
    assert.equal(r.status, v === "TRUE " ? "ready" : "disabled", String(v));
  }
});

test("config: missing/short secret, http Redis URL and missing token are reported by name only", () => {
  const r1 = getFollowUpConfig(Object.assign({}, BASE_ENV, { WHATSAPP_FOLLOW_UP_SECRET: "" }));
  assert.equal(r1.status, "invalid");
  assert.match(r1.problems.join(), /WHATSAPP_FOLLOW_UP_SECRET is not set/);
  const short = "s".repeat(FOLLOW_UP_MIN_SECRET_LENGTH - 1);
  const r2 = getFollowUpConfig(Object.assign({}, BASE_ENV, { WHATSAPP_FOLLOW_UP_SECRET: short }));
  assert.equal(r2.status, "invalid");
  assert.ok(!r2.problems.join().includes(short));
  const r3 = getFollowUpConfig(Object.assign({}, BASE_ENV, { UPSTASH_REDIS_REST_URL: "http://plain.test", UPSTASH_REDIS_REST_TOKEN: "" }));
  assert.equal(r3.status, "invalid");
  assert.equal(r3.problems.length, 2);
  assert.ok(!r3.problems.join().includes("plain.test"));
});

test("config: namespace follows VERCEL_ENV and botEnabled reflects WHATSAPP_BOT_ENABLED", () => {
  assert.equal(getFollowUpConfig(BASE_ENV).config.redisNamespace, "production");
  assert.equal(getFollowUpConfig(Object.assign({}, BASE_ENV, { VERCEL_ENV: "preview" })).config.redisNamespace, "preview");
  assert.equal(getFollowUpConfig(Object.assign({}, BASE_ENV, { VERCEL_ENV: undefined })).config.redisNamespace, "development");
  assert.equal(getFollowUpConfig(BASE_ENV).config.botEnabled, false);
  assert.equal(getFollowUpConfig(Object.assign({}, BASE_ENV, { WHATSAPP_BOT_ENABLED: "true" })).config.botEnabled, true);
});

test("secretMatches: exact match only", () => {
  assert.equal(secretMatches(SECRET, SECRET), true);
  assert.equal(secretMatches(SECRET + "x", SECRET), false);
  assert.equal(secretMatches(SECRET.slice(0, -1), SECRET), false);
  assert.equal(secretMatches("", SECRET), false);
});

// ---------- gates ----------

test("disabled: 404 and Redis is never touched", async () => {
  const t = setup({ WHATSAPP_FOLLOW_UP_ENABLED: "false" });
  const r = await call(t, dry());
  assert.equal(r.status, 404);
  assert.deepEqual(r.body, { ok: false, error: "disabled" });
  assert.equal(t.redisCount(), 0);
});

test("misconfigured: 503, logs variable names only, Redis untouched", async () => {
  const t = setup({ WHATSAPP_FOLLOW_UP_SECRET: "too-short" });
  const r = await call(t, dry());
  assert.equal(r.status, 503);
  assert.equal(r.body.error, "misconfigured");
  assert.equal(t.redisCount(), 0);
  assert.match(t.logs[0], /follow_up_config_invalid/);
  assert.ok(!t.logs.join().includes("too-short"));
});

test("auth: missing, wrong, non-Bearer and near-miss secrets are 401 before the body is read", async () => {
  for (const auth of [null, "", "Bearer", "Bearer wrong", "Basic " + SECRET, "Bearer " + SECRET + "x", "Bearer " + SECRET.slice(1)]) {
    const t = setup();
    const r = await call(t, dry(), { auth });
    assert.equal(r.status, 401, String(auth));
    assert.equal(r.body.error, "unauthorized");
    assert.equal(t.redisCount(), 0);
    assertNoSecrets(t.logs);
  }
});

test("auth: Bearer scheme is case-insensitive", async () => {
  const t = setup();
  const r = await call(t, dry(), { auth: "bearer " + SECRET });
  assert.equal(r.status, 200);
});

test("body: non-JSON content type is 415", async () => {
  const t = setup();
  const r = await call(t, dry(), { contentType: "text/plain" });
  assert.equal(r.status, 415);
  assert.equal(t.redisCount(), 0);
});

test("body: over the size limit is 413 (by header and by actual size)", async () => {
  const big = { leadId: LEAD, phone: PHONE, mode: "dry_run", pad: "x".repeat(FOLLOW_UP_MAX_BODY_BYTES) };
  const t = setup();
  assert.equal((await call(t, big)).status, 413);
  assert.equal((await call(t, dry(), { headers: { "Content-Length": String(FOLLOW_UP_MAX_BODY_BYTES + 1) } })).status, 413);
  assert.equal(t.redisCount(), 0);
});

test("body: invalid JSON is 400 bad_json; arrays and null are 400 bad_request", async () => {
  const t = setup();
  const r1 = await call(t, null, { raw: "{not json" });
  assert.equal(r1.status, 400);
  assert.equal(r1.body.error, "bad_json");
  const r2 = await call(t, [1, 2]);
  assert.equal(r2.status, 400);
  assert.equal(r2.body.field, "body");
  const r3 = await call(t, null, { raw: "null" });
  assert.equal(r3.status, 400);
  assert.equal(t.redisCount(), 0);
});

test("fields: invalid leadId, phone or mode is 400 naming the field (never its value)", async () => {
  const cases = [
    [{ leadId: "H-0123456789", phone: PHONE, mode: "dry_run" }, "leadId"],
    [{ leadId: "L-01234567", phone: PHONE, mode: "dry_run" }, "leadId"],
    [{ leadId: "l-0123456789", phone: PHONE, mode: "dry_run" }, "leadId"],
    [{ leadId: "L-abcdef0123", phone: PHONE, mode: "dry_run" }, "leadId"],
    [{ phone: PHONE, mode: "dry_run" }, "leadId"],
    [{ leadId: LEAD, phone: "9000000001", mode: "dry_run" }, "phone"],
    [{ leadId: LEAD, phone: "+91 9000000001", mode: "dry_run" }, "phone"],
    [{ leadId: LEAD, phone: 919000000001, mode: "dry_run" }, "phone"],
    [{ leadId: LEAD, phone: PHONE }, "mode"],
    [{ leadId: LEAD, phone: PHONE, mode: "DRY_RUN" }, "mode"],
    [{ leadId: LEAD, phone: PHONE, mode: "send" }, "mode"],
  ];
  for (const [body, field] of cases) {
    const t = setup();
    const r = await call(t, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.deepEqual(r.body, { ok: false, error: "bad_request", field });
    assert.equal(t.redisCount(), 0);
  }
});

test("live mode is refused with 409 and nothing is written (live switch not set)", async () => {
  const t = setup({ WHATSAPP_BOT_ENABLED: "true" });
  const r = await call(t, { leadId: LEAD, phone: PHONE, mode: "live" });
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { ok: false, error: "live_not_available", reason: "live_flag_off" });
  assert.equal(t.redisCount(), 0);
  assert.deepEqual(t.redis.keys(), []);
});

// ---------- dry-run behaviour ----------

test("dry run: first check is would_send, writes only the namespaced dry-run key with a 24 h TTL", async () => {
  const t = setup();
  const r = await call(t, dry());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, mode: "dry_run", leadId: LEAD, result: "would_send", liveReady: false, botEnabled: false });
  assert.equal(r.headers.get("cache-control"), "no-store");
  const keys = createStoreKeys("production");
  assert.deepEqual(t.redis.keys(), [keys.followUpDryRun(LEAD)]);
  assert.equal(keys.followUpDryRun(LEAD), "production:wa:fu-dry:" + LEAD);
  assert.equal(t.redis.ttlSeconds(keys.followUpDryRun(LEAD)), FOLLOW_UP_DRY_RUN_TTL_SECONDS);
  assert.equal(t.redis.get(keys.followUp(LEAD)), null, "live claim key must never be written");
  const stored = JSON.parse(t.redis.get(keys.followUpDryRun(LEAD)));
  assert.deepEqual(stored, { at: NOW.toISOString(), mode: "dry_run" });
  assert.ok(!t.redis.get(keys.followUpDryRun(LEAD)).includes(PHONE), "claim value holds no phone number");
});

test("dry run: second check for the same lead is duplicate; a different lead is independent", async () => {
  const t = setup();
  assert.equal((await call(t, dry())).body.result, "would_send");
  assert.equal((await call(t, dry())).body.result, "duplicate");
  assert.equal((await call(t, dry(LEAD, "+919000000002"))).body.result, "duplicate", "claim is per lead, not per phone");
  assert.equal((await call(t, dry(LEAD2))).body.result, "would_send");
});

test("dry run: the claim expires after 24 hours, so a dry run never blocks a lead permanently", async () => {
  const t = setup();
  assert.equal((await call(t, dry())).body.result, "would_send");
  t.redis.advance(FOLLOW_UP_DRY_RUN_TTL_SECONDS * 1000 - 1000);
  assert.equal((await call(t, dry())).body.result, "duplicate");
  t.redis.advance(2000);
  assert.equal((await call(t, dry())).body.result, "would_send");
});

test("dry run: an existing live claim key does not affect the dry-run result (separate keys)", async () => {
  const t = setup();
  await t.redis.client.command(["SET", createStoreKeys("production").followUp(LEAD), "x"]);
  assert.equal((await call(t, dry())).body.result, "would_send");
});

test("opt-out: an opted-out guest is reported and never claimed", async () => {
  const t = setup();
  const keys = createStoreKeys("production");
  await t.redis.client.command(["SET", keys.optOut(PHONE), "1"]);
  const r = await call(t, dry());
  assert.equal(r.status, 200);
  assert.equal(r.body.result, "opted_out");
  assert.equal(t.redis.get(keys.followUpDryRun(LEAD)), null);
  // after START (opt-out cleared) the same lead becomes would_send: the opt-out check never consumed the claim
  await t.redis.client.command(["DEL", keys.optOut(PHONE)]);
  assert.equal((await call(t, dry())).body.result, "would_send");
});

test("opt-out is read from the same namespace only (preview opt-out does not leak into production)", async () => {
  const t = setup();
  await t.redis.client.command(["SET", createStoreKeys("preview").optOut(PHONE), "1"]);
  assert.equal((await call(t, dry())).body.result, "would_send");
  const p = setup({ VERCEL_ENV: "preview" });
  await p.redis.client.command(["SET", createStoreKeys("preview").optOut(PHONE), "1"]);
  assert.equal((await call(p, dry())).body.result, "opted_out");
});

test("works while the inbound bot is disabled, and reports botEnabled", async () => {
  const off = setup({ WHATSAPP_BOT_ENABLED: undefined });
  assert.equal((await call(off, dry())).body.botEnabled, false);
  const on = setup({ WHATSAPP_BOT_ENABLED: "true" });
  const r = await call(on, dry());
  assert.equal(r.body.botEnabled, true);
  assert.equal(r.body.liveReady, false);
});

test("Redis down: 503 redis_unavailable, nothing claimed, no secrets logged", async () => {
  const t = setup();
  t.redis.state.down = true;
  const r = await call(t, dry());
  assert.equal(r.status, 503);
  assert.equal(r.body.error, "redis_unavailable");
  t.redis.state.down = false;
  assert.deepEqual(t.redis.keys(), []);
  assert.match(t.logs.join(), /follow_up_redis_unavailable/);
  assertNoSecrets(t.logs);
});

test("unexpected error: 503 internal_error without the error message in the log", async () => {
  const t = setup({}, { throwOnCreate: true });
  const r = await call(t, dry());
  assert.equal(r.status, 503);
  assert.equal(r.body.error, "internal_error");
  assertNoSecrets(t.logs);
  assert.ok(!t.logs.join().includes("boom"));
});

test("logs: the checked event has the lead, the masked phone and the result; no secrets or full numbers", async () => {
  const t = setup();
  await call(t, dry());
  const line = t.logs.find((l) => l.startsWith("follow_up_checked"));
  assert.ok(line);
  assert.match(line, /"lead":"L-0123456789"/);
  assert.match(line, /"to":"\*\*\*0001"/);
  assert.match(line, /"result":"would_send"/);
  assertNoSecrets(t.logs);
});

test("no outbound network: the handler never calls fetch (no Twilio, no other service)", async () => {
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = async () => { fetched++; throw new Error("fetch not allowed"); };
  try {
    const t = setup({ WHATSAPP_BOT_ENABLED: "true" });
    await call(t, dry());
    await call(t, dry());
    await call(t, { leadId: LEAD2, phone: PHONE, mode: "live" });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(fetched, 0);
});

test("source: no NEXT_PUBLIC_ variables; the only Twilio call is the template sender (no free-form Body)", () => {
  const strip = (src) => src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const followUp = strip(readFileSync(new URL("../../lib/whatsapp-bot/follow-up.ts", import.meta.url), "utf8")
    + readFileSync(new URL("../../app/api/whatsapp/follow-up/route.ts", import.meta.url), "utf8"));
  assert.doesNotMatch(followUp, /NEXT_PUBLIC_|api\.twilio\.com|Messages\.json|fetch\(/, "follow-up module never calls Twilio directly");
  const sender = strip(readFileSync(new URL("../../lib/twilio/send.ts", import.meta.url), "utf8"));
  assert.doesNotMatch(sender, /"Body"|NEXT_PUBLIC_|process\.env/, "template-only sender, credentials passed in by the caller");
});

test("route: GET is 405 with Allow: POST; POST is OFF (404) without the env switch", async () => {
  const g = await route.GET();
  assert.equal(g.status, 405);
  assert.equal(g.headers.get("allow"), "POST");
  const saved = process.env.WHATSAPP_FOLLOW_UP_ENABLED;
  delete process.env.WHATSAPP_FOLLOW_UP_ENABLED;
  try {
    const p = await route.POST(req(dry()));
    assert.equal(p.status, 404);
  } finally {
    if (saved !== undefined) process.env.WHATSAPP_FOLLOW_UP_ENABLED = saved;
  }
  assert.equal(route.dynamic, "force-dynamic");
});

test("store keys: follow-up keys validate the Lead ID", () => {
  const keys = createStoreKeys("development");
  assert.equal(keys.followUp(LEAD), "development:wa:fu:" + LEAD);
  assert.throws(() => keys.followUpDryRun("L-012345678g"));
  assert.throws(() => keys.followUp("H-0123456789"));
  assert.throws(() => keys.followUp(LEAD + ":x"));
});

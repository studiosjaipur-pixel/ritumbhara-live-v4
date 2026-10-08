// Redis environment isolation: Preview and Production share one Upstash database, so every bot key is prefixed
// with the deployment environment taken from VERCEL_ENV. These tests prove every key type is namespaced and that
// Preview and Production can never read or change each other's state.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeRedis } from "../helpers/fake-redis.mjs";

const { getBotConfig, redisNamespaceFor, REDIS_NAMESPACES } = await import("../../lib/whatsapp-bot/config.ts");
const { createConversationStore, createStoreKeys, createUpstashConversationStore, storeKeys, STORE_TTL } = await import("../../lib/whatsapp-bot/store.ts");
const { createConversationHandler } = await import("../../lib/whatsapp-bot/conversation.ts");

const PHONE = "+919000000001";
const SID = "SM" + "1".repeat(32);
const NOW = Date.parse("2026-10-08T10:00:00Z");

// A RedisClient wrapper that records the key of every command (including the EVAL lock-release key and pipelines).
function recordingClient(inner) {
  const keys = [];
  const keyOf = (args) => (String(args[0]).toUpperCase() === "EVAL" ? args[3] : args[1]);
  return {
    keys,
    client: {
      async command(args) { keys.push(String(keyOf(args))); return inner.command(args); },
      async pipeline(commands) { for (const c of commands) keys.push(String(keyOf(c))); return inner.pipeline(commands); },
    },
  };
}

// Calls every store operation once, covering every key type and every rate-limit scope the bot uses.
async function exerciseEveryOperation(store) {
  const state = { version: 1, sender: PHONE, state: "ASK_DATES", fields: {}, attempts: {}, botTurns: 1 };
  await store.saveConversation(state, STORE_TTL.conversation);
  await store.getConversation(PHONE);
  await store.deleteConversation(PHONE);
  await store.claimMessage(SID);
  await store.markMessageProcessed(SID);
  await store.releaseMessageClaim(SID);
  const token = await store.acquireSenderLock(PHONE, STORE_TTL.senderLockMs);
  await store.releaseSenderLock(PHONE, token);
  await store.setOptedOut(PHONE, true);
  await store.isOptedOut(PHONE);
  await store.setOptedOut(PHONE, false);
  await store.incrementRateLimit("sender:" + PHONE, 600, NOW); // per-sender message limit
  await store.incrementRateLimit("ai:" + PHONE, 3600, NOW); // per-sender AI limit
  await store.incrementRateLimit("ai:global", 86400, NOW); // global AI limit
}

// ---------- namespace from VERCEL_ENV ----------

test("VERCEL_ENV maps to the namespace; anything unknown is development, never production", () => {
  assert.equal(redisNamespaceFor({ VERCEL_ENV: "production" }), "production");
  assert.equal(redisNamespaceFor({ VERCEL_ENV: "preview" }), "preview");
  assert.equal(redisNamespaceFor({ VERCEL_ENV: "development" }), "development");
  assert.equal(redisNamespaceFor({ VERCEL_ENV: " Production " }), "production");
  for (const env of [{}, { VERCEL_ENV: "" }, { VERCEL_ENV: "staging" }, { VERCEL_ENV: "prod" }]) {
    assert.equal(redisNamespaceFor(env), "development", JSON.stringify(env));
  }
  assert.deepEqual([...REDIS_NAMESPACES], ["production", "preview", "development"]);
});

test("getBotConfig carries the namespace from VERCEL_ENV into the bot config", () => {
  const base = {
    WHATSAPP_BOT_ENABLED: "true", TWILIO_AUTH_TOKEN: "fake_token_for_tests", TWILIO_WEBHOOK_URL: "https://os.example.com/api/whatsapp/webhook",
    WHATSAPP_BOT_TO: "+918306312778", WHATSAPP_HANDOFF_NUMBER: "+919000000009",
    UPSTASH_REDIS_REST_URL: "https://fake-redis.example.com", UPSTASH_REDIS_REST_TOKEN: "fake_redis_token",
  };
  for (const [vercelEnv, ns] of [["production", "production"], ["preview", "preview"], ["development", "development"], [undefined, "development"]]) {
    const r = getBotConfig({ ...base, ...(vercelEnv ? { VERCEL_ENV: vercelEnv } : {}) });
    assert.equal(r.status, "ready");
    assert.equal(r.config.redisNamespace, ns);
  }
});

// ---------- every key type is namespaced ----------

test("every Redis key type (conversation, opt-out, dedup, lock, sender/AI/global rate limits) carries the namespace", async () => {
  for (const ns of ["production", "preview", "development"]) {
    const fake = createFakeRedis();
    const rec = recordingClient(fake.client);
    await exerciseEveryOperation(createConversationStore(rec.client, ns));
    assert.equal(rec.keys.length, 17, "11 single commands + 3 rate limits x 2 pipelined commands");
    for (const key of rec.keys) assert.ok(key.startsWith(ns + ":wa:"), ns + ": unprefixed key " + key);
    const kinds = new Set(rec.keys.map((k) => k.split(":")[2]));
    assert.deepEqual([...kinds].sort(), ["conv", "lock", "msg", "optout", "rl"]);
    const scopes = rec.keys.filter((k) => k.split(":")[2] === "rl").map((k) => k.split(":").slice(3, -1).join(":"));
    assert.deepEqual([...new Set(scopes)].sort(), ["ai:+919000000001", "ai:global", "sender:+919000000001"]);
    for (const key of fake.keys()) assert.ok(key.startsWith(ns + ":wa:"), "stored key " + key);
  }
});

test("Preview and Production key sets never overlap, and differ only by the prefix", async () => {
  const sets = {};
  for (const ns of ["preview", "production"]) {
    const rec = recordingClient(createFakeRedis().client);
    await exerciseEveryOperation(createConversationStore(rec.client, ns));
    sets[ns] = new Set(rec.keys);
  }
  for (const k of sets.preview) assert.ok(!sets.production.has(k), "collision: " + k);
  const strip = (s, ns) => [...s].map((k) => k.slice(ns.length + 1)).sort();
  assert.deepEqual(strip(sets.preview, "preview"), strip(sets.production, "production"));
  // and every builder output for the same input differs between the two
  const p = createStoreKeys("preview"), q = createStoreKeys("production");
  for (const [name, arg] of [["conversation", PHONE], ["optOut", PHONE], ["message", SID], ["senderLock", PHONE]]) {
    assert.notEqual(p[name](arg), q[name](arg));
    assert.equal(p[name](arg), "preview:" + storeKeys[name](arg));
    assert.equal(q[name](arg), "production:" + storeKeys[name](arg));
  }
  assert.equal(q.rateLimit("ai:global", 0), "production:wa:rl:ai:global:0");
});

// ---------- behavior in ONE shared database ----------

test("one shared database: Preview and Production state is completely independent", async () => {
  const fake = createFakeRedis();
  const preview = createConversationStore(fake.client, "preview");
  const production = createConversationStore(fake.client, "production");

  // conversation
  await preview.saveConversation({ version: 1, sender: PHONE, state: "HANDED_OFF", fields: {}, attempts: {}, botTurns: 5 }, STORE_TTL.conversationAfterHandoff);
  assert.equal(await production.getConversation(PHONE), null, "a Sandbox handoff must not silence Production");
  assert.equal((await preview.getConversation(PHONE)).state, "HANDED_OFF");
  await production.deleteConversation(PHONE); // RESTART in Production
  assert.equal((await preview.getConversation(PHONE)).state, "HANDED_OFF", "Production delete does not touch Preview");

  // opt-out
  await preview.setOptedOut(PHONE, true); // STOP during Sandbox testing
  assert.equal(await production.isOptedOut(PHONE), false, "Sandbox STOP must not opt the number out of Production");
  await production.setOptedOut(PHONE, true);
  await production.setOptedOut(PHONE, false); // START in Production
  assert.equal(await preview.isOptedOut(PHONE), true);

  // message de-duplication
  assert.equal(await preview.claimMessage(SID), "claimed");
  assert.equal(await production.claimMessage(SID), "claimed", "same MessageSid is independent per environment");
  assert.equal(await production.claimMessage(SID), "duplicate");

  // locks
  const tPrev = await preview.acquireSenderLock(PHONE, 15000);
  assert.ok(tPrev);
  const tProd = await production.acquireSenderLock(PHONE, 15000);
  assert.ok(tProd, "a Preview lock does not block Production");
  await production.releaseSenderLock(PHONE, tPrev); // wrong environment's token: no effect on either
  assert.equal(await preview.acquireSenderLock(PHONE, 15000), null, "Preview lock still held");

  // rate limits, including the global AI cap
  for (let i = 0; i < 7; i++) await preview.incrementRateLimit("ai:global", 86400, NOW);
  assert.equal(await production.incrementRateLimit("ai:global", 86400, NOW), 1, "Preview AI usage does not count against Production");
  assert.equal(await production.incrementRateLimit("sender:" + PHONE, 600, NOW), 1);
  assert.equal(await preview.incrementRateLimit("sender:" + PHONE, 600, NOW), 1);

  // nothing was ever written without a prefix
  for (const key of fake.keys()) assert.ok(/^(preview|production):wa:/.test(key), "unprefixed key " + key);
});

// ---------- the real store can never run without a namespace ----------

test("createUpstashConversationStore refuses a missing or invalid namespace (fails closed)", () => {
  for (const bad of [undefined, null, "", "prod", "staging", "Production", "production:"]) {
    assert.throws(() => createUpstashConversationStore("https://fake-redis.example.com", "fake_token", bad), /Invalid Redis namespace/, String(bad));
  }
  for (const ok of REDIS_NAMESPACES) assert.doesNotThrow(() => createUpstashConversationStore("https://fake-redis.example.com", "fake_token", ok));
  assert.throws(() => createStoreKeys("staging"), /Invalid Redis namespace/);
});

test("default in-memory test layout is unchanged (existing tests keep working)", () => {
  assert.equal(storeKeys.conversation(PHONE), "wa:conv:" + PHONE);
  assert.equal(storeKeys.rateLimit("ai:global", 0), "wa:rl:ai:global:0");
});

// ---------- end to end through the real default wiring (env -> config -> Upstash REST client) ----------

test("end to end: the default handler writes only '<VERCEL_ENV>:wa:' keys over the Upstash REST API", async () => {
  const fake = createFakeRedis(); // one shared database
  const realFetch = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (url, init) => {
    const u = new URL(String(url));
    assert.equal(u.host, "fake-redis.example.com"); // only the Redis REST API is called on this path
    paths.push(u.pathname);
    const body = JSON.parse(init.body);
    const reply = u.pathname.endsWith("/pipeline")
      ? (await fake.client.pipeline(body)).map((result) => ({ result }))
      : { result: await fake.client.command(body) };
    return new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    for (const [vercelEnv, sid] of [["production", "SM" + "a".repeat(32)], ["preview", "SM" + "b".repeat(32)]]) {
      const r = getBotConfig({
        VERCEL_ENV: vercelEnv, WHATSAPP_BOT_ENABLED: "true", TWILIO_AUTH_TOKEN: "fake_token_for_tests",
        TWILIO_WEBHOOK_URL: "https://os.example.com/api/whatsapp/webhook", WHATSAPP_BOT_TO: "+918306312778",
        WHATSAPP_HANDOFF_NUMBER: "+919000000009", UPSTASH_REDIS_REST_URL: "https://fake-redis.example.com",
        UPSTASH_REDIS_REST_TOKEN: "fake_redis_token",
      });
      assert.equal(r.status, "ready");
      const handler = createConversationHandler({ now: () => new Date(NOW), log: () => {} }); // default (real) store
      const res = await handler({
        messageSid: sid, accountSid: "AC" + "ab".repeat(16), from: PHONE, to: "+918306312778", body: "Hi, I want to check availability.",
        numMedia: 0, profileName: "Test", waId: PHONE.slice(1), bodyStatus: "ok",
      }, r.config);
      assert.ok(res.reply && res.reply.length > 0, vercelEnv + " bot replied");
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  const keys = fake.keys();
  assert.ok(keys.some((k) => k === "production:wa:conv:" + PHONE));
  assert.ok(keys.some((k) => k === "preview:wa:conv:" + PHONE));
  for (const key of keys) assert.ok(/^(preview|production):wa:/.test(key), "unprefixed key " + key);
  assert.ok(paths.length > 0);
});

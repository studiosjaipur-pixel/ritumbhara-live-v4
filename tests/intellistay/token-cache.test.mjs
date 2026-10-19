// Intellistay access-token cache in Redis (lib/intellistay/token-store.ts + the tokenStore option of client.ts),
// used by /api/guest-messages/ask so a new serverless instance skips the ~6 s Intellistay login.
// Redis and Intellistay are fakes: no network. Proves: cache hit (no login), cache miss (login once, token cached
// for 50 min), 401 (cached token dropped, re-login, new token cached, one retry), Redis down (normal login, request
// still succeeds), token only in the cache (no booking data), and no token in any log line.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakeRedis } from "../helpers/fake-redis.mjs";
import { CONFIG, FAKE_PASSWORD, FAKE_TOKEN, GUEST_E164, LOGIN_OK, bookingsResponse, intellistayFetch, rawBooking } from "../helpers/intellistay-fixtures.mjs";

const { createIntellistayClient, TOKEN_TTL_MS } = await import("../../lib/intellistay/client.ts");
const {
  createRedisTokenStore, createUpstashCommandClient, intellistayTokenKey, tokenCacheNamespace, TokenCacheUnavailableError, TOKEN_CACHE_TIMEOUT_MS,
} = await import("../../lib/intellistay/token-store.ts");
const { askTokenStore } = await import("../../lib/guest-messages/assistant.ts");

const KEY = intellistayTokenKey("production", CONFIG);
const NEW_TOKEN = "fresh.jwt.token.value.9876543210fedcbaSECRET";

function setup({ bookings, login = LOGIN_OK } = {}) {
  const redis = createFakeRedis();
  const calls = [];
  const logs = [];
  const nowMs = () => redis.state.nowMs;
  const store = createRedisTokenStore(redis.client, KEY, nowMs);
  const newClient = () => createIntellistayClient({
    config: CONFIG, nowMs, tokenStore: store,
    log: (e, m) => logs.push(e + " " + JSON.stringify(m || {})),
    fetchImpl: intellistayFetch({ login, bookings: bookings || { status: 200, body: bookingsResponse([rawBooking()]) } }, calls),
  });
  const logins = () => calls.filter((c) => c.path === "/api/Login/Login").length;
  const bearers = () => calls.filter((c) => c.path !== "/api/Login/Login").map((c) => c.init.headers.Authorization);
  return { redis, calls, logs, store, newClient, logins, bearers };
}

function assertNoTokenInLogs(logs) {
  for (const l of logs) {
    for (const s of [FAKE_TOKEN, NEW_TOKEN, FAKE_PASSWORD]) assert.ok(!l.includes(s), "log must not contain a token or password: " + l);
  }
}

test("cache miss: logs in once, caches only the token for 50 minutes, and a new instance then skips the login", async () => {
  const x = setup();
  const r = await x.newClient().fetchNormalizedBookings();
  assert.equal(r.bookings.length, 1);
  assert.equal(x.logins(), 1);
  assert.ok(x.logs.some((l) => l.startsWith("token_cache_miss")));
  // Only the token (and its expiry) is in Redis: one key, no booking or guest data.
  assert.deepEqual(x.redis.keys(), [KEY]);
  const stored = JSON.parse(x.redis.get(KEY));
  assert.deepEqual(Object.keys(stored).sort(), ["e", "t"]);
  assert.equal(stored.t, FAKE_TOKEN);
  assert.equal(stored.e, x.redis.state.nowMs + TOKEN_TTL_MS);
  assert.equal(x.redis.ttlSeconds(KEY), TOKEN_TTL_MS / 1000, "expires in Redis after the same 50 minutes");
  assert.ok(!x.redis.get(KEY).includes(GUEST_E164));

  // A brand-new client (a new serverless instance) finds the cached token: no second login.
  await x.newClient().fetchNormalizedBookings();
  assert.equal(x.logins(), 1);
  assertNoTokenInLogs(x.logs);
});

test("cache hit: a valid cached token is used straight away, no login", async () => {
  const x = setup();
  await x.store.set(FAKE_TOKEN, x.redis.state.nowMs + 10 * 60 * 1000);
  await x.newClient().fetchNormalizedBookings();
  assert.equal(x.logins(), 0);
  assert.deepEqual(x.bearers(), ["Bearer " + FAKE_TOKEN]);
  assert.ok(x.logs.some((l) => l.startsWith("token_cache_hit")));
  assertNoTokenInLogs(x.logs);
});

test("cache expiry: after 50 minutes the cached token is gone and the client logs in again", async () => {
  const x = setup();
  await x.newClient().fetchNormalizedBookings();
  x.redis.advance(TOKEN_TTL_MS + 1000);
  await x.newClient().fetchNormalizedBookings();
  assert.equal(x.logins(), 2);
});

test("401 on a cached token: cache cleared, re-login, new token cached, request retried once", async () => {
  let attempts = 0;
  const x = setup({
    login: { status: 200, body: { accessToken: NEW_TOKEN } },
    bookings: (_body, _calls, init) => {
      attempts++;
      return init.headers.Authorization === "Bearer " + NEW_TOKEN
        ? { status: 200, body: bookingsResponse([rawBooking()]) }
        : { status: 401, body: {} };
    },
  });
  await x.store.set(FAKE_TOKEN, x.redis.state.nowMs + 10 * 60 * 1000); // revoked on the Intellistay side
  const r = await x.newClient().fetchNormalizedBookings();
  assert.equal(r.bookings.length, 1);
  assert.equal(attempts, 2, "one failed call, one retry");
  assert.equal(x.logins(), 1);
  assert.deepEqual(x.bearers(), ["Bearer " + FAKE_TOKEN, "Bearer " + NEW_TOKEN]);
  assert.equal(JSON.parse(x.redis.get(KEY)).t, NEW_TOKEN, "the new token replaced the rejected one");
  assert.ok(x.logs.some((l) => l.startsWith("token_rejected_relogin")));
  assertNoTokenInLogs(x.logs);
});

test("401 again after the re-login: auth_failed, no endless retries", async () => {
  const x = setup({ bookings: { status: 401, body: {} } });
  await x.store.set(FAKE_TOKEN, x.redis.state.nowMs + 10 * 60 * 1000);
  await assert.rejects(x.newClient().fetchNormalizedBookings(), (e) => e.reason === "auth_failed");
  assert.equal(x.logins(), 1);
});

test("Redis unavailable: logs in normally and the request still succeeds", async () => {
  const x = setup();
  x.redis.state.down = true;
  const r = await x.newClient().fetchNormalizedBookings();
  assert.equal(r.bookings.length, 1);
  assert.equal(x.logins(), 1);
  assert.ok(x.logs.some((l) => l.startsWith("token_cache_unavailable") && l.includes('"op":"get"')));
  assert.ok(x.logs.some((l) => l.startsWith("token_cache_unavailable") && l.includes('"op":"set"')));
  // Redis down during a 401 refresh is also survivable.
  let first = true;
  const y = setup({
    login: { status: 200, body: { accessToken: NEW_TOKEN } },
    bookings: () => (first ? ((first = false), { status: 401, body: {} }) : { status: 200, body: bookingsResponse([rawBooking()]) }),
  });
  await y.store.set(FAKE_TOKEN, y.redis.state.nowMs + 10 * 60 * 1000);
  y.redis.state.down = true;
  // The cached token cannot be read while Redis is down: plain login, then the 401 path clears (fails, logged) and re-logs in.
  assert.equal((await y.newClient().fetchNormalizedBookings()).bookings.length, 1);
  assertNoTokenInLogs(x.logs.concat(y.logs));
});

test("a corrupt or expired cache value is a miss, never used", async () => {
  const x = setup();
  await x.redis.client.command(["SET", KEY, "not-json"]);
  await x.newClient().fetchNormalizedBookings();
  assert.equal(x.logins(), 1);
  const y = setup();
  await y.redis.client.command(["SET", KEY, JSON.stringify({ t: FAKE_TOKEN, e: y.redis.state.nowMs - 1 })]);
  await y.newClient().fetchNormalizedBookings();
  assert.equal(y.logins(), 1);
});

test("without a tokenStore the client behaves exactly as before (memory only, no Redis)", async () => {
  const calls = [];
  const c = createIntellistayClient({ config: CONFIG, log: () => {}, fetchImpl: intellistayFetch({ login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse([rawBooking()]) } }, calls) });
  await c.fetchNormalizedBookings();
  await c.fetchNormalizedBookings();
  assert.equal(calls.filter((x) => x.path === "/api/Login/Login").length, 1);
});

test("Upstash REST call: sends the command with the bearer token; HTTP errors, Redis errors and timeouts become cache-unavailable", async () => {
  const sent = [];
  const ok = createUpstashCommandClient({
    url: "https://example.upstash.io/", token: "upstash-token",
    fetchImpl: async (url, init) => { sent.push({ url, init }); return new Response(JSON.stringify({ result: "v" }), { status: 200 }); },
  });
  assert.equal(await ok.command(["GET", "k"]), "v");
  assert.equal(sent[0].url, "https://example.upstash.io");
  assert.equal(sent[0].init.headers.Authorization, "Bearer upstash-token");
  assert.deepEqual(JSON.parse(sent[0].init.body), ["GET", "k"]);
  const fails = [
    ["http", async () => new Response("no", { status: 500 }), "http_500"],
    ["redis error", async () => new Response(JSON.stringify({ error: "WRONGTYPE" }), { status: 200 }), "command_error"],
    ["network", async () => { throw new Error("ECONNRESET"); }, "network"],
    ["timeout", (_u, init) => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))), "timeout"],
  ];
  for (const [label, fetchImpl, reason] of fails) {
    const c = createUpstashCommandClient({ url: "https://example.upstash.io", token: "t", fetchImpl, timeoutMs: 20 });
    await assert.rejects(c.command(["GET", "k"]), (e) => e instanceof TokenCacheUnavailableError && e.reason === reason, label);
  }
  assert.equal(TOKEN_CACHE_TIMEOUT_MS, 1000, "a slow Redis costs at most 1 s");
});

test("namespace follows VERCEL_ENV like the bot's keys", () => {
  assert.equal(tokenCacheNamespace({ VERCEL_ENV: "production" }), "production");
  assert.equal(tokenCacheNamespace({ VERCEL_ENV: "preview" }), "preview");
  assert.equal(tokenCacheNamespace({}), "development");
});

test("ask route wiring: Redis cache only when Upstash is configured; keys are per environment", () => {
  assert.equal(askTokenStore(CONFIG, {}), undefined, "no Upstash settings -> no cache");
  assert.equal(askTokenStore(CONFIG, { UPSTASH_REDIS_REST_URL: "http://insecure.example", UPSTASH_REDIS_REST_TOKEN: "t" }), undefined);
  assert.ok(askTokenStore(CONFIG, { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }));
  assert.notEqual(intellistayTokenKey("production", CONFIG), intellistayTokenKey("preview", CONFIG));
  assert.ok(!intellistayTokenKey("production", CONFIG).includes(CONFIG.username), "the key does not expose the username");
});

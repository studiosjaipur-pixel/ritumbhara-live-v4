// Week 7 acceptance checks that the other Guest Messages tests only prove indirectly:
//   1. Duplicate protection across days: a message added as QUEUED the day before keeps the SAME ID when it
//      becomes READY on its day, so the team queue updates one row instead of adding a second.
//   2. Queue mode never contacts a guest: with the REAL Apps Script delivery code, the only web requests are to the
//      Intellistay TEST host and script.google.com (never Twilio/WhatsApp), and no Guest Messages module imports
//      any sending code.
// No network: every request goes to an in-memory fake. All values are fake.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG, LOGIN_OK, bookingsResponse, intellistayFetch, normalized, rawBooking } from "../helpers/intellistay-fixtures.mjs";

const { planMessages, addDays } = await import("../../lib/guest-messages/triggers.ts");
const { createGuestMessagesRunHandler } = await import("../../lib/guest-messages/run.ts");
const { createIntellistayClient } = await import("../../lib/intellistay/client.ts");
const { getGuestMessagesApiConfig } = await import("../../lib/guest-messages/http.ts");

const API_SECRET = "acceptance-test-secret-0123456789abcdef"; // fake, 39 chars
const SINK_URL = "https://script.google.com/macros/s/FAKE-DEPLOYMENT/exec"; // fake
const TEST_HOST = "ritumbharatest.aastratech.com";
const istNine = (day) => new Date(day + "T03:30:00Z"); // 09:00 India time on that day

function runRequest(mode) {
  return new Request("https://example.test/api/guest-messages/run", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + API_SECRET }, body: JSON.stringify({ mode }),
  });
}

// ---------- 1. duplicate protection across days ----------

test("each message keeps one ID from QUEUED (day before) to READY (its day), across daily runs of a whole stay", () => {
  const b = normalized(); // check-in 20 Oct, checkout 22 Oct, Reserved
  const seen = {}; // type -> { ids:Set, statuses:[] }
  for (let i = 0; i < 10; i++) {
    const day = addDays("2026-10-15", i);
    planMessages([b], { today: day }).forEach((p) => {
      seen[p.type] = seen[p.type] || { ids: new Set(), statuses: [] };
      seen[p.type].ids.add(p.messageId);
      seen[p.type].statuses.push(day + ":" + p.status);
    });
  }
  assert.deepEqual(Object.keys(seen).sort(), ["CHECKOUT", "CHECK_IN", "PRE_ARRIVAL"]);
  for (const type of Object.keys(seen)) {
    assert.equal(seen[type].ids.size, 1, type + " must have exactly one ID across all runs: " + seen[type].statuses.join(", "));
    assert.ok(seen[type].statuses.some((s) => s.endsWith(":QUEUED")), type + " is queued ahead");
    assert.ok(seen[type].statuses.some((s) => s.endsWith(":READY")), type + " becomes READY");
  }
  assert.deepEqual(seen.PRE_ARRIVAL.statuses, ["2026-10-17:QUEUED", "2026-10-18:READY", "2026-10-19:READY"]);
  assert.deepEqual(seen.CHECK_IN.statuses, ["2026-10-19:QUEUED", "2026-10-20:READY"]);
  assert.deepEqual(seen.CHECKOUT.statuses, ["2026-10-21:QUEUED", "2026-10-22:READY"]);
});

test("run queue on consecutive days: the QUEUED row is moved to READY under the same ID, never duplicated", async () => {
  const rows = new Map(); // messageId -> latest status (same contract as the Apps Script sink: one row per ID)
  const delivered = [];
  const handlerFor = (day) => createGuestMessagesRunHandler({
    getApiConfig: () => getGuestMessagesApiConfig({ GUEST_MESSAGES_ENABLED: "true", GUEST_MESSAGES_API_SECRET: API_SECRET }),
    getIntellistayConfig: () => ({ status: "ready", config: CONFIG }),
    createClient: (config) => createIntellistayClient({ config, log() {}, fetchImpl: intellistayFetch({
      login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse([rawBooking()]) },
    }) }),
    deliver: async (env) => {
      const m = env.message;
      delivered.push(day + ":" + m.type + ":" + m.status);
      const had = rows.has(m.messageId);
      rows.set(m.messageId, m.type + ":" + m.status);
      return { ok: true, status: had ? "updated" : "stored" };
    },
    sinkConfigured: () => true,
    now: () => istNine(day),
    nowMs: () => istNine(day).getTime(),
    log() {},
  });

  const d17 = await (await handlerFor("2026-10-17")(runRequest("queue"))).json();
  const d18 = await (await handlerFor("2026-10-18")(runRequest("queue"))).json();
  assert.deepEqual(delivered, ["2026-10-17:PRE_ARRIVAL:QUEUED", "2026-10-18:PRE_ARRIVAL:READY"]);
  assert.equal(d17.items[0].messageId, d18.items[0].messageId, "same message, same ID");
  assert.deepEqual(d17.deliveries, { stored: 1 });
  assert.deepEqual(d18.deliveries, { updated: 1 });
  assert.equal(rows.size, 1, "one queue row for the pre-arrival message");
  assert.deepEqual(Array.from(rows.values()), ["PRE_ARRIVAL:READY"]);
});

// ---------- 2. queue mode never contacts a guest ----------

test("run queue with the real Apps Script delivery: only the Intellistay TEST host and script.google.com are called", async () => {
  const realFetch = globalThis.fetch;
  const savedEnv = { url: process.env.GUEST_MESSAGES_SINK_URL, secret: process.env.GUEST_MESSAGES_SINK_SECRET };
  const requests = [];
  const intellistay = intellistayFetch({ login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse([rawBooking()]) } });
  process.env.GUEST_MESSAGES_SINK_URL = SINK_URL;
  process.env.GUEST_MESSAGES_SINK_SECRET = "fake-sink-secret-for-acceptance-test";
  globalThis.fetch = async (url, init) => {
    const u = new URL(String(url));
    requests.push({ host: u.host, href: u.href, body: init && init.body ? String(init.body) : "" });
    if (u.host === TEST_HOST) return intellistay(u.href, init);
    if (u.host === "script.google.com") return new Response(JSON.stringify({ ok: true, stored: true, emailStatus: "SENT" }), { status: 200 });
    return new Response("unexpected host", { status: 500 });
  };
  try {
    // Only the API switch, the clock and logging are replaced: Intellistay client, sink check and delivery are real.
    const handler = createGuestMessagesRunHandler({
      getApiConfig: () => getGuestMessagesApiConfig({ GUEST_MESSAGES_ENABLED: "true", GUEST_MESSAGES_API_SECRET: API_SECRET }),
      getIntellistayConfig: () => ({ status: "ready", config: CONFIG }),
      now: () => istNine("2026-10-18"),
      nowMs: () => istNine("2026-10-18").getTime(),
      log() {},
    });
    const res = await handler(runRequest("queue"));
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body.deliveries, { stored: 1 });
    assert.deepEqual(body.byStatus, { READY: 1 });

    const hosts = Array.from(new Set(requests.map((r) => r.host))).sort();
    assert.deepEqual(hosts, ["ritumbharatest.aastratech.com", "script.google.com"]);
    requests.forEach((r) => assert.doesNotMatch(r.href, /twilio|whatsapp|wa\.me|graph\.facebook|intellistay\.in/i));
    const sinkCalls = requests.filter((r) => r.host === "script.google.com");
    assert.equal(sinkCalls.length, 1);
    assert.equal(JSON.parse(sinkCalls[0].body).type, "guest_message", "the sink only receives a queue row for the team");
    assert.equal(JSON.parse(sinkCalls[0].body).message.status, "READY", "READY = waiting for a team member to send it");

    // dry_run makes no sink call at all.
    requests.length = 0;
    const dry = await handler(runRequest("dry_run"));
    assert.equal(dry.status, 200);
    assert.deepEqual(Array.from(new Set(requests.map((r) => r.host))), [TEST_HOST]);
  } finally {
    globalThis.fetch = realFetch;
    if (savedEnv.url === undefined) delete process.env.GUEST_MESSAGES_SINK_URL; else process.env.GUEST_MESSAGES_SINK_URL = savedEnv.url;
    if (savedEnv.secret === undefined) delete process.env.GUEST_MESSAGES_SINK_SECRET; else process.env.GUEST_MESSAGES_SINK_SECRET = savedEnv.secret;
  }
});

test("no Guest Messages or Intellistay module imports Twilio or WhatsApp sending code", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url)); // works on Windows and Linux
  const files = [];
  const walk = (dir) => readdirSync(dir).forEach((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|mjs|js)$/.test(n)) files.push(p);
  });
  ["lib/guest-messages", "lib/intellistay", "app/api/guest-messages"].forEach((d) => walk(join(root, d)));
  files.push(join(root, "scripts/guest-messages-dry-run.mjs"));
  assert.ok(files.length >= 10, "found the Guest Messages sources");
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const imports = (src.match(/(?:from|import)\s*\(?\s*["'][^"']+["']/g) || []).map((s) => s.replace(/^.*["']([^"']+)["'].*$/, "$1"));
    for (const spec of imports) {
      assert.doesNotMatch(spec, /twilio|whatsapp\.ts$|lib\/whatsapp$|\/whatsapp$/i, f + " imports " + spec);
      // The one shared helper allowed: phone-number normalising (lib/whatsapp-bot/address.ts, no imports, no network).
      if (/whatsapp-bot\//.test(spec)) assert.match(spec, /whatsapp-bot\/address$/, f + " imports " + spec);
    }
    assert.doesNotMatch(src, /api\.twilio\.com|graph\.facebook\.com/, f + " must not call a messaging API");
  }
  const address = readFileSync(join(root, "lib/whatsapp-bot/address.ts"), "utf8");
  assert.doesNotMatch(address, /^\s*import\s/m, "address.ts imports nothing");
  assert.doesNotMatch(address, /fetch\(/, "address.ts makes no requests");
});

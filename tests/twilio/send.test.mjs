// Week 6 Stretch 2: lib/twilio/send.ts (outbound WhatsApp template via Twilio's Messages API). fetch is always a
// fake: no network, no real message.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";

const { sendWhatsAppTemplate, TWILIO_API_BASE } = await import("../../lib/twilio/send.ts");

const ACCOUNT_SID = "AC" + "a".repeat(32);
const AUTH_TOKEN = "fake-twilio-auth-token-value";
const CONTENT_SID = "HX" + "b".repeat(32);
const MSG_SID = "SM" + "c".repeat(32);
const MSG = { accountSid: ACCOUNT_SID, authToken: AUTH_TOKEN, from: "+14155238886", to: "+919000000001", contentSid: CONTENT_SID };

function fakeFetch(status, body, calls) {
  return async (url, init) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
}

test("request: POST to the account's Messages endpoint with Basic auth and a template-only form", async () => {
  const calls = [];
  const r = await sendWhatsAppTemplate(Object.assign({}, MSG, { contentVariables: { 1: "Jaipur", 2: "10 Dec 2026" } }), { fetchImpl: fakeFetch(201, { sid: MSG_SID }, calls) });
  assert.deepEqual(r, { ok: true, sid: MSG_SID });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, TWILIO_API_BASE + "/Accounts/" + ACCOUNT_SID + "/Messages.json");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Basic " + Buffer.from(ACCOUNT_SID + ":" + AUTH_TOKEN).toString("base64"));
  const form = new URLSearchParams(calls[0].init.body);
  assert.deepEqual([...form.keys()].sort(), ["ContentSid", "ContentVariables", "From", "To"]);
  assert.equal(form.get("To"), "whatsapp:+919000000001");
  assert.equal(form.get("From"), "whatsapp:+14155238886");
  assert.equal(form.get("ContentSid"), CONTENT_SID);
  assert.deepEqual(JSON.parse(form.get("ContentVariables")), { 1: "Jaipur", 2: "10 Dec 2026" });
  assert.equal(form.get("Body"), null, "never a free-form Body");
});

test("request: no ContentVariables parameter when the template has no variables", async () => {
  const calls = [];
  await sendWhatsAppTemplate(MSG, { fetchImpl: fakeFetch(201, { sid: MSG_SID }, calls) });
  assert.equal(new URLSearchParams(calls[0].init.body).get("ContentVariables"), null);
});

test("invalid input never reaches the network", async () => {
  for (const over of [{ accountSid: "AC1" }, { authToken: "" }, { from: "14155238886" }, { to: "whatsapp:+919000000001" }, { contentSid: "HX1" },
    { contentVariables: { a: "x" } }, { contentVariables: { 1: "" } }]) {
    const calls = [];
    const r = await sendWhatsAppTemplate(Object.assign({}, MSG, over), { fetchImpl: fakeFetch(201, { sid: MSG_SID }, calls) });
    assert.deepEqual(r, { ok: false, reason: "invalid_input", systemic: true }, JSON.stringify(over));
    assert.equal(calls.length, 0);
  }
});

test("Twilio errors: reason + numeric code only (never Twilio's message text); 4xx per-guest, auth/limits/5xx systemic", async () => {
  const text = "The 'To' number +919000000001 is not a valid phone number.";
  const cases = [[400, false], [401, true], [403, true], [404, true], [429, true], [500, true], [503, true]];
  for (const [status, systemic] of cases) {
    const r = await sendWhatsAppTemplate(MSG, { fetchImpl: fakeFetch(status, { code: 21211, message: text, status }, []) });
    assert.deepEqual(r, { ok: false, reason: "http_" + status, status, code: 21211, systemic }, String(status));
    assert.ok(!JSON.stringify(r).includes("+919000000001"));
  }
  const noJson = await sendWhatsAppTemplate(MSG, { fetchImpl: fakeFetch(502, "<html>", []) });
  assert.deepEqual(noJson, { ok: false, reason: "http_502", status: 502, systemic: true });
});

test("a 2xx without a valid Message SID is bad_response (systemic)", async () => {
  const r = await sendWhatsAppTemplate(MSG, { fetchImpl: fakeFetch(201, { sid: "nope" }, []) });
  assert.deepEqual(r, { ok: false, reason: "bad_response", status: 201, systemic: true });
});

test("network error and timeout are reported without throwing", async () => {
  const net = await sendWhatsAppTemplate(MSG, { fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  assert.deepEqual(net, { ok: false, reason: "network", systemic: true });
  const slow = await sendWhatsAppTemplate(MSG, {
    timeoutMs: 20,
    fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; reject(e); })),
  });
  assert.deepEqual(slow, { ok: false, reason: "timeout", systemic: true });
});

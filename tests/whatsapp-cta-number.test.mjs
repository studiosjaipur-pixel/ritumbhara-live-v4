// Website WhatsApp CTA number: Production always uses the real number; only a Preview-only override
// (NEXT_PUBLIC_WHATSAPP_CTA_NUMBER) can point the links at the Meta TEST number.
// Run with: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveWhatsAppNumber, PRODUCTION_WHATSAPP_NUMBER, PRODUCTION_WHATSAPP_DISPLAY_NUMBER } from "../lib/whatsapp.ts";

const PROD = { number: "918306312778", display: "+91 83063 12778" };

test("production number constants are unchanged", () => {
  assert.equal(PRODUCTION_WHATSAPP_NUMBER, "918306312778");
  assert.equal(PRODUCTION_WHATSAPP_DISPLAY_NUMBER, "+91 83063 12778");
});

test("no override: the production number, in every environment", () => {
  for (const env of [undefined, "", "production", "preview", "development"]) {
    assert.deepEqual(resolveWhatsAppNumber(undefined, env), PROD);
    assert.deepEqual(resolveWhatsAppNumber("", env), PROD);
  }
});

test("Preview with the override: the Meta test number", () => {
  assert.deepEqual(resolveWhatsAppNumber("+15551422953", "preview"), { number: "15551422953", display: "+15551422953" });
  assert.deepEqual(resolveWhatsAppNumber(" +1 555 142 2953 ", "preview"), { number: "15551422953", display: "+15551422953" });
  // System env var not exposed to the browser (unset): the Preview-only variable still applies.
  assert.deepEqual(resolveWhatsAppNumber("+15551422953", undefined), { number: "15551422953", display: "+15551422953" });
});

test("Production ignores the override even if it were ever set there", () => {
  assert.deepEqual(resolveWhatsAppNumber("+15551422953", "production"), PROD);
  assert.deepEqual(resolveWhatsAppNumber("+15551422953", " Production "), PROD);
});

test("invalid overrides fall back to the production number", () => {
  for (const bad of ["abc", "+0123456789", "12345", "+1555142295312345", "wa.me/15551422953"]) {
    assert.deepEqual(resolveWhatsAppNumber(bad, "preview"), PROD, bad);
  }
});

test("module constants: production number when the override is not set (as in Production)", async () => {
  delete process.env.NEXT_PUBLIC_WHATSAPP_CTA_NUMBER;
  const m = await import("../lib/whatsapp.ts?prod=" + Date.now());
  assert.equal(m.WHATSAPP_NUMBER, "918306312778");
  assert.equal(m.WHATSAPP_DISPLAY_NUMBER, "+91 83063 12778");
  assert.equal(m.WHATSAPP_BASE_URL, "https://wa.me/918306312778");
  assert.match(m.buildWhatsAppUrl("Hi", "W-FLOATING"), /^https:\/\/wa\.me\/918306312778\?text=/);
});

test("module constants: Meta test number on a Preview build with the override", async () => {
  process.env.NEXT_PUBLIC_WHATSAPP_CTA_NUMBER = "+15551422953";
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  try {
    const m = await import("../lib/whatsapp.ts?preview=" + Date.now());
    assert.equal(m.WHATSAPP_BASE_URL, "https://wa.me/15551422953");
    assert.match(m.buildWhatsAppUrl("Hi", "W-HOME-AVAILABILITY"), /^https:\/\/wa\.me\/15551422953\?text=Hi%0A%0ARef%3A%20W-HOME-AVAILABILITY$/);
  } finally {
    delete process.env.NEXT_PUBLIC_WHATSAPP_CTA_NUMBER;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  }
});

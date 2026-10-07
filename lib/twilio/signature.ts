import { createHmac, timingSafeEqual } from "crypto";

// Twilio webhook signature verification (Week 5 stretch, server-only).
//
// Twilio signs every webhook with the X-Twilio-Signature header:
//   Base64( HMAC-SHA1( authToken, url + key1 + value1 + key2 + value2 ... ) )
// where `url` is the exact webhook URL configured in Twilio (including any query string) and the POST
// parameters are sorted by name. For a repeated parameter, its distinct values are sorted and each is appended
// as name + value. This mirrors the official Twilio Node SDK (twilio/lib/webhooks/webhooks.js), including its
// check of the URL with and without the standard port.
//
// The URL must come from configuration (TWILIO_WEBHOOK_URL), never from the incoming request: behind a proxy
// the request's host/protocol can differ from what Twilio signed.
//
// Framework-independent, no logging: neither the auth token nor any computed signature is ever logged.

export type TwilioParams = URLSearchParams | Record<string, string | string[]>;

const MAX_SIGNATURE_LENGTH = 200; // a real signature is 28 Base64 characters

// Groups parameters by name. Values of a repeated name are de-duplicated and sorted (as the Twilio SDK does).
function collectParams(params: TwilioParams): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  function add(key: string, value: string) {
    const list = out[key] || (out[key] = []);
    if (list.indexOf(value) === -1) list.push(value);
  }
  if (params instanceof URLSearchParams) {
    params.forEach(function (value, key) { add(key, value); });
  } else {
    Object.keys(params).forEach(function (key) {
      const value = params[key];
      if (Array.isArray(value)) value.forEach(function (v) { add(key, String(v)); });
      else add(key, String(value));
    });
  }
  return out;
}

// The string Twilio signs: url followed by each sorted name+value pair.
export function twilioSigningString(url: string, params: TwilioParams): string {
  const grouped = collectParams(params);
  let data = url;
  Object.keys(grouped).sort().forEach(function (key) {
    grouped[key].sort().forEach(function (value) { data += key + value; });
  });
  return data;
}

export function computeTwilioSignature(authToken: string, url: string, params: TwilioParams): string {
  return createHmac("sha1", authToken).update(Buffer.from(twilioSigningString(url, params), "utf-8")).digest("base64");
}

// Variants Twilio may have signed: the configured URL exactly, without a port, and with the standard port.
function urlCandidates(url: string): string[] {
  const out = [url];
  try {
    const u = new URL(url);
    const withoutPort = new URL(url);
    withoutPort.port = "";
    const standardPort = u.protocol === "https:" ? ":443" : ":80";
    const auth = u.username ? u.username + (u.password ? ":" + u.password : "") + "@" : "";
    const withPort = u.port ? u.toString() : u.protocol + "//" + auth + u.host + standardPort + u.pathname + u.search + u.hash;
    [withoutPort.toString(), withPort].forEach(function (c) { if (out.indexOf(c) === -1) out.push(c); });
  } catch {
    // Not a parseable URL: only the exact string is checked (and will normally fail).
  }
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface VerifyTwilioSignatureInput {
  // The webhook URL exactly as configured in Twilio (from TWILIO_WEBHOOK_URL).
  url: string;
  // The POST form parameters, e.g. new URLSearchParams(await req.text()).
  params: TwilioParams;
  // The X-Twilio-Signature header value (null/undefined if missing).
  signature: string | null | undefined;
  // The Twilio auth token of the account that owns the sender.
  authToken: string;
}

// Returns true only for a valid signature. Missing or malformed input is rejected, never thrown.
export function verifyTwilioSignature(input: VerifyTwilioSignatureInput): boolean {
  try {
    const signature = typeof input.signature === "string" ? input.signature.trim() : "";
    const authToken = typeof input.authToken === "string" ? input.authToken : "";
    const url = typeof input.url === "string" ? input.url.trim() : "";
    if (!signature || signature.length > MAX_SIGNATURE_LENGTH || !authToken || !url || !input.params) return false;
    const candidates = urlCandidates(url);
    let valid = false;
    // Check every candidate (no early exit) so timing does not depend on which variant matched.
    candidates.forEach(function (candidate) {
      if (constantTimeEqual(signature, computeTwilioSignature(authToken, candidate, input.params))) valid = true;
    });
    return valid;
  } catch {
    return false;
  }
}

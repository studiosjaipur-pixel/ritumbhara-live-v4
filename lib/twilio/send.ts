// Outbound WhatsApp template message through Twilio's Messages API (Week 6 Stretch 2, live follow-ups). SERVER-ONLY.
//
// Business-initiated WhatsApp messages (outside the 24-hour customer-service window) must use a template that Meta
// has approved, so this module only ever sends a Twilio Content template (ContentSid + ContentVariables). There is
// no free-form Body parameter at all.
// Credentials are passed in by the caller from server-side environment variables and are never logged. Errors are
// reduced to a short reason code plus Twilio's numeric error code; Twilio's error text is never returned or logged
// (it can contain the recipient's number).

if (typeof window !== "undefined") {
  throw new Error("lib/twilio/send is server-only and must not be imported in browser code.");
}

export const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
export const TWILIO_SEND_TIMEOUT_MS = 8000;

const ACCOUNT_SID = /^AC[0-9a-fA-F]{32}$/;
const CONTENT_SID = /^HX[0-9a-fA-F]{32}$/;
const MESSAGE_SID = /^(SM|MM)[0-9a-fA-F]{32}$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const VARIABLE_KEY = /^[1-9]\d?$/;

export interface WhatsAppTemplateMessage {
  accountSid: string;
  authToken: string;
  from: string; // E.164 sender number (the bot's WhatsApp number)
  to: string; // E.164 guest number
  contentSid: string; // approved template (HX…)
  contentVariables?: Record<string, string>; // {"1": "...", "2": "..."}; omitted when empty
}

export type TwilioSendResult =
  | { ok: true; sid: string }
  // reason: short code ("http_400", "network", "timeout", "bad_response", "invalid_input"); code: Twilio's numeric
  // error code when it gave one; systemic: the problem is not specific to this guest (stop sending to others).
  | { ok: false; reason: string; status?: number; code?: number; systemic: boolean };

export interface TwilioSendOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function invalid(): TwilioSendResult {
  return { ok: false, reason: "invalid_input", systemic: true };
}

// Sends one WhatsApp template message. Never throws.
export async function sendWhatsAppTemplate(msg: WhatsAppTemplateMessage, options?: TwilioSendOptions): Promise<TwilioSendResult> {
  if (!ACCOUNT_SID.test(msg.accountSid) || !msg.authToken || !E164.test(msg.from) || !E164.test(msg.to) || !CONTENT_SID.test(msg.contentSid)) {
    return invalid();
  }
  const vars = msg.contentVariables || {};
  const keys = Object.keys(vars);
  for (let i = 0; i < keys.length; i++) {
    if (!VARIABLE_KEY.test(keys[i]) || typeof vars[keys[i]] !== "string" || !vars[keys[i]]) return invalid();
  }

  const form = new URLSearchParams();
  form.set("To", "whatsapp:" + msg.to);
  form.set("From", "whatsapp:" + msg.from);
  form.set("ContentSid", msg.contentSid);
  if (keys.length) form.set("ContentVariables", JSON.stringify(vars));

  const doFetch = (options && options.fetchImpl) || fetch;
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, (options && options.timeoutMs) || TWILIO_SEND_TIMEOUT_MS);
  let res: Response;
  try {
    res = await doFetch(TWILIO_API_BASE + "/Accounts/" + msg.accountSid + "/Messages.json", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(msg.accountSid + ":" + msg.authToken, "utf8").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    // The request may or may not have reached Twilio. The caller keeps its claim, so this is never retried blindly.
    return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "timeout" : "network", systemic: true };
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try { body = await res.json(); } catch { body = null; }
  const data = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  if (res.status >= 200 && res.status < 300) {
    const sid = typeof data.sid === "string" ? data.sid : "";
    if (MESSAGE_SID.test(sid)) return { ok: true, sid: sid };
    return { ok: false, reason: "bad_response", status: res.status, systemic: true };
  }
  const code = typeof data.code === "number" && isFinite(data.code) ? data.code : undefined;
  // 400-type errors are usually about this one recipient (e.g. invalid number); auth, missing resources, rate
  // limits and server errors affect every send, so the caller stops.
  const systemic = res.status === 401 || res.status === 403 || res.status === 404 || res.status === 429 || res.status >= 500;
  const result: TwilioSendResult = { ok: false, reason: "http_" + res.status, status: res.status, systemic: systemic };
  if (code !== undefined) result.code = code;
  return result;
}

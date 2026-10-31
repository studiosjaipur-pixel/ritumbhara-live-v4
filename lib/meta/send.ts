// Outbound WhatsApp template through the Meta WhatsApp Cloud API. SERVER-ONLY.
// Runs ALONGSIDE lib/twilio/send.ts (unchanged). Same result shape as the Twilio sender (TwilioSendResult), so the
// follow-up flow does not change. Never logs or returns the token, the recipient number or Meta's error text.

if (typeof window !== "undefined") {
  throw new Error("lib/meta/send is server-only and must not be imported in browser code.");
}

export const META_SEND_TIMEOUT_MS = 8000;
export const DEFAULT_GRAPH_API_VERSION = "v23.0";

const E164 = /^\+[1-9]\d{7,14}$/;
const NAME = /^[a-z0-9_]{1,512}$/;
const LANG = /^[a-z]{2,3}(_[A-Z]{2})?$/;

type Env = Record<string, string | undefined>;

export interface MetaConfig {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
}

export type MetaSendResult =
  | { ok: true; sid: string }
  | { ok: false; reason: string; status?: number; code?: number; systemic: boolean };

function read(env: Env, name: string): string {
  const v = env[name];
  return typeof v === "string" ? v.trim() : "";
}

export function getMetaConfig(env: Env = process.env): MetaConfig | null {
  const accessToken = read(env, "META_WA_ACCESS_TOKEN");
  const phoneNumberId = read(env, "META_WA_PHONE_NUMBER_ID");
  if (!accessToken || !/^\d{5,25}$/.test(phoneNumberId)) return null;
  const v = read(env, "META_GRAPH_API_VERSION");
  return { accessToken, phoneNumberId, graphApiVersion: /^v\d+\.\d+$/.test(v) ? v : DEFAULT_GRAPH_API_VERSION };
}

export interface MetaTemplateMessage {
  to: string; // E.164
  name: string; // approved template name
  language: string; // e.g. "en"
  params: string[]; // positional body parameters {{1}}, {{2}}, ...
}

// Sends one approved template. Never throws.
export async function sendMetaTemplate(cfg: MetaConfig, msg: MetaTemplateMessage, fetchImpl?: typeof fetch): Promise<MetaSendResult> {
  if (!E164.test(msg.to) || !NAME.test(msg.name) || !LANG.test(msg.language) || msg.params.some((p) => typeof p !== "string" || !p)) {
    return { ok: false, reason: "invalid_input", systemic: true };
  }
  const template: Record<string, unknown> = { name: msg.name, language: { code: msg.language } };
  if (msg.params.length) template.components = [{ type: "body", parameters: msg.params.map((p) => ({ type: "text", text: p.slice(0, 1024) })) }];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), META_SEND_TIMEOUT_MS);
  let res: Response;
  try {
    res = await (fetchImpl || fetch)(`https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: "Bearer " + cfg.accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: msg.to.slice(1), type: "template", template }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "timeout" : "network", systemic: true };
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  const id = data && Array.isArray(data.messages) && typeof data.messages[0]?.id === "string" ? data.messages[0].id : "";
  if (res.status >= 200 && res.status < 300 && id) return { ok: true, sid: id };
  const systemic = res.status === 401 || res.status === 403 || res.status === 404 || res.status === 429 || res.status >= 500;
  const out: MetaSendResult = { ok: false, reason: res.ok ? "bad_response" : "http_" + res.status, status: res.status, systemic };
  if (typeof data?.error?.code === "number") out.code = data.error.code;
  return out;
}

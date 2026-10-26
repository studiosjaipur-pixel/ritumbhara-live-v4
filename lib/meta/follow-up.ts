import type { TwilioSendResult, WhatsAppTemplateMessage } from "../twilio/send";
import { getMetaConfig, sendMetaTemplate } from "./send";

// Meta sender for the automatic WhatsApp follow-ups. SERVER-ONLY.
// Used only when WHATSAPP_FOLLOW_UP_PROVIDER=meta (unset = Twilio, unchanged). Takes the same message the Twilio
// sender gets and returns the same result shape; the Twilio-specific fields (account, token, Content SID) are ignored
// and the approved Meta template WHATSAPP_FOLLOW_UP_META_TEMPLATE (+ WHATSAPP_FOLLOW_UP_META_LANGUAGE, default "en")
// is sent with the same guest-safe variables, in order.

type Env = Record<string, string | undefined>;

export function isMetaFollowUpProvider(env: Env = process.env): boolean {
  return (env.WHATSAPP_FOLLOW_UP_PROVIDER || "").trim().toLowerCase() === "meta";
}

export async function sendFollowUpViaMeta(msg: WhatsAppTemplateMessage, env: Env = process.env, fetchImpl?: typeof fetch): Promise<TwilioSendResult> {
  const cfg = getMetaConfig(env);
  const name = (env.WHATSAPP_FOLLOW_UP_META_TEMPLATE || "").trim();
  if (!cfg || !name) return { ok: false, reason: "meta_not_configured", systemic: true };
  const vars = msg.contentVariables || {};
  const params = Object.keys(vars).sort((a, b) => Number(a) - Number(b)).map((k) => vars[k]);
  return sendMetaTemplate(cfg, { to: msg.to, name, language: (env.WHATSAPP_FOLLOW_UP_META_LANGUAGE || "en").trim(), params }, fetchImpl);
}

import { on } from "../events/bus";
import type { HandoffPayload, QualifiedLeadPayload } from "./qualified-lead";

// Week 5 stretch, Phase 5: delivers WhatsApp-bot leads to the Google Apps Script web app (Qualified Leads and
// Handoffs tabs + team email). SERVER-ONLY. Separate from the click sink (apps-script-sink.ts), with its own
// server-only settings QUALIFIED_LEAD_SINK_URL and QUALIFIED_LEAD_SINK_SECRET (never NEXT_PUBLIC_).
//
// Apps Script cannot read request headers, so (as with the click sink) the secret travels in the JSON body,
// server to server over HTTPS. The reply is read after Google's 302 redirect.
// Unlike the click sink, delivery returns a structured result, because the guest's reply depends on it.
// Transient failures are retried once within a fixed time budget; nothing pretends a lead was saved.

export const SINK_ATTEMPT_TIMEOUT_MS = 5000;
export const SINK_TOTAL_BUDGET_MS = 8000;
const RETRY_DELAY_MS = 300;
const ALLOWED_PREFIX = "https://script.google.com/";

export type DeliveryFailure =
  | "not_configured" | "timeout" | "network" | "http_4xx" | "http_5xx" | "busy" | "rejected" | "bad_response" | "no_sink";

export type LeadDeliveryResult =
  | { ok: true; status: "stored" | "duplicate"; emailStatus: "SENT" | "FAILED" | "UNKNOWN" }
  | { ok: false; reason: DeliveryFailure };

export type LeadEnvelope =
  | { type: "qualified_lead"; lead: QualifiedLeadPayload }
  | { type: "lead_handoff"; handoff: HandoffPayload };

export interface SinkOptions {
  url?: string | null;
  secret?: string | null;
  fetchImpl?: typeof fetch;
  attemptTimeoutMs?: number;
  totalBudgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  nowMs?: () => number;
  log?: (event: string, meta?: Record<string, string | number | boolean>) => void;
}

const TRANSIENT: DeliveryFailure[] = ["timeout", "network", "http_5xx", "busy"];

async function attempt(url: string, body: string, timeoutMs: number, doFetch: typeof fetch): Promise<LeadDeliveryResult> {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  try {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "timeout" : "network" };
    }
    if (res.status >= 500) return { ok: false, reason: "http_5xx" };
    if (!res.ok) return { ok: false, reason: "http_4xx" };
    let reply: { ok?: unknown; stored?: unknown; duplicate?: unknown; emailStatus?: unknown; error?: unknown };
    try {
      reply = JSON.parse(await res.text());
    } catch (err) {
      // A 200 HTML page usually means the web app is not deployed with "Who has access: Anyone".
      return { ok: false, reason: err instanceof Error && err.name === "AbortError" ? "timeout" : "bad_response" };
    }
    if (!reply || typeof reply !== "object") return { ok: false, reason: "bad_response" };
    if (reply.ok === true && reply.duplicate === true) return { ok: true, status: "duplicate", emailStatus: "UNKNOWN" };
    if (reply.ok === true && reply.stored === true) {
      return { ok: true, status: "stored", emailStatus: reply.emailStatus === "SENT" ? "SENT" : reply.emailStatus === "FAILED" ? "FAILED" : "UNKNOWN" };
    }
    if (reply.ok === false && reply.error === "busy") return { ok: false, reason: "busy" };
    return { ok: false, reason: reply.ok === false ? "rejected" : "bad_response" };
  } finally {
    clearTimeout(timer);
  }
}

// Posts one envelope. At most two attempts, and only transient failures are retried, within the total budget.
export async function postLeadEnvelope(envelope: LeadEnvelope, options?: SinkOptions): Promise<LeadDeliveryResult> {
  const o = options || {};
  const url = o.url !== undefined ? o.url : process.env.QUALIFIED_LEAD_SINK_URL;
  const secret = o.secret !== undefined ? o.secret : process.env.QUALIFIED_LEAD_SINK_SECRET;
  const log = o.log || function (event: string, meta?: Record<string, string | number | boolean>) {
    console.warn("[qualified-lead-sink] " + event + (meta ? " " + JSON.stringify(meta) : ""));
  };
  if (!url || !secret || url.indexOf(ALLOWED_PREFIX) !== 0) {
    log("not_configured");
    return { ok: false, reason: "not_configured" };
  }
  const doFetch = o.fetchImpl || fetch;
  const nowMs = o.nowMs || Date.now;
  const sleep = o.sleep || function (ms: number) { return new Promise<void>(function (r) { setTimeout(r, ms); }); };
  const attemptTimeout = o.attemptTimeoutMs || SINK_ATTEMPT_TIMEOUT_MS;
  const budget = o.totalBudgetMs || SINK_TOTAL_BUDGET_MS;
  const body = JSON.stringify(Object.assign({ secret: secret }, envelope));
  const id = envelope.type === "qualified_lead" ? envelope.lead.leadId : envelope.handoff.handoffId;

  const started = nowMs();
  let result = await attempt(url, body, Math.min(attemptTimeout, budget), doFetch);
  if (!result.ok && TRANSIENT.indexOf(result.reason) !== -1) {
    const remaining = budget - (nowMs() - started) - RETRY_DELAY_MS;
    if (remaining >= 1000) {
      log("retrying", { id: id, reason: result.reason });
      await sleep(RETRY_DELAY_MS);
      result = await attempt(url, body, Math.min(attemptTimeout, remaining), doFetch);
    }
  }
  if (result.ok) log(result.status === "duplicate" ? "duplicate" : "stored", { id: id, email: result.emailStatus });
  else log("failed", { id: id, reason: result.reason });
  return result;
}

export function deliverQualifiedLead(lead: QualifiedLeadPayload): Promise<LeadDeliveryResult> {
  return postLeadEnvelope({ type: "qualified_lead", lead: lead });
}

export function deliverHandoff(handoff: HandoffPayload): Promise<LeadDeliveryResult> {
  return postLeadEnvelope({ type: "lead_handoff", handoff: handoff });
}

// Registered when this module is first imported (by lib/whatsapp-bot/conversation.ts).
on("LEAD_QUALIFIED", deliverQualifiedLead);
on("LEAD_HANDOFF", deliverHandoff);

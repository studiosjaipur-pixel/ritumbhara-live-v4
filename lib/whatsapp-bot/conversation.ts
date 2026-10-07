import { emit } from "../events/bus";
import { buildHandoffPayload, buildQualifiedLeadPayload, type HandoffPayload, type LeadContext, type QualifiedLeadPayload } from "../leads/qualified-lead";
import "../leads/qualified-lead-sink"; // registers the LEAD_QUALIFIED / LEAD_HANDOFF delivery handlers
import type { LeadDeliveryResult } from "../leads/qualified-lead-sink";
import { formatPhoneForDisplay, maskPhoneNumber } from "./address";
import { buildCatalog, type Catalog } from "./catalog";
import type { WhatsAppBotConfig } from "./config";
import { buildRequestContext, countExtractedFields, shouldExtract, validateExtraction, type ExtractionPlan } from "./extraction";
import { groqExtract, type ExtractionRequestContext, type ExtractionResult } from "./groq-extract";
import { MESSAGES, internalFailure, redisFailure } from "./messages";
import { detectControlKeyword } from "./parse";
import { afterHandoffDelivery, afterQualifiedDelivery, runStateMachine, type MachineContext, type MachineResult } from "./state-machine";
import { STORE_TTL, createUpstashConversationStore, type ConversationStore } from "./store";
import type { ValidatedExtraction } from "./types";
import { RedisUnavailableError } from "./upstash";
import type { InboundResult, LogFn, MessageHandler } from "./webhook";

// Message handler backed by Redis (Week 5 stretch). SERVER-ONLY.
// Order for every verified inbound message:
//   1. claim MessageSid (duplicates: no processing, no reply)
//   2. opt-out check (opted out: silent unless START/RESTART)
//   3. rate limit per sender (STOP is never rate limited)
//   4. per-sender lock (waits briefly; if still busy, the claim is released and the guest is asked to resend)
//   5. load conversation -> [AI fallback extraction, only when the deterministic parser could not get the field
//      being asked; validated; fills missing fields only] -> state machine -> persist -> release lock
//      On YES: the lead is validated and delivered (LEAD_QUALIFIED) BEFORE the reply is chosen and the state saved;
//      the guest is only told the team has it when delivery succeeded. Handoffs without confirmation are
//      delivered as LEAD_HANDOFF (never marked qualified).
//   6. mark MessageSid processed
// If Redis fails, the guest gets a fixed message with the team number; nothing pretends to be saved.

export const RATE_LIMIT_MAX = 20; // messages per sender per window (normal conversations use far fewer)
export const RATE_LIMIT_WINDOW_SECONDS = 600;
const LOCK_WAIT_MS = 2000;
const TWILIO_SANDBOX_NUMBER = "+14155238886"; // Twilio's shared WhatsApp Sandbox sender (public)
const LOCK_POLL_MS = 200;
// AI fallback cost caps (counted only when the AI is actually called).
export const AI_MAX_PER_SENDER_PER_HOUR = 10;
export const AI_MAX_GLOBAL_PER_DAY = 1000;

export interface ConversationHandlerOptions {
  createStore?: (config: WhatsAppBotConfig) => ConversationStore;
  now?: () => Date;
  // Lead delivery. By default the events go on the bus, where lib/leads/qualified-lead-sink.ts handles them.
  emitQualified?: (lead: QualifiedLeadPayload) => Promise<LeadDeliveryResult>;
  emitHandoff?: (handoff: HandoffPayload) => Promise<LeadDeliveryResult>;
  log?: LogFn;
  catalog?: Catalog;
  lockWaitMs?: number;
  lockPollMs?: number;
  sleep?: (ms: number) => Promise<void>;
  // AI fallback extractor. Defaults to Groq (groq-extract.ts) using GROQ_API_KEY / GROQ_MODEL.
  extract?: (text: string, ctx: ExtractionRequestContext, config: WhatsAppBotConfig) => Promise<ExtractionResult>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// The first handler result on the bus that looks like a delivery result; no handler means "no_sink".
function firstDelivery(results: PromiseSettledResult<unknown>[]): LeadDeliveryResult {
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value && typeof r.value === "object" && "ok" in (r.value as object)) return r.value as LeadDeliveryResult;
  }
  return { ok: false, reason: "no_sink" };
}

// Never throws: a crashing delivery counts as not delivered.
async function safeDeliver<T>(fn: (payload: T) => Promise<LeadDeliveryResult>, payload: T): Promise<LeadDeliveryResult> {
  try {
    const d = await fn(payload);
    return d && typeof d === "object" && "ok" in d ? d : { ok: false, reason: "no_sink" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

function siteOf(config: WhatsAppBotConfig): string {
  try { return new URL(config.twilioWebhookUrl).host; } catch { return ""; }
}

function sidPrefix(sid: string): string {
  return sid.slice(0, 6) + "…";
}

export function createConversationHandler(options?: ConversationHandlerOptions): MessageHandler {
  const o = options || {};
  const createStore = o.createStore || function (config: WhatsAppBotConfig) {
    return createUpstashConversationStore(config.upstashRedisRestUrl, config.upstashRedisRestToken);
  };
  const now = o.now || function () { return new Date(); };
  const emitQualified = o.emitQualified || function (lead: QualifiedLeadPayload) { return emit("LEAD_QUALIFIED", lead).then(firstDelivery); };
  const emitHandoff = o.emitHandoff || function (handoff: HandoffPayload) { return emit("LEAD_HANDOFF", handoff).then(firstDelivery); };
  const log: LogFn = o.log || function (event, meta) { console.warn("[wa-bot] " + event + (meta ? " " + JSON.stringify(meta) : "")); };
  const lockWaitMs = o.lockWaitMs === undefined ? LOCK_WAIT_MS : o.lockWaitMs;
  const lockPollMs = o.lockPollMs || LOCK_POLL_MS;
  const sleep = o.sleep || defaultSleep;
  let catalog = o.catalog || null;

  function logDelivery(kind: string, id: string, d: LeadDeliveryResult) {
    if (d.ok) log(kind + "_delivered", { id: id, status: d.status, email: d.emailStatus });
    else log(kind + "_delivery_failed", { id: id, reason: d.reason });
  }
  const extract = o.extract || function (text: string, ctx: ExtractionRequestContext, config: WhatsAppBotConfig) {
    return groqExtract(text, ctx, { apiKey: config.groqApiKey, model: config.groqModel });
  };

  // Never throws: any problem means "no usable extraction" and the deterministic flow carries on.
  async function aiFallback(plan: ExtractionPlan, text: string, sender: string, store: ConversationStore, config: WhatsAppBotConfig, cat: Catalog, meta: Record<string, string>): Promise<ValidatedExtraction | null> {
    try {
      if (!config.groqApiKey) {
        log("ai_skipped", Object.assign({ reason: "no_api_key" }, meta));
        return null;
      }
      const t = now().getTime();
      const perSender = await store.incrementRateLimit("ai:" + sender, 3600, t);
      const global = await store.incrementRateLimit("ai:global", 86400, t);
      if (perSender > AI_MAX_PER_SENDER_PER_HOUR || global > AI_MAX_GLOBAL_PER_DAY) {
        log("ai_skipped", Object.assign({ reason: "cap" }, meta));
        return null;
      }
      const result = await extract(text, buildRequestContext(plan, cat), config);
      if (!result.ok) {
        log("ai_failed", Object.assign({ reason: result.reason }, meta));
        return null;
      }
      const validated = validateExtraction(result.data, text, plan, cat);
      log("ai_extracted", Object.assign({ fields: countExtractedFields(validated), intent: validated.intent || "none" }, meta));
      return validated;
    } catch {
      log("ai_failed", Object.assign({ reason: "unexpected" }, meta));
      return null;
    }
  }

  return async function handleConversationMessage(message, config): Promise<InboundResult> {
    const handoffDisplay = formatPhoneForDisplay(config.handoffNumber);
    const sender = message.from;
    const meta = { sid: sidPrefix(message.messageSid), from: maskPhoneNumber(sender) };
    let store: ConversationStore;
    try {
      store = createStore(config);
      if (!catalog) catalog = buildCatalog();
    } catch (err) {
      log("handler_setup_failed", meta);
      return { reply: internalFailure(handoffDisplay) };
    }

    let result: MachineResult;
    try {
      // 1. Duplicate delivery?
      if ((await store.claimMessage(message.messageSid)) === "duplicate") {
        log("duplicate_message", meta);
        return { reply: null };
      }

      // 2. Opt-out.
      const keyword = message.bodyStatus === "ok" ? detectControlKeyword(message.body) : null;
      const optedOut = await store.isOptedOut(sender);
      if (optedOut && keyword !== "START") {
        await store.markMessageProcessed(message.messageSid);
        log("opted_out_ignored", meta);
        return { reply: null };
      }

      // 3. Rate limit (STOP always goes through).
      if (keyword !== "STOP") {
        const count = await store.incrementRateLimit("sender:" + sender, RATE_LIMIT_WINDOW_SECONDS, now().getTime());
        if (count > RATE_LIMIT_MAX) {
          await store.markMessageProcessed(message.messageSid);
          log("rate_limited", meta);
          return { reply: count === RATE_LIMIT_MAX + 1 ? MESSAGES.rateLimited : null }; // tell the guest once per window
        }
      }

      // 4. Per-sender lock.
      let lock = await store.acquireSenderLock(sender, STORE_TTL.senderLockMs);
      for (let waited = 0; !lock && waited < lockWaitMs; waited += lockPollMs) {
        await sleep(lockPollMs);
        lock = await store.acquireSenderLock(sender, STORE_TTL.senderLockMs);
      }
      if (!lock) {
        await store.releaseMessageClaim(message.messageSid);
        log("sender_busy", meta);
        return { reply: MESSAGES.busy };
      }

      // 5. State machine and persistence, under the lock.
      try {
        const existing = await store.getConversation(sender);
        const plan = shouldExtract(existing, optedOut, message.body, message.bodyStatus, catalog, now());
        const extraction = plan ? await aiFallback(plan, message.body, sender, store, config, catalog, meta) : null;
        let machineCtx: MachineContext;
        result = runStateMachine(existing, optedOut, {
          sender: sender,
          text: message.body,
          bodyStatus: message.bodyStatus,
          profileName: message.profileName,
          extraction: extraction,
        }, machineCtx = { now: now(), catalog: catalog, handoffNumber: handoffDisplay, channel: config.botTo === TWILIO_SANDBOX_NUMBER ? "sandbox" : "production" });

        // Lead delivery happens before anything is saved or replied, so the reply matches what really happened.
        const leadCtx: LeadContext = { catalog: catalog, site: siteOf(config), handoffNumber: handoffDisplay, now: now() };
        if (result.qualifiedLead) {
          const built = buildQualifiedLeadPayload(result.qualifiedLead, leadCtx);
          const delivery = built.ok ? await safeDeliver(emitQualified, built.payload) : null;
          if (!built.ok) log("lead_invalid", Object.assign({ problems: built.problems.join(",") }, meta));
          else logDelivery("lead", built.payload.leadId, delivery as LeadDeliveryResult);
          result = afterQualifiedDelivery(result, !!(delivery && delivery.ok), machineCtx);
        } else if (result.handoffLead) {
          const built = buildHandoffPayload(result.handoffLead, leadCtx);
          const delivery = built.ok ? await safeDeliver(emitHandoff, built.payload) : null;
          if (!built.ok) log("handoff_invalid", Object.assign({ problems: built.problems.join(",") }, meta));
          else logDelivery("handoff", built.payload.handoffId, delivery as LeadDeliveryResult);
          result = afterHandoffDelivery(result, !!(delivery && delivery.ok), machineCtx);
        }
        if (result.optOut === "set") await store.setOptedOut(sender, true);
        if (result.optOut === "clear") await store.setOptedOut(sender, false);
        if (result.persist === "delete") await store.deleteConversation(sender);
        if (result.persist === "save" && result.conversation) await store.saveConversation(result.conversation, result.ttlSeconds);
      } finally {
        try { await store.releaseSenderLock(sender, lock); } catch { log("lock_release_failed", meta); } // the lock expires on its own
      }

      // 6. Done.
      await store.markMessageProcessed(message.messageSid);
      log("message_processed", Object.assign({ state: result.conversation ? result.conversation.state : "none" }, meta));
    } catch (err) {
      log(err instanceof RedisUnavailableError ? "redis_unavailable" : "handler_error", Object.assign({ reason: err instanceof RedisUnavailableError ? err.reason : "unexpected" }, meta));
      return { reply: err instanceof RedisUnavailableError ? redisFailure(handoffDisplay) : internalFailure(handoffDisplay) };
    }

    return { reply: result.reply };
  };
}

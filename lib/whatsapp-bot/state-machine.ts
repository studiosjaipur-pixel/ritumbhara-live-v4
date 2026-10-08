import { createHash } from "crypto";
import { findDestination, findProperty, type Catalog } from "./catalog";
import { addDays, daysBetween, formatDisplayDate, todayInIndia, validateCheckIn, validateCheckOut } from "./dates";
import { mergeExtraction } from "./extraction";
import {
  DATE_ERRORS, MESSAGES, askStay, handoffDeliveryFailed, handoffHuman, handoffLimit, handoffQualified, postHandoffAck,
  qualifiedDeliveryFailed,
} from "./messages";
import {
  MAX_REQUIREMENTS_CHARS, detectConfirmAnswer, detectControlKeyword, detectCorrectionTarget, isNoneAnswer, parseMessage,
  type MessageParse,
} from "./parse";
import { CONVERSATION_SCHEMA_VERSION, STORE_TTL } from "./store";
import type {
  AskableField, BotChannel, ConversationState, ConversationStateName, HandoffLead, InboundBodyStatus, LeadFields,
  QualificationOutcome, QualifiedLead, ValidatedExtraction,
} from "./types";

// Deterministic conversation state machine (Week 5 stretch, Phase 3). Pure: no I/O, no AI. Given the stored
// conversation and one incoming message, it returns the new conversation, the reply and any side effects for the
// caller (conversation.ts) to persist. The next question is always "the first required field still missing", so a
// message that answers several things at once skips straight ahead.

export const MAX_BOT_TURNS = 15;
export const MAX_ASKS_PER_FIELD = 2;
// After a handoff, a normal message gets a short acknowledgement at most this often.
export const POST_HANDOFF_ACK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface MachineContext {
  now: Date;
  catalog: Catalog;
  handoffNumber: string; // display form, e.g. "+91 9000000009"
  channel: BotChannel;
}

export interface MachineInput {
  sender: string; // E.164
  text: string; // "" unless bodyStatus is "ok"
  bodyStatus: InboundBodyStatus;
  profileName: string | null;
  // Optional AI fallback values, already validated (extraction.ts). They only fill fields that are still missing;
  // they never change the state logic below.
  extraction?: ValidatedExtraction | null;
}

export interface MachineResult {
  persist: "save" | "delete" | "none";
  conversation: ConversationState | null;
  ttlSeconds: number;
  reply: string | null;
  optOut: "set" | "clear" | null;
  qualifiedLead: QualifiedLead | null; // set only when the guest confirmed (delivered as LEAD_QUALIFIED)
  handoffLead?: HandoffLead | null; // set when handed to the team WITHOUT confirmation (delivered as LEAD_HANDOFF)
}

// ---------- helpers ----------

function emptyFields(): LeadFields {
  return { checkIn: null, checkOut: null, guests: null, guestsHint: null, destination: null, property: null, requirements: null };
}

function freshConversation(input: MachineInput, ctx: MachineContext): ConversationState {
  const nowIso = ctx.now.toISOString();
  return {
    version: CONVERSATION_SCHEMA_VERSION,
    sender: input.sender,
    state: "NEW",
    fields: emptyFields(),
    ref: null,
    prefillSource: "none",
    attempts: {},
    botTurns: 0,
    profileName: input.profileName,
    channel: ctx.channel,
    startedAt: nowIso,
    updatedAt: nowIso,
    leadId: null,
    outcome: null,
    leadDelivered: false,
    lastReminderAt: null,
  };
}

function clone(conv: ConversationState): ConversationState {
  return JSON.parse(JSON.stringify(conv)) as ConversationState;
}

function nothing(): MachineResult {
  return { persist: "none", conversation: null, ttlSeconds: 0, reply: null, optOut: null, qualifiedLead: null };
}

function saved(conv: ConversationState, reply: string | null, extra?: Partial<MachineResult>): MachineResult {
  const ttl = conv.state === "HANDED_OFF" ? STORE_TTL.conversationAfterHandoff : STORE_TTL.conversation;
  return Object.assign({ persist: "save", conversation: conv, ttlSeconds: ttl, reply: reply, optOut: null, qualifiedLead: null }, extra || {}) as MachineResult;
}

function join(parts: string[]): string {
  return parts.filter(function (p) { return !!p; }).join("\n\n");
}

// Stable per conversation (same guest + same conversation start), so a retried delivery carries the same ID.
// Not random and not sequential.
export function leadIdFor(conv: ConversationState): string {
  return "L-" + createHash("sha256").update(conv.sender + "|" + conv.startedAt).digest("hex").slice(0, 10).toUpperCase();
}

export function handoffIdFor(conv: ConversationState): string {
  return "H-" + createHash("sha256").update(conv.sender + "|" + conv.startedAt + "|handoff").digest("hex").slice(0, 10).toUpperCase();
}

// The first required field still missing decides the next state.
export function nextState(fields: LeadFields): ConversationStateName {
  if (!fields.checkIn) return "ASK_DATES";
  if (!fields.checkOut) return "ASK_CHECKOUT";
  if (fields.guests === null) return "ASK_GUESTS";
  if (!fields.destination) return "ASK_STAY";
  if (fields.requirements === null) return "ASK_REQUIREMENTS";
  return "CONFIRM";
}

const FIELD_FOR_STATE: Partial<Record<ConversationStateName, AskableField>> = {
  ASK_DATES: "dates", ASK_CHECKOUT: "checkOut", ASK_GUESTS: "guests", ASK_STAY: "stay", ASK_REQUIREMENTS: "requirements",
};

function question(state: ConversationStateName, fields: LeadFields, ctx: MachineContext): string {
  switch (state) {
    case "ASK_DATES": return fields.checkOut ? MESSAGES.askCheckIn : MESSAGES.askDates;
    case "ASK_CHECKOUT": return MESSAGES.askCheckOut;
    case "ASK_GUESTS": return fields.guestsHint ? MESSAGES.askGuestsExact : MESSAGES.askGuests;
    case "ASK_STAY": return askStay(ctx.catalog);
    case "ASK_REQUIREMENTS": return MESSAGES.askRequirements;
    default: return "";
  }
}

// Deterministic notes for the summary and the lead (facts from the website config only).
export function leadNotes(fields: LeadFields, catalog: Catalog): string[] {
  const notes: string[] = [];
  const property = findProperty(catalog, fields.property);
  if (property && property.maxGuests !== null && fields.guests !== null && fields.guests > property.maxGuests) {
    notes.push(property.name + " is listed for up to " + property.maxGuests + " guests. Our team will advise.");
  }
  const dest = findDestination(catalog, fields.destination);
  if (dest && dest.comingSoon) notes.push(dest.name + " is listed as coming soon on our website.");
  return notes;
}

function stayLabel(fields: LeadFields, catalog: Catalog): string {
  const property = findProperty(catalog, fields.property);
  const dest = findDestination(catalog, fields.destination);
  if (property && dest) return property.name + ", " + dest.name;
  return dest ? dest.name : "";
}

export function summary(fields: LeadFields, catalog: Catalog): string {
  const nights = fields.checkIn && fields.checkOut ? daysBetween(fields.checkIn, fields.checkOut) : 0;
  const lines = [
    "Please confirm your request:",
    "Stay: " + stayLabel(fields, catalog),
    "Check-in: " + (fields.checkIn ? formatDisplayDate(fields.checkIn) : ""),
    "Check-out: " + (fields.checkOut ? formatDisplayDate(fields.checkOut) : "") + " (" + nights + (nights === 1 ? " night)" : " nights)"),
    "Guests: " + fields.guests,
    "Requirements: " + (fields.requirements ? fields.requirements : "None"),
  ];
  const notes = leadNotes(fields, catalog);
  return lines.join("\n") + (notes.length ? "\n\nNote: " + notes.join(" ") : "") + "\n\nIs this correct? Reply YES to confirm or NO to change something.";
}

// Website attribution can pre-fill the property or destination; the guest still confirms everything.
function applyRefPrefill(conv: ConversationState, catalog: Catalog) {
  const ref = conv.ref || "";
  const prop = /^W-PROP-(.+)$/.exec(ref);
  if (prop) {
    const p = findProperty(catalog, prop[1]);
    if (p && !conv.fields.property) {
      conv.fields.property = p.slug;
      conv.fields.destination = p.destinationSlug;
      conv.prefillSource = "property-ref";
    }
    return;
  }
  const dest = /^W-DEST-([a-z]+)(?:-|$)/.exec(ref);
  if (dest) {
    const d = findDestination(catalog, dest[1]);
    if (d && !conv.fields.destination) {
      conv.fields.destination = d.slug;
      conv.prefillSource = "destination-ref";
    }
  }
}

// Applies parsed values (latest answer wins) after validation. Returns error lines and whether anything changed.
function applyParsed(conv: ConversationState, parsed: MessageParse, today: string, catalog: Catalog): { errors: string[]; changed: boolean } {
  const f = conv.fields;
  const errors: string[] = [];
  let changed = false;
  const d = parsed.dates;
  if (d.invalid) errors.push(DATE_ERRORS.invalid_date);
  if (d.ambiguous) errors.push(MESSAGES.ambiguousDate);

  if (d.checkIn) {
    const e = validateCheckIn(d.checkIn, today);
    if (e) errors.push(DATE_ERRORS[e]);
    else {
      f.checkIn = d.checkIn;
      changed = true;
      if (f.checkOut && !d.checkOut && validateCheckOut(f.checkIn, f.checkOut)) f.checkOut = null; // re-ask a now-invalid check-out
    }
  }
  let checkOut = d.checkOut;
  if (!checkOut && d.nights && f.checkIn) checkOut = addDays(f.checkIn, d.nights);
  if (checkOut) {
    const e = f.checkIn ? validateCheckOut(f.checkIn, checkOut) : checkOut <= today ? "checkout_not_after_checkin" : null;
    if (e) errors.push(DATE_ERRORS[e]);
    else {
      f.checkOut = checkOut;
      changed = true;
    }
  }

  if (parsed.guests.invalid) errors.push(MESSAGES.invalidGuests);
  if (parsed.guests.guests !== null) {
    f.guests = parsed.guests.guests;
    f.guestsHint = null;
    changed = true;
  } else if (parsed.guests.hint) {
    f.guestsHint = parsed.guests.hint;
    f.guests = null;
    changed = true;
  }

  const s = parsed.stay;
  if (s.property) {
    f.property = s.property;
    f.destination = s.destination;
    changed = true;
  } else if (s.destination) {
    if (f.property) {
      const p = findProperty(catalog, f.property);
      if (!p || p.destinationSlug !== s.destination) f.property = null; // guest switched destination
    }
    f.destination = s.destination;
    changed = true;
  } else if (s.unknownProperty) {
    errors.push(MESSAGES.unknownProperty);
  }

  if (parsed.requirements !== null) {
    f.requirements = parsed.requirements;
    changed = true;
  }
  return { errors: errors, changed: changed };
}

function handoff(conv: ConversationState, outcome: QualificationOutcome, reply: string, ctx: MachineContext): MachineResult {
  conv.state = "HANDED_OFF";
  conv.outcome = outcome;
  conv.leadId = conv.leadId || leadIdFor(conv);
  conv.botTurns += 1;
  const handoffLead: HandoffLead = {
    handoffId: handoffIdFor(conv),
    reason: outcome === "HUMAN_REQUESTED" ? "HUMAN_REQUESTED" : "NEEDS_FOLLOW_UP",
    channel: conv.channel,
    guestWhatsApp: conv.sender,
    ref: conv.ref,
    fields: JSON.parse(JSON.stringify(conv.fields)) as LeadFields,
    conversationStartedAt: conv.startedAt,
    handedOffAt: ctx.now.toISOString(),
    botTurns: conv.botTurns,
  };
  return saved(conv, reply, { handoffLead: handoffLead });
}

// ---------- delivery outcomes (applied by conversation.ts once the sink has answered) ----------

// Qualified lead: only a successful delivery hands the guest off. Otherwise the conversation stays in CONFIRM
// (same lead ID), so replying YES again retries safely, and the guest is not told the team has it.
export function afterQualifiedDelivery(result: MachineResult, delivered: boolean, ctx: MachineContext): MachineResult {
  const conv = result.conversation;
  if (!conv || !result.qualifiedLead) return result;
  if (delivered) {
    conv.leadDelivered = true;
    return Object.assign({}, result, { conversation: conv, reply: handoffQualified(ctx.handoffNumber) });
  }
  conv.state = "CONFIRM";
  conv.outcome = null;
  conv.leadDelivered = false;
  return Object.assign({}, result, {
    conversation: conv,
    ttlSeconds: STORE_TTL.conversation,
    reply: qualifiedDeliveryFailed(ctx.handoffNumber),
    qualifiedLead: null,
  });
}

// Handoff without confirmation: the guest is handed off either way, but is only told the team will continue
// with them when the team was actually notified.
export function afterHandoffDelivery(result: MachineResult, delivered: boolean, ctx: MachineContext): MachineResult {
  if (!result.handoffLead || !result.conversation) return result;
  result.conversation.leadDelivered = delivered;
  return delivered ? result : Object.assign({}, result, { reply: handoffDeliveryFailed(ctx.handoffNumber) });
}

export function buildQualifiedLead(conv: ConversationState, ctx: MachineContext): QualifiedLead {
  const f = conv.fields;
  return {
    leadId: conv.leadId || leadIdFor(conv),
    outcome: "QUALIFIED",
    channel: conv.channel,
    guestWhatsApp: conv.sender,
    guestName: conv.profileName,
    ref: conv.ref,
    prefillSource: conv.prefillSource,
    fields: JSON.parse(JSON.stringify(f)) as LeadFields,
    nights: f.checkIn && f.checkOut ? daysBetween(f.checkIn, f.checkOut) : null,
    notes: leadNotes(f, ctx.catalog),
    conversationStartedAt: conv.startedAt,
    handedOffAt: ctx.now.toISOString(),
    botTurns: conv.botTurns,
  };
}

// Moves to the next missing field (or the summary), applying the ask limit and the turn limit.
function askNext(conv: ConversationState, prefix: string[], madeProgress: boolean, ctx: MachineContext): MachineResult {
  const target = nextState(conv.fields);
  if (conv.botTurns >= MAX_BOT_TURNS - 1) return handoff(conv, "NEEDS_FOLLOW_UP", handoffLimit(ctx.handoffNumber), ctx);
  if (target === "CONFIRM") {
    conv.state = "CONFIRM";
    conv.botTurns += 1;
    return saved(conv, join(prefix.concat([summary(conv.fields, ctx.catalog)])));
  }
  const field = FIELD_FOR_STATE[target] as AskableField;
  const asked = conv.attempts[field] || 0;
  const repeat = conv.state === target && !madeProgress;
  if (repeat || conv.state !== target) {
    if (asked >= MAX_ASKS_PER_FIELD) return handoff(conv, "NEEDS_FOLLOW_UP", handoffLimit(ctx.handoffNumber), ctx);
    conv.attempts[field] = asked + 1;
  }
  conv.state = target;
  conv.botTurns += 1;
  return saved(conv, join(prefix.concat([question(target, conv.fields, ctx)])));
}

function resetFor(conv: ConversationState, target: ReturnType<typeof detectCorrectionTarget>) {
  const f = conv.fields;
  switch (target) {
    case "dates": f.checkIn = null; f.checkOut = null; conv.attempts.dates = 0; conv.attempts.checkOut = 0; break;
    case "checkIn": f.checkIn = null; conv.attempts.dates = 0; break;
    case "checkOut": f.checkOut = null; conv.attempts.checkOut = 0; break;
    case "guests": f.guests = null; f.guestsHint = null; conv.attempts.guests = 0; break;
    case "stay": f.destination = null; f.property = null; conv.attempts.stay = 0; break;
    case "requirements": f.requirements = null; conv.attempts.requirements = 0; break;
  }
}

function handleConfirm(conv: ConversationState, text: string, parsed: MessageParse, today: string, ctx: MachineContext): MachineResult {
  const answer = detectConfirmAnswer(text);
  if (answer === "YES") {
    conv.outcome = "QUALIFIED";
    conv.leadId = leadIdFor(conv);
    conv.state = "HANDED_OFF"; // QUALIFIED is momentary: the lead is emitted and the guest handed to the team
    conv.botTurns += 1;
    // Pessimistic until the lead is delivered: conversation.ts applies afterQualifiedDelivery() with the result.
    return saved(conv, qualifiedDeliveryFailed(ctx.handoffNumber), { qualifiedLead: buildQualifiedLead(conv, ctx) });
  }
  if (conv.botTurns >= MAX_BOT_TURNS - 1) return handoff(conv, "NEEDS_FOLLOW_UP", handoffLimit(ctx.handoffNumber), ctx);
  if (answer === "NO") {
    conv.botTurns += 1;
    return saved(conv, MESSAGES.askCorrection);
  }
  const target = detectCorrectionTarget(text);
  if (target) {
    resetFor(conv, target);
    return askNext(conv, [], false, ctx);
  }
  if (parsed.foundAny) {
    const applied = applyParsed(conv, parsed, today, ctx.catalog);
    return askNext(conv, applied.errors, applied.changed, ctx);
  }
  const misses = (conv.attempts.confirm || 0) + 1;
  conv.attempts.confirm = misses;
  if (misses >= MAX_ASKS_PER_FIELD) return handoff(conv, "NEEDS_FOLLOW_UP", handoffLimit(ctx.handoffNumber), ctx);
  conv.botTurns += 1;
  return saved(conv, join([MESSAGES.didNotUnderstand, "Reply YES to confirm or NO to change something."]));
}

// ---------- entry point ----------

// Post-handoff acknowledgement, rate-limited with lastReminderAt. The record keeps its original 30-day expiry
// (counted from the handoff, i.e. updatedAt, which nothing after the handoff changes), so acknowledgements never
// extend how long a guest stays handed off. If the team was never notified, the guest is pointed at the team number
// instead of being told the team has the request.
function postHandoffReminder(conv: ConversationState, ctx: MachineContext): MachineResult {
  const nowMs = ctx.now.getTime();
  const last = conv.lastReminderAt ? Date.parse(conv.lastReminderAt) : NaN;
  if (isFinite(last) && last <= nowMs && nowMs - last < POST_HANDOFF_ACK_INTERVAL_MS) return nothing();
  conv.lastReminderAt = ctx.now.toISOString();
  const maxTtl = STORE_TTL.conversationAfterHandoff;
  const handedOffMs = Date.parse(conv.updatedAt);
  const remaining = isFinite(handedOffMs) ? Math.ceil((handedOffMs + maxTtl * 1000 - nowMs) / 1000) : maxTtl;
  const reply = conv.leadDelivered ? postHandoffAck(ctx.handoffNumber) : handoffDeliveryFailed(ctx.handoffNumber);
  return { persist: "save", conversation: conv, ttlSeconds: Math.min(maxTtl, Math.max(1, remaining)), reply: reply, optOut: null, qualifiedLead: null };
}

export function runStateMachine(existing: ConversationState | null, optedOut: boolean, input: MachineInput, ctx: MachineContext): MachineResult {
  const text = input.bodyStatus === "ok" ? input.text : "";
  const keyword = text ? detectControlKeyword(text) : null;

  // Opted out: only START/RESTART does anything.
  if (optedOut && keyword !== "START") return nothing();
  if (keyword === "STOP") {
    return { persist: "delete", conversation: null, ttlSeconds: 0, reply: MESSAGES.optedOut, optOut: "set", qualifiedLead: null };
  }
  if (keyword === "START") {
    const conv = freshConversation(input, ctx);
    conv.ref = "DIRECT";
    const result = askNext(conv, [MESSAGES.greeting], false, ctx);
    if (optedOut) result.optOut = "clear";
    return result;
  }

  const conv = existing && existing.state !== "OPTED_OUT" ? clone(existing) : freshConversation(input, ctx);

  // After a handoff an explicit HUMAN/AGENT gets the team number again; any other message gets a short
  // acknowledgement at most once per 24 hours (and silence otherwise). Qualification never restarts here and no lead
  // is emitted, so nothing is duplicated; only RESTART (handled above) starts a new enquiry.
  if (conv.state === "HANDED_OFF") {
    if (keyword === "AGENT") return { persist: "none", conversation: null, ttlSeconds: 0, reply: handoffHuman(ctx.handoffNumber), optOut: null, qualifiedLead: null };
    return postHandoffReminder(conv, ctx);
  }

  conv.updatedAt = ctx.now.toISOString();
  if (input.profileName) conv.profileName = input.profileName;
  if (keyword === "AGENT") {
    if (!conv.ref) conv.ref = "DIRECT";
    return handoff(conv, "HUMAN_REQUESTED", handoffHuman(ctx.handoffNumber), ctx);
  }

  const isNew = conv.state === "NEW";
  if (input.bodyStatus !== "ok") {
    if (conv.botTurns >= MAX_BOT_TURNS - 1) return handoff(conv, "NEEDS_FOLLOW_UP", handoffLimit(ctx.handoffNumber), ctx);
    if (isNew && !conv.ref) conv.ref = "DIRECT";
    conv.botTurns += 1;
    const msg = input.bodyStatus === "too_long" ? MESSAGES.tooLong : MESSAGES.textRequired;
    return saved(conv, isNew ? join([MESSAGES.greeting, msg]) : msg);
  }

  const today = todayInIndia(ctx.now);
  let parsed = parseMessage(text, ctx.catalog, {
    today: today,
    knownCheckIn: conv.fields.checkIn,
    knownCheckOut: conv.fields.checkOut,
    askingCheckOut: conv.state === "ASK_CHECKOUT",
    bareGuestNumber: conv.state === "ASK_GUESTS",
  });

  if (isNew) {
    if (!conv.ref) conv.ref = parsed.ref || "DIRECT";
    applyRefPrefill(conv, ctx.catalog);
  }

  if (conv.state === "CONFIRM") return handleConfirm(conv, text, parsed, today, ctx);
  if (input.extraction && conv.state !== "ASK_REQUIREMENTS") parsed = mergeExtraction(parsed, input.extraction, conv.fields);

  const applied = applyParsed(conv, parsed, today, ctx.catalog);
  let progress = applied.changed;
  if (conv.state === "ASK_REQUIREMENTS" && !parsed.foundAny) {
    conv.fields.requirements = isNoneAnswer(text) ? "" : parsed.remainder.slice(0, MAX_REQUIREMENTS_CHARS);
    progress = true;
  }
  if (isNew && /-AVAILABILITY$/.test(conv.ref || "") && applied.changed && conv.prefillSource === "none") {
    conv.prefillSource = "website-availability";
  }

  const prefix: string[] = [];
  if (isNew) {
    prefix.push(MESSAGES.greeting);
    if (applied.changed || conv.prefillSource !== "none") prefix.push(MESSAGES.notedDetails);
  } else if (!progress && applied.errors.length === 0) {
    prefix.push(MESSAGES.didNotUnderstand);
  }
  return askNext(conv, prefix.concat(applied.errors), progress, ctx);
}

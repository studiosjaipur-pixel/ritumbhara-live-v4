import { findProperty, type Catalog } from "./catalog";
import { parseDates, todayInIndia, validateCheckIn, validateCheckOut } from "./dates";
import {
  MAX_GUESTS, MAX_REQUIREMENTS_CHARS, MIN_GUESTS, detectConfirmAnswer, detectControlKeyword, detectCorrectionTarget,
  normalizeForKeywords, parseMessage, type MessageParse,
} from "./parse";
import type {
  ConversationState, ConversationStateName, ExtractionIntent, ExtractionRequestContext, LeadFields, RawExtraction, ValidatedExtraction,
} from "./types";

// Deterministic side of the AI fallback (Week 5 stretch, Phase 4). No network calls here.
//   shouldExtract()      decides whether a message is worth sending to the AI at all
//   buildRequestContext() the minimal, non-personal context the AI sees
//   validateExtraction() checks every AI value against the website catalog and the deterministic date/guest rules
//   mergeExtraction()    fills ONLY fields the deterministic parser and the conversation do not already have
// The AI never decides state, qualification, confirmation or handoff, and never writes customer-facing text.

const INTENTS: ExtractionIntent[] = ["booking_inquiry", "availability_inquiry", "general_question", "correction", "confirmation", "human_request", "other"];
const GREETING = /^(hi+|hello+|hey+|hiya|namaste|namaskar|good (morning|afternoon|evening)|hi there|hello there|ok|okay|thanks|thank you)$/;
// States in which a missing field may be filled with help from the AI.
const COLLECTING: ConversationStateName[] = ["NEW", "ASK_DATES", "ASK_CHECKOUT", "ASK_GUESTS", "ASK_STAY"];

function emptyFields(): LeadFields {
  return { checkIn: null, checkOut: null, guests: null, guestsHint: null, destination: null, property: null, requirements: null };
}

export interface ExtractionPlan {
  state: ConversationStateName;
  fields: LeadFields;
  today: string;
}

// The same parse the state machine will run, so the decision matches what the state machine sees.
export function deterministicParse(text: string, state: ConversationStateName, fields: LeadFields, catalog: Catalog, today: string): MessageParse {
  return parseMessage(text, catalog, {
    today: today,
    knownCheckIn: fields.checkIn,
    knownCheckOut: fields.checkOut,
    askingCheckOut: state === "ASK_CHECKOUT",
    bareGuestNumber: state === "ASK_GUESTS",
  });
}

// Returns a plan when the AI may help, or null when the deterministic layer already has the answer (or the message
// is a command, a greeting, a website template, or arrives in a state where the AI is never used).
export function shouldExtract(existing: ConversationState | null, optedOut: boolean, text: string, bodyStatus: string, catalog: Catalog, now: Date): ExtractionPlan | null {
  if (optedOut || bodyStatus !== "ok" || !text) return null;
  if (detectControlKeyword(text) || detectConfirmAnswer(text) || detectCorrectionTarget(text)) return null;
  const state: ConversationStateName = existing && existing.state !== "OPTED_OUT" ? existing.state : "NEW";
  if (COLLECTING.indexOf(state) === -1) return null; // never in CONFIRM, ASK_REQUIREMENTS, HANDED_OFF
  const normalized = normalizeForKeywords(text);
  if (GREETING.test(normalized) || normalized.length < 3 || !/[a-z]/.test(normalized)) return null;
  if (/\bref\s*:\s*W-/i.test(text)) return null; // website pre-filled messages are parsed deterministically

  const fields = existing && existing.state !== "OPTED_OUT" ? existing.fields : emptyFields();
  const today = todayInIndia(now);
  const parsed = deterministicParse(text, state, fields, catalog, today);
  const plan: ExtractionPlan = { state: state, fields: fields, today: today };
  if (parsed.dates.ambiguous) return plan;
  if (parsed.dates.invalid || parsed.guests.invalid || parsed.stay.unknownProperty) return null; // deterministic answer exists

  const hasCheckIn = !!(fields.checkIn || parsed.dates.checkIn);
  const hasCheckOut = !!(fields.checkOut || parsed.dates.checkOut || (parsed.dates.nights && hasCheckIn));
  const hasGuests = fields.guests !== null || parsed.guests.guests !== null;
  const hasStay = !!(fields.destination || parsed.stay.destination || parsed.stay.property);
  switch (state) {
    case "NEW": return hasCheckIn && hasCheckOut && hasGuests && hasStay ? null : plan;
    case "ASK_DATES": return hasCheckIn ? null : plan;
    case "ASK_CHECKOUT": return hasCheckOut ? null : plan;
    case "ASK_GUESTS": return hasGuests || !!parsed.guests.hint ? null : plan;
    case "ASK_STAY": return hasStay ? null : plan;
    default: return null;
  }
}

export function buildRequestContext(plan: ExtractionPlan, catalog: Catalog): ExtractionRequestContext {
  const f = plan.fields;
  return {
    todayIst: plan.today,
    currentStep: plan.state,
    known: { checkIn: f.checkIn, checkOut: f.checkOut, guests: f.guests, destination: f.destination, property: f.property },
    destinations: catalog.destinations.map(function (d) { return d.name; }),
    properties: catalog.properties.map(function (p) { return p.name; }),
  };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchDestination(value: string | null, catalog: Catalog): string | null {
  if (!value) return null;
  const v = norm(value);
  const d = catalog.destinations.filter(function (x) { return norm(x.name) === v || x.slug === v; })[0];
  return d ? d.slug : null;
}

function matchProperty(value: string | null, catalog: Catalog): string | null {
  if (!value) return null;
  const v = norm(value);
  const p = catalog.properties.filter(function (x) { return norm(x.name) === v || norm(x.slug) === v || (!!x.key && x.key === v); })[0];
  return p ? p.slug : null;
}

// Requirements are accepted only as a verbatim excerpt of the guest's own message, so the AI cannot invent a service
// and AI-written text can never be echoed back to the guest.
function groundedRequirements(value: string | null, message: string): string | null {
  if (!value) return null;
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const haystack = message.replace(/\s+/g, " ").toLowerCase();
  if (haystack.indexOf(clean.toLowerCase()) === -1) return null;
  return clean.slice(0, MAX_REQUIREMENTS_CHARS);
}

// Every AI value is re-checked; an invalid field becomes null without discarding the others.
export function validateExtraction(raw: RawExtraction, message: string, plan: ExtractionPlan, catalog: Catalog): ValidatedExtraction {
  const today = plan.today;

  let checkIn: string | null = null;
  if (raw.checkIn) {
    const r = parseDates(raw.checkIn, { today: today, knownCheckIn: null, knownCheckOut: null, askingCheckOut: false });
    if (r.checkIn && !r.checkOut && !r.invalid && !r.ambiguous && !validateCheckIn(r.checkIn, today)) checkIn = r.checkIn;
  }

  let checkOut: string | null = null;
  const base = checkIn || plan.fields.checkIn;
  if (raw.checkOut) {
    const r = parseDates(raw.checkOut, { today: today, knownCheckIn: base, knownCheckOut: null, askingCheckOut: true });
    if (r.checkOut && !r.checkIn && !r.invalid && !r.ambiguous) {
      const ok = base ? !validateCheckOut(base, r.checkOut) : r.checkOut > today;
      if (ok) checkOut = r.checkOut;
    }
  }

  const g = raw.guests;
  const guests = typeof g === "number" && Number.isInteger(g) && g >= MIN_GUESTS && g <= MAX_GUESTS ? g : null;

  const property = matchProperty(raw.property, catalog);
  const prop = findProperty(catalog, property);
  const destination = prop ? prop.destinationSlug : matchDestination(raw.destination, catalog);

  const intent = raw.intent && (INTENTS as string[]).indexOf(raw.intent) !== -1 ? (raw.intent as ExtractionIntent) : null;

  return {
    checkIn: checkIn,
    checkOut: checkOut,
    guests: guests,
    destination: destination,
    property: property,
    requirements: groundedRequirements(raw.requirements, message),
    intent: intent,
  };
}

export function countExtractedFields(ex: ValidatedExtraction): number {
  return [ex.checkIn, ex.checkOut, ex.guests, ex.destination, ex.property, ex.requirements].filter(function (v) { return v !== null; }).length;
}

// Deterministic value > AI value. AI values only fill fields that neither the parser (this message) nor the
// conversation (earlier messages) already have.
export function mergeExtraction(parsed: MessageParse, ex: ValidatedExtraction, fields: LeadFields): MessageParse {
  const out: MessageParse = JSON.parse(JSON.stringify(parsed));
  const d = out.dates;
  if (!d.checkIn && !fields.checkIn && ex.checkIn) d.checkIn = ex.checkIn;
  if (!d.checkOut && !d.nights && !fields.checkOut && ex.checkOut) d.checkOut = ex.checkOut;
  if (d.ambiguous && (d.checkIn || d.checkOut)) d.ambiguous = false;

  const g = out.guests;
  if (g.guests === null && !g.invalid && !g.hint && fields.guests === null && ex.guests !== null) g.guests = ex.guests;

  const s = out.stay;
  if (!s.property && !s.destination && !s.unknownProperty && !fields.destination) {
    if (ex.property) { s.property = ex.property; s.destination = ex.destination; }
    else if (ex.destination) s.destination = ex.destination;
  }

  if (out.requirements === null && fields.requirements === null && ex.requirements) out.requirements = ex.requirements;

  out.foundAny = !!(s.property || s.destination || s.unknownProperty || d.checkIn || d.checkOut || d.invalid || d.ambiguous ||
    d.nights || g.guests !== null || g.invalid || g.hint || out.requirements !== null);
  return out;
}

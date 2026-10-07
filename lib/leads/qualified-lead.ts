import { WHATSAPP_REF_PATTERN } from "../whatsapp";
import { findDestination, findProperty, type Catalog } from "../whatsapp-bot/catalog";
import { daysBetween, isoFromParts, MAX_NIGHTS } from "../whatsapp-bot/dates";
import type { BotChannel, HandoffLead, LeadFields, QualifiedLead } from "../whatsapp-bot/types";

// Wire payloads for WhatsApp-bot leads (Week 5 stretch, Phase 5) and their validation. Pure functions, no I/O.
// Everything sent to the Google Sheet is rebuilt here from validated conversation fields: destination/property
// names come from the website config, nights are recalculated from the dates, and nothing else (no transcript,
// no Redis data, no credentials, no AI output) is included.

export const MAX_REQUIREMENTS_CHARS = 300;
const LEAD_ID = /^L-[0-9A-F]{10}$/;
const HANDOFF_ID = /^H-[0-9A-F]{10}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

export type LeadSource = "whatsapp-bot" | "whatsapp-bot-sandbox";

export interface LeadContext {
  catalog: Catalog;
  site: string; // host of the website, e.g. "ritumbhara.com"
  handoffNumber: string; // display form of the team number given to the guest
  now: Date;
}

export interface QualifiedLeadPayload {
  leadId: string;
  timestamp: string; // when the guest confirmed (ISO)
  phone: string; // guest WhatsApp number, E.164
  destination: string; // destination name from the website config
  property: string | null; // property name from the website config
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number; // recalculated from the dates
  guests: number;
  requirements: string; // "" when none
  ref: string; // website attribution or "DIRECT"
  source: LeadSource;
  conversationState: "HANDED_OFF";
  qualificationStatus: "QUALIFIED";
  site: string;
  receivedAt: string; // when the website sent it (ISO)
  handoffNumber: string;
  notes: string[]; // deterministic notes from the website config (capacity, coming-soon destination)
}

export interface HandoffPayload {
  handoffId: string;
  timestamp: string;
  phone: string;
  reason: "HUMAN_REQUESTED" | "NEEDS_FOLLOW_UP";
  destination: string | null;
  property: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  guests: number | null;
  requirements: string | null;
  ref: string;
  source: LeadSource;
  conversationState: "HANDED_OFF";
  qualificationStatus: "NOT_QUALIFIED";
  site: string;
  receivedAt: string;
  handoffNumber: string;
}

export type BuildResult<T> = { ok: true; payload: T } | { ok: false; problems: string[] };

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isoFromParts(+value.slice(0, 4), +value.slice(5, 7), +value.slice(8, 10)) === value;
}

function cleanRef(ref: string | null): string {
  return ref && (ref === "DIRECT" || WHATSAPP_REF_PATTERN.test(ref)) ? ref : "DIRECT";
}

function sourceFor(channel: BotChannel): LeadSource {
  return channel === "production" ? "whatsapp-bot" : "whatsapp-bot-sandbox";
}

function cleanRequirements(value: string | null): string | null {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function capacityNotes(fields: LeadFields, catalog: Catalog): string[] {
  const notes: string[] = [];
  const property = findProperty(catalog, fields.property);
  if (property && property.maxGuests !== null && fields.guests !== null && fields.guests > property.maxGuests) {
    notes.push(property.name + " is listed for up to " + property.maxGuests + " guests.");
  }
  const dest = findDestination(catalog, fields.destination);
  if (dest && dest.comingSoon) notes.push(dest.name + " is listed as coming soon on the website.");
  return notes;
}

// Strict: every rule must hold, otherwise nothing is sent.
export function buildQualifiedLeadPayload(lead: QualifiedLead, ctx: LeadContext): BuildResult<QualifiedLeadPayload> {
  const problems: string[] = [];
  const f = lead.fields;
  if (lead.outcome !== "QUALIFIED") problems.push("status");
  if (!LEAD_ID.test(lead.leadId || "")) problems.push("leadId");
  if (!E164.test(lead.guestWhatsApp || "")) problems.push("phone");
  const dest = findDestination(ctx.catalog, f.destination);
  if (!dest) problems.push("destination");
  const property = f.property ? findProperty(ctx.catalog, f.property) : null;
  if (f.property && (!property || (dest && property.destinationSlug !== dest.slug))) problems.push("property");
  let nights = 0;
  if (!isIsoDate(f.checkIn) || !isIsoDate(f.checkOut)) problems.push("dates");
  else {
    nights = daysBetween(f.checkIn, f.checkOut);
    if (nights < 1 || nights > MAX_NIGHTS) problems.push("nights");
  }
  if (typeof f.guests !== "number" || !Number.isInteger(f.guests) || f.guests < 1 || f.guests > 20) problems.push("guests");
  const requirements = cleanRequirements(f.requirements);
  if (requirements === null || requirements.length > MAX_REQUIREMENTS_CHARS) problems.push("requirements");
  if (problems.length > 0 || !dest) return { ok: false, problems: problems };
  return {
    ok: true,
    payload: {
      leadId: lead.leadId,
      timestamp: lead.handedOffAt,
      phone: lead.guestWhatsApp,
      destination: dest.name,
      property: property ? property.name : null,
      checkIn: f.checkIn as string,
      checkOut: f.checkOut as string,
      nights: nights,
      guests: f.guests as number,
      requirements: requirements as string,
      ref: cleanRef(lead.ref),
      source: sourceFor(lead.channel),
      conversationState: "HANDED_OFF",
      qualificationStatus: "QUALIFIED",
      site: ctx.site,
      receivedAt: ctx.now.toISOString(),
      handoffNumber: ctx.handoffNumber,
      notes: capacityNotes(f, ctx.catalog),
    },
  };
}

// Lenient per field: a handoff may be incomplete, so each invalid field becomes null instead of blocking it.
export function buildHandoffPayload(h: HandoffLead, ctx: LeadContext): BuildResult<HandoffPayload> {
  const problems: string[] = [];
  if (!HANDOFF_ID.test(h.handoffId || "")) problems.push("handoffId");
  if (!E164.test(h.guestWhatsApp || "")) problems.push("phone");
  if (h.reason !== "HUMAN_REQUESTED" && h.reason !== "NEEDS_FOLLOW_UP") problems.push("reason");
  if (problems.length > 0) return { ok: false, problems: problems };
  const f = h.fields;
  const dest = findDestination(ctx.catalog, f.destination);
  const property = f.property ? findProperty(ctx.catalog, f.property) : null;
  const checkIn = isIsoDate(f.checkIn) ? f.checkIn : null;
  const checkOut = isIsoDate(f.checkOut) ? f.checkOut : null;
  const nights = checkIn && checkOut ? daysBetween(checkIn, checkOut) : null;
  const requirements = cleanRequirements(f.requirements);
  return {
    ok: true,
    payload: {
      handoffId: h.handoffId,
      timestamp: h.handedOffAt,
      phone: h.guestWhatsApp,
      reason: h.reason,
      destination: dest ? dest.name : null,
      property: property && (!dest || property.destinationSlug === dest.slug) ? property.name : null,
      checkIn: checkIn,
      checkOut: nights !== null && nights >= 1 && nights <= MAX_NIGHTS ? checkOut : null,
      nights: nights !== null && nights >= 1 && nights <= MAX_NIGHTS ? nights : null,
      guests: typeof f.guests === "number" && Number.isInteger(f.guests) && f.guests >= 1 && f.guests <= 20 ? f.guests : null,
      requirements: requirements ? requirements.slice(0, MAX_REQUIREMENTS_CHARS) : null,
      ref: cleanRef(h.ref),
      source: sourceFor(h.channel),
      conversationState: "HANDED_OFF",
      qualificationStatus: "NOT_QUALIFIED",
      site: ctx.site,
      receivedAt: ctx.now.toISOString(),
      handoffNumber: ctx.handoffNumber,
    },
  };
}

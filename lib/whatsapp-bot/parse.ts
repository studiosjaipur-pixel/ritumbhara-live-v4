import { WHATSAPP_REF_PATTERN } from "../whatsapp";
import type { Catalog } from "./catalog";
import { NUMBER_WORD_RE, numberFromWord, parseDates, type DateParseContext, type DateParseResult } from "./dates";

// Deterministic parsing of one guest message (Week 5 stretch, Phase 3). No AI. Produces candidate values only;
// the state machine validates them and decides what happens next.

export const MAX_REQUIREMENTS_CHARS = 300;
export const MIN_GUESTS = 1;
export const MAX_GUESTS = 20;

export type ControlKeyword = "STOP" | "START" | "AGENT";
export type ConfirmAnswer = "YES" | "NO";
export type CorrectionTarget = "dates" | "checkIn" | "checkOut" | "guests" | "stay" | "requirements";

// Lower-case, single spaces, without trailing punctuation: how whole-message keywords are compared.
export function normalizeForKeywords(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
}

// Control words count only as the whole message ("please don't stop" is not STOP).
export function detectControlKeyword(text: string): ControlKeyword | null {
  const t = normalizeForKeywords(text);
  if (t === "stop" || t === "unsubscribe") return "STOP";
  if (t === "start" || t === "restart") return "START";
  if (t === "agent" || t === "human") return "AGENT";
  return null;
}

export function detectConfirmAnswer(text: string): ConfirmAnswer | null {
  const t = normalizeForKeywords(text);
  if (t === "yes" || t === "y" || t === "correct" || t === "confirm") return "YES";
  if (t === "no" || t === "n" || t === "change" || t === "wrong") return "NO";
  return null;
}

// "dates", "change guests", "check-in" ... as a whole message (used after the guest says NO).
export function detectCorrectionTarget(text: string): CorrectionTarget | null {
  const m = /^(?:change\s+(?:the\s+)?|edit\s+(?:the\s+)?)?(dates?|check[\s-]?in(?: date)?|check[\s-]?out(?: date)?|guests?|people|number of guests|stay|destination|property|location|requirements?|notes?|preferences?)$/.exec(normalizeForKeywords(text));
  if (!m) return null;
  const w = m[1];
  if (/^dates?$/.test(w)) return "dates";
  if (/^check[\s-]?in/.test(w)) return "checkIn";
  if (/^check[\s-]?out/.test(w)) return "checkOut";
  if (/guest|people/.test(w)) return "guests";
  if (/stay|destination|property|location/.test(w)) return "stay";
  return "requirements";
}

export function isNoneAnswer(text: string): boolean {
  return /^(no|none|nothing|nope|nil|na|n\/a|skip|no thanks|no requirements?|nothing special|not really)$/.test(normalizeForKeywords(text));
}

// Website attribution: the last "Ref: W-..." in the message, validated against the website's ref pattern.
export function extractRef(text: string): { ref: string | null; rest: string } {
  let ref: string | null = null;
  const rest = text.replace(/\bref\s*:\s*(W-[A-Za-z0-9-]{1,80})/gi, function (_all, code: string) {
    if (WHATSAPP_REF_PATTERN.test(code)) ref = code;
    return " ";
  });
  return { ref: ref, rest: rest };
}

function mask(text: string, spans: Array<[number, number]>): string {
  let out = text;
  spans.forEach(function (s) { out = out.slice(0, s[0]) + " ".repeat(s[1] - s[0]) + out.slice(s[1]); });
  return out;
}

// ---------- stay ----------

export interface StayParse {
  property: string | null; // property slug
  destination: string | null; // destination slug
  unknownProperty: boolean; // looked like a property ("Studio 999") but is not in the website's list
  spans: Array<[number, number]>;
}

export function parseStay(text: string, catalog: Catalog): StayParse {
  const result: StayParse = { property: null, destination: null, unknownProperty: false, spans: [] };
  const lower = text.toLowerCase();
  // "Studio 925", "studio-925", "studio #925"
  const re = /\b(studio|apartment|apt|villa)\s*(?:-|#|no\.?|number)?\s*(\d{2,5})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    const type = m[1] === "apt" ? "apartment" : m[1];
    const key = type + " " + m[2];
    const match = catalog.properties.filter(function (p) { return p.key === key; })[0];
    result.spans.push([m.index, m.index + m[0].length]);
    if (match && !result.property) result.property = match.slug;
    else if (!match) result.unknownProperty = true;
  }
  if (result.property) result.unknownProperty = false;
  catalog.destinations.forEach(function (d) {
    const dm = new RegExp("\\b" + d.name.toLowerCase() + "\\b").exec(lower);
    if (dm) {
      if (!result.destination) result.destination = d.slug;
      result.spans.push([dm.index, dm.index + dm[0].length]);
    }
  });
  if (result.property) {
    const p = catalog.properties.filter(function (x) { return x.slug === result.property; })[0];
    result.destination = p.destinationSlug; // the property decides the destination
  }
  return result;
}

// ---------- guests ----------

export interface GuestParse {
  guests: number | null; // within 1-20
  invalid: boolean; // a guest count was given but is outside 1-20
  hint: string | null; // "6+" (at least six, exact number unknown)
}

export function parseGuests(text: string, bareNumberAllowed: boolean): GuestParse {
  const t = text.toLowerCase();
  const n = NUMBER_WORD_RE;
  const plus = /\b(\d{1,2})\s*\+\s*(?:guests?|people|persons?|pax|adults?)\b/.exec(t) || (bareNumberAllowed ? /^\s*(\d{1,2})\s*\+\s*$/.exec(t) : null);
  if (plus) return { guests: null, invalid: false, hint: plus[1] + "+" };
  // "2 adults and 1 child" -> 3
  const family = new RegExp("\\b" + n + "\\s*adults?\\b.*?\\b" + n + "\\s*(?:child|children|kids?)\\b").exec(t);
  if (family) {
    const total = numberFromWord(family[1]) + numberFromWord(family[2]);
    if (total >= MIN_GUESTS && total <= MAX_GUESTS) return { guests: total, invalid: false, hint: null };
    return { guests: null, invalid: true, hint: null };
  }
  const patterns = [
    new RegExp("\\b" + n + "\\s*(?:guests?|people|persons?|pax|adults?|ppl|travell?ers|of us)\\b"),
    new RegExp("\\b(?:guests?|people|pax|persons?|adults?)\\s*(?:to|=|:|is|are|will be|should be|of)?\\s*" + n + "\\b"),
    new RegExp("\\bwe\\s*(?:are|'re|r)\\s*" + n + "\\b"),
    new RegExp("\\b(?:party|group)\\s+of\\s+" + n + "\\b"),
  ];
  let value: number | null = null;
  for (let i = 0; i < patterns.length && value === null; i++) {
    const m = patterns[i].exec(t);
    if (m) value = numberFromWord(m[1]);
  }
  if (value === null && /\b(just me|only me|myself|solo|alone)\b/.test(t)) value = 1;
  if (value === null && /\b(a couple|couple|me and my (wife|husband|partner))\b/.test(t)) value = 2;
  if (value === null && bareNumberAllowed) {
    const bare = new RegExp("^\\s*" + n + "\\s*$").exec(t.replace(/[.!,]+/g, " "));
    if (bare) value = numberFromWord(bare[1]);
  }
  if (value === null || isNaN(value)) return { guests: null, invalid: false, hint: null };
  if (value < MIN_GUESTS || value > MAX_GUESTS) return { guests: null, invalid: true, hint: null };
  return { guests: value, invalid: false, hint: null };
}

// ---------- whole message ----------

export interface MessageParse {
  ref: string | null;
  stay: StayParse;
  dates: DateParseResult;
  guests: GuestParse;
  requirements: string | null; // explicit "requirements: ..." text
  remainder: string; // text left after removing the ref (for free-text requirements)
  foundAny: boolean; // any structured value (stay, date, guests, nights, explicit requirements) was found
}

export interface ParseContext extends DateParseContext {
  bareGuestNumber: boolean; // the bot just asked for the number of guests
}

export function parseMessage(text: string, catalog: Catalog, ctx: ParseContext): MessageParse {
  const refPart = extractRef(text);
  let work = refPart.rest;
  let requirements: string | null = null;
  const req = /\b(?:requirements?|special requests?|preferences?|notes?)\s*[:=-]\s*(.+)$/i.exec(work);
  if (req) {
    requirements = req[1].trim().slice(0, MAX_REQUIREMENTS_CHARS);
    work = work.slice(0, req.index);
  }
  const stay = parseStay(work, catalog);
  work = mask(work, stay.spans);
  const dates = parseDates(work, ctx);
  work = mask(work, dates.spans);
  const guests = parseGuests(work, ctx.bareGuestNumber);
  const foundAny = !!(stay.property || stay.destination || stay.unknownProperty || dates.checkIn || dates.checkOut ||
    dates.invalid || dates.ambiguous || dates.nights || guests.guests !== null || guests.invalid || guests.hint || requirements !== null);
  return { ref: refPart.ref, stay: stay, dates: dates, guests: guests, requirements: requirements, remainder: refPart.rest.trim(), foundAny: foundAny };
}

// Deterministic date parsing and validation for the WhatsApp bot (Week 5 stretch, Phase 3). No AI.
// Dates are ISO strings (YYYY-MM-DD) in India time. Numeric dates are read day-first (10/12 = 10 December), as
// written in India; the confirmation summary spells the month out so the guest can correct a misreading.
// Anything ambiguous (e.g. "the 12th" with no month) is not guessed.

export const MAX_CHECKIN_DAYS_AHEAD = 365;
export const MAX_NIGHTS = 90;
const IST_OFFSET_MS = 330 * 60 * 1000;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY_RE = "(\\d{1,2})(?:st|nd|rd|th)?";
const YEAR_RE = "(?:,?\\s*(\\d{4}))?";
const RANGE_SEP = "\\s*(?:-|–|to|till|until)\\s*";

export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};
export const NUMBER_WORD_RE = "(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)";

export function numberFromWord(token: string): number {
  const t = token.toLowerCase();
  return /^\d+$/.test(t) ? parseInt(t, 10) : NUMBER_WORDS[t] || NaN;
}

function pad(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

export function isoFromParts(y: number, m: number, d: number): string | null {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null; // e.g. 31 Feb
  return y + "-" + pad(m) + "-" + pad(d);
}

function toUtc(iso: string): number {
  return Date.UTC(parseInt(iso.slice(0, 4), 10), parseInt(iso.slice(5, 7), 10) - 1, parseInt(iso.slice(8, 10), 10));
}

export function todayInIndia(now: Date): string {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}

export function addDays(iso: string, days: number): string {
  const d = new Date(toUtc(iso) + days * 86400000);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86400000);
}

// "2026-11-12" -> "Thu 12 Nov 2026"
export function formatDisplayDate(iso: string): string {
  const d = new Date(toUtc(iso));
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return days[d.getUTCDay()] + " " + d.getUTCDate() + " " + months[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

// ---------- validation ----------

export type DateError = "invalid_date" | "checkin_past" | "checkin_too_far" | "checkout_not_after_checkin" | "stay_too_long";

export function validateCheckIn(checkIn: string, today: string): DateError | null {
  if (checkIn < today) return "checkin_past";
  if (daysBetween(today, checkIn) > MAX_CHECKIN_DAYS_AHEAD) return "checkin_too_far";
  return null;
}

export function validateCheckOut(checkIn: string, checkOut: string): DateError | null {
  const nights = daysBetween(checkIn, checkOut);
  if (nights < 1) return "checkout_not_after_checkin";
  if (nights > MAX_NIGHTS) return "stay_too_long";
  return null;
}

// ---------- parsing ----------

type Role = "in" | "out" | null;

interface Mention {
  start: number;
  end: number;
  day: number;
  month: number;
  year: number | null; // null = not written
  role: Role; // fixed role for ranges ("10-13 Dec"); otherwise decided from the words before it
  fixedIso?: string; // today / tomorrow
}

export interface DateParseContext {
  today: string;
  knownCheckIn: string | null;
  knownCheckOut: string | null;
  askingCheckOut: boolean; // the bot's last question was the check-out date
}

export interface DateParseResult {
  checkIn: string | null; // ISO, not yet validated against today/limits
  checkOut: string | null;
  invalid: boolean; // a date was written but does not exist (e.g. 31 Feb), or an explicit year is unusable
  ambiguous: boolean; // a single date whose role (check-in or check-out) cannot be told
  nights: number | null;
  spans: Array<[number, number]>; // text ranges consumed (so numbers inside dates are not read as guests)
}

function monthIndex(token: string): number {
  return MONTHS.indexOf(token.slice(0, 3).toLowerCase()) + 1;
}

function yearOf(token: string | undefined): number | null {
  if (!token) return null;
  const y = parseInt(token, 10);
  return token.length === 2 ? 2000 + y : y;
}

function collectMentions(text: string): { mentions: Mention[]; spans: Array<[number, number]> } {
  const found: Mention[] = [];
  const taken: Array<[number, number]> = [];
  function free(s: number, e: number) {
    return taken.every(function (t) { return e <= t[0] || s >= t[1]; });
  }
  function scan(pattern: string, build: (m: RegExpExecArray) => Mention[] | null) {
    const re = new RegExp(pattern, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m.index, e = m.index + m[0].length;
      if (!free(s, e)) continue;
      const built = build(m);
      if (!built) continue;
      taken.push([s, e]);
      built.forEach(function (b) { found.push(b); });
    }
  }
  // ISO 2026-12-10
  scan("\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b", function (m) {
    return [{ start: m.index, end: m.index + m[0].length, year: +m[1], month: +m[2], day: +m[3], role: null }];
  });
  // 10-13 Dec [2026]
  scan("\\b" + DAY_RE + RANGE_SEP + DAY_RE + "\\s+(?:of\\s+)?" + MONTH_RE + "\\b" + YEAR_RE, function (m) {
    const s = m.index, e = s + m[0].length, mo = monthIndex(m[3]), y = yearOf(m[4]);
    return [{ start: s, end: s + 1, day: +m[1], month: mo, year: y, role: "in" }, { start: e - 1, end: e, day: +m[2], month: mo, year: y, role: "out" }];
  });
  // Dec 10-13 [2026]
  scan("\\b" + MONTH_RE + "\\s+" + DAY_RE + RANGE_SEP + DAY_RE + "\\b" + YEAR_RE, function (m) {
    const s = m.index, e = s + m[0].length, mo = monthIndex(m[1]), y = yearOf(m[4]);
    return [{ start: s, end: s + 1, day: +m[2], month: mo, year: y, role: "in" }, { start: e - 1, end: e, day: +m[3], month: mo, year: y, role: "out" }];
  });
  // 10 Dec [2026] / 10th of December
  scan("\\b" + DAY_RE + "\\s+(?:of\\s+)?" + MONTH_RE + "\\b" + YEAR_RE, function (m) {
    return [{ start: m.index, end: m.index + m[0].length, day: +m[1], month: monthIndex(m[2]), year: yearOf(m[3]), role: null }];
  });
  // Dec 10 [2026] / December 10th, 2026
  scan("\\b" + MONTH_RE + "\\s+" + DAY_RE + "\\b" + YEAR_RE, function (m) {
    return [{ start: m.index, end: m.index + m[0].length, month: monthIndex(m[1]), day: +m[2], year: yearOf(m[3]), role: null }];
  });
  // 10/12, 10/12/2026, 10.12.26, 10-12-2026 (day first)
  scan("\\b(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2}|\\d{4}))?\\b|\\b(\\d{1,2})-(\\d{1,2})-(\\d{4})\\b", function (m) {
    const d = m[1] || m[4], mo = m[2] || m[5], y = m[3] || m[6];
    return [{ start: m.index, end: m.index + m[0].length, day: +d, month: +mo, year: yearOf(y), role: null }];
  });
  // today / tomorrow
  scan("\\b(today|tonight|tomorrow)\\b", function (m) {
    return [{ start: m.index, end: m.index + m[0].length, day: 0, month: 0, year: null, role: null, fixedIso: m[1].toLowerCase() }];
  });
  found.sort(function (a, b) { return a.start - b.start; });
  return { mentions: found, spans: taken };
}

const STRONG_IN = /check[\s-]?in|checking\s+in|arriv/i;
const STRONG_OUT = /check[\s-]?out|checking\s+out|leav|depart/i;
// Weak cues only count right before the date ("from 10 Dec", "to 13 Dec"), so "I want to come on 10 Dec" is not
// read as a check-out.
const WEAK_IN = /\bfrom\s+(?:the\s+)?$/i;
const WEAK_OUT = /\b(?:to|till|until)\s+(?:the\s+)?$/i;

function cue(window: string): Role {
  const strongIn = STRONG_IN.test(window), strongOut = STRONG_OUT.test(window);
  if (strongIn !== strongOut) return strongIn ? "in" : "out";
  if (strongIn && strongOut) return null;
  const weakIn = WEAK_IN.test(window), weakOut = WEAK_OUT.test(window);
  if (weakIn !== weakOut) return weakIn ? "in" : "out";
  return null;
}

// Resolves a date without a year to its next occurrence strictly after `after` (or on/after when inclusive).
function resolve(m: Mention, after: string, inclusive: boolean, today: string): string | null {
  if (m.fixedIso) return m.fixedIso === "tomorrow" ? addDays(today, 1) : today;
  if (m.year !== null) return isoFromParts(m.year, m.month, m.day);
  const startYear = parseInt(after.slice(0, 4), 10);
  for (let y = startYear; y <= startYear + 1; y++) {
    const iso = isoFromParts(y, m.month, m.day);
    if (!iso) {
      if (m.month === 2 && m.day === 29) continue; // try the next leap year only within the window
      return null;
    }
    if (inclusive ? iso >= after : iso > after) return iso;
  }
  return null;
}

export function parseDates(text: string, ctx: DateParseContext): DateParseResult {
  const result: DateParseResult = { checkIn: null, checkOut: null, invalid: false, ambiguous: false, nights: null, spans: [] };
  const collected = collectMentions(text);
  const mentions = collected.mentions;

  const nightsMatch = new RegExp("\\b" + NUMBER_WORD_RE + "\\s*nights?\\b", "i").exec(text);
  if (nightsMatch) {
    const n = numberFromWord(nightsMatch[1]);
    if (n >= 1) result.nights = n;
    result.spans.push([nightsMatch.index, nightsMatch.index + nightsMatch[0].length]);
  }
  if (mentions.length === 0) return result;

  // Decide roles: fixed (ranges), then words before each date, then position.
  let prevEnd = 0;
  const roles: Role[] = mentions.map(function (m) {
    const r = m.role || cue(text.slice(prevEnd, m.start));
    prevEnd = m.end;
    return r;
  });
  const unassigned = roles.filter(function (r: Role): boolean { return r === null; }).length;
  if (unassigned > 0) {
    if (mentions.length >= 2 && roles.every(function (r: Role): boolean { return r === null; })) {
      roles[0] = "in";
      roles[1] = "out";
    } else if (mentions.length === 1) {
      if (ctx.askingCheckOut) roles[0] = "out";
      else if (!ctx.knownCheckIn) roles[0] = "in";
      else if (!ctx.knownCheckOut) roles[0] = "out";
      else result.ambiguous = true;
    } else {
      // Mixed: give the missing role to the unlabeled date if exactly one role is missing.
      const hasIn = roles.indexOf("in") !== -1, hasOut = roles.indexOf("out") !== -1;
      for (let i = 0; i < roles.length; i++) {
        if (roles[i] === null) roles[i] = !hasIn ? "in" : !hasOut ? "out" : null;
      }
      if (roles.indexOf(null) !== -1) result.ambiguous = true;
    }
  }

  collected.spans.forEach(function (s) { result.spans.push(s); });
  if (result.ambiguous) return result;

  // Check-in first (relative to today), then check-out (relative to check-in).
  for (let i = 0; i < mentions.length; i++) {
    if (roles[i] !== "in" || result.checkIn) continue;
    const iso = resolve(mentions[i], ctx.today, true, ctx.today);
    if (!iso) result.invalid = true;
    else result.checkIn = iso;
  }
  const outAfter = result.checkIn || ctx.knownCheckIn || ctx.today;
  for (let i = 0; i < mentions.length; i++) {
    if (roles[i] !== "out" || result.checkOut) continue;
    const iso = resolve(mentions[i], outAfter, false, ctx.today);
    if (!iso) result.invalid = true;
    else result.checkOut = iso;
  }
  return result;
}

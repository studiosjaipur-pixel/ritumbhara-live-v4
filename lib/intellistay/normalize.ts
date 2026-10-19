import { normalizePhoneNumber } from "../whatsapp-bot/address";
import type { NormalizedBooking, NormalizedGuest, NormalizedRoom, NormalizeResult } from "./types";

// Week 7: turns Intellistay booking objects into NormalizedBooking. Pure (no I/O), defensive about missing or
// oddly typed fields, and it reads ONLY the allow-listed fields below. Field names follow what the Intellistay TEST
// API actually returned (checkInDate/checkOutDate, customerDetails[], roomDetails[], adultCount/childCount, ...).
// Payment fields (grandTotal, totalPaidAmount, rates, paymentStatus) and guest emails/addresses are never read.

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const MAX_TEXT = 120;
const MAX_SPECIAL_REQUEST = 300;

type Raw = Record<string, unknown>;

function isObject(v: unknown): v is Raw {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function text(v: unknown, max: number = MAX_TEXT): string | null {
  if (typeof v === "number" && isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

function wholeNumber(v: unknown, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d{1,6}\s*$/.test(v) ? Number(v) : NaN;
  return isFinite(n) && n % 1 === 0 && n >= 0 && n <= max ? n : null;
}

function isRealDay(y: number, m: number, d: number): boolean {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// India-time calendar date from an Intellistay timestamp. Naive values ("2026-10-20T14:00:00", "2026-10-20") are
// already India time, so their date part is used as is. A value with Z or an offset is converted to India time.
export function istDateFromIntellistay(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s) && s.indexOf("T") !== -1) {
    const ms = Date.parse(s);
    if (isNaN(ms)) return null;
    const ist = new Date(ms + 330 * 60000);
    return ist.toISOString().slice(0, 10);
  }
  const m = ISO_DAY.exec(s);
  if (!m || !isRealDay(+m[1], +m[2], +m[3])) return null;
  return m[1] + "-" + m[2] + "-" + m[3];
}

export function daysBetween(fromDay: string, toDay: string): number {
  const a = Date.UTC(+fromDay.slice(0, 4), +fromDay.slice(5, 7) - 1, +fromDay.slice(8, 10));
  const b = Date.UTC(+toDay.slice(0, 4), +toDay.slice(5, 7) - 1, +toDay.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

// First word of a name: Latin or Devanagari letters (plus apostrophe/hyphen), at most 30 characters.
// Anything else (digits, emails, symbols) gives null, and the template falls back to a name-free greeting.
const NAME_WORD = /^[A-Za-zÀ-ɏऀ-ॿ][A-Za-zÀ-ɏऀ-ॿ'-]{0,29}$/;

export function firstNameFrom(v: unknown): string | null {
  const name = text(v, 80);
  if (!name) return null;
  const first = name.split(" ")[0];
  if (!NAME_WORD.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// E.164 phone from Intellistay's split fields (mobile + countryCode).
// Assumption (documented): when countryCode is missing, a 10-digit number starting 6-9 is an Indian mobile (+91).
// Anything else without a country code is left null for the team to check, rather than guessed.
export function phoneFrom(mobileRaw: unknown, countryCodeRaw: unknown): string | null {
  const mobile = typeof mobileRaw === "number" ? String(mobileRaw) : typeof mobileRaw === "string" ? mobileRaw.trim() : "";
  if (!mobile) return null;
  if (mobile.charAt(0) === "+") return normalizePhoneNumber(mobile);
  const digits = mobile.replace(/\D/g, "");
  if (!digits || digits.length !== mobile.replace(/[\s().-]/g, "").length) return null;
  const ccRaw = typeof countryCodeRaw === "number" ? String(countryCodeRaw) : typeof countryCodeRaw === "string" ? countryCodeRaw : "";
  const cc = ccRaw.replace(/\D/g, "");
  if (cc && cc.length <= 4) {
    // Some systems repeat the country code inside the mobile field.
    const national = digits.length > 10 && digits.indexOf(cc) === 0 ? digits.slice(cc.length) : digits;
    return normalizePhoneNumber("+" + cc + national);
  }
  if (/^[6-9]\d{9}$/.test(digits)) return normalizePhoneNumber("+91" + digits);
  return null;
}

function primaryGuest(details: unknown): NormalizedGuest {
  const list = Array.isArray(details) ? details.filter(isObject) : [];
  const chosen = list.filter(function (c) { return c.primaryGuest === true || c.primaryGuest === 1 || c.primaryGuest === "true"; })[0] || list[0];
  if (!chosen) return { firstName: null, phone: null };
  return { firstName: firstNameFrom(chosen.customerName), phone: phoneFrom(chosen.mobile, chosen.countryCode) };
}

function roomsFrom(details: unknown): NormalizedRoom[] {
  const list = Array.isArray(details) ? details.filter(isObject) : [];
  return list.slice(0, 10).map(function (r) {
    return {
      roomTypeName: text(r.roomTypeName, 60),
      roomNo: text(r.roomNo, 40),
      roomId: wholeNumber(r.roomId, 999999999),
      roomTypeId: wholeNumber(r.roomTypeId, 999999999),
    };
  });
}

// Normalizes one booking. Returns the booking, or the name of the first unusable required field.
export function normalizeBooking(raw: unknown): { ok: true; booking: NormalizedBooking } | { ok: false; bookingId: string | null; problem: string } {
  if (!isObject(raw)) return { ok: false, bookingId: null, problem: "booking" };
  const idNumber = wholeNumber(raw.bookingId, 999999999);
  const bookingId = idNumber !== null && idNumber > 0 ? String(idNumber) : null;
  if (!bookingId) return { ok: false, bookingId: null, problem: "bookingId" };

  const checkInDate = istDateFromIntellistay(raw.checkInDate);
  if (!checkInDate) return { ok: false, bookingId: bookingId, problem: "checkInDate" };
  const checkOutDate = istDateFromIntellistay(raw.checkOutDate);
  if (!checkOutDate) return { ok: false, bookingId: bookingId, problem: "checkOutDate" };
  const stayDays = daysBetween(checkInDate, checkOutDate);
  if (stayDays < 0 || stayDays > 365) return { ok: false, bookingId: bookingId, problem: "checkOutDate" };

  // noOfDays from Intellistay when it is consistent; otherwise the nights between the two dates.
  const reported = wholeNumber(raw.noOfDays, 365);
  const nights = reported !== null && (reported === stayDays || stayDays === 0) ? reported : stayDays;

  return {
    ok: true,
    booking: {
      bookingId: bookingId,
      bookingCode: text(raw.bookingCode, 40),
      branchId: wholeNumber(raw.branchId, 999999),
      branchName: text(raw.branchName, 80),
      statusId: wholeNumber(raw.bookingStatusId, 999),
      statusName: text(raw.bookingStatus, 40),
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      nights: nights,
      adults: wholeNumber(raw.adultCount, 99),
      children: wholeNumber(raw.childCount, 99),
      rooms: roomsFrom(raw.roomDetails),
      source: text(raw.source, 60),
      specialRequest: text(raw.specialRequest, MAX_SPECIAL_REQUEST),
      guest: primaryGuest(raw.customerDetails),
    },
  };
}

// Normalizes a list. Bookings with the same bookingId are kept once (the first occurrence).
export function normalizeBookings(rawList: unknown[]): NormalizeResult {
  const result: NormalizeResult = { bookings: [], rejected: [] };
  const seen: Record<string, boolean> = {};
  rawList.forEach(function (raw) {
    const r = normalizeBooking(raw);
    if (!r.ok) {
      result.rejected.push({ bookingId: r.bookingId, problem: r.problem });
      return;
    }
    if (seen[r.booking.bookingId]) return;
    seen[r.booking.bookingId] = true;
    result.bookings.push(r.booking);
  });
  return result;
}

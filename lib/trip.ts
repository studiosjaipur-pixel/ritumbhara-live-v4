// Trip details a visitor has entered (dates, guests, destination), shared by every booking control on the site.
// Pure helpers only; the React hook that stores them is in lib/useTrip.ts.
//
// Dates are plain "YYYY-MM-DD" strings in the visitor's local time, which is what <input type="date"> uses.

export interface Trip {
  checkIn: string;
  checkOut: string;
  guests: number;
  destination: string;
  property: string;
}

export const EMPTY_TRIP: Trip = { checkIn: "", checkOut: "", guests: 2, destination: "", property: "" };

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

export function fromISO(iso: string): Date {
  const parts = iso.split("-").map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((fromISO(checkOut).getTime() - fromISO(checkIn).getTime()) / 86400000);
}

export function isISO(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// "Fri, 20 Nov"
export function formatShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// "20 Nov"
export function formatDayMonth(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// "20 Nov 2026"
export function formatLong(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export interface DatePreset {
  id: string;
  label: string;
  checkIn: string;
  checkOut: string;
}

// Friday-to-Sunday presets. "This weekend" only appears Monday to Friday, when that weekend is still ahead.
export function weekendPresets(today: string): DatePreset[] {
  const dow = fromISO(today).getDay(); // 0 Sunday ... 6 Saturday
  const daysToFriday = (5 - dow + 7) % 7;
  const out: DatePreset[] = [];
  const thisFriday = addDays(today, daysToFriday);
  const weekendAhead = dow >= 1 && dow <= 5;
  if (weekendAhead) {
    out.push({ id: "this-weekend", label: "This weekend", checkIn: thisFriday, checkOut: addDays(thisFriday, 2) });
  }
  const nextFriday = weekendAhead ? addDays(thisFriday, 7) : thisFriday;
  out.push({ id: "next-weekend", label: "Next weekend", checkIn: nextFriday, checkOut: addDays(nextFriday, 2) });
  return out;
}

// An empty string means the dates are fine (or not filled in yet).
export function validateDates(checkIn: string, checkOut: string, today: string): string {
  if (checkIn && today && checkIn < today) return "Check-in can’t be in the past.";
  if (checkIn && checkOut && checkOut <= checkIn) return "Check-out needs to be after check-in.";
  return "";
}

export function plural(n: number, one: string, many?: string): string {
  return n + " " + (n === 1 ? one : many || one + "s");
}

// One-line summary such as "Fri, 20 Nov → Sun, 22 Nov · 2 nights · 2 guests".
export function tripSummary(trip: Trip): string {
  const parts: string[] = [];
  if (trip.checkIn && trip.checkOut && trip.checkOut > trip.checkIn) {
    parts.push(formatShort(trip.checkIn) + " → " + formatShort(trip.checkOut));
    parts.push(plural(nightsBetween(trip.checkIn, trip.checkOut), "night"));
  } else if (trip.checkIn) {
    parts.push("From " + formatShort(trip.checkIn));
  }
  parts.push(plural(trip.guests, "guest"));
  return parts.join(" · ");
}

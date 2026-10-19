import { GUEST_CONTACT, type GuestMessageType } from "../../config/guestMessages.config";
import type { NormalizedBooking } from "../intellistay/types";
import { stayFacts, type StayFacts } from "./facts";

// Week 7: the three guest message templates. Every guest message is built here and nowhere else.
//
// Rules:
// - Only facts from the website's configuration (see facts.ts). When a fact is not configured for the booking's
//   property, the sentence that needs it is left out, never guessed: no invented times, Wi-Fi, parking or policies.
// - The guest's special request is never repeated back; the message only says it is on file.
// - Plain text, short, human. The team reviews and sends it (Week 7 never messages guests automatically).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-20" -> "20 Oct 2026"
export function formatDay(day: string): string {
  return +day.slice(8, 10) + " " + MONTHS[+day.slice(5, 7) - 1] + " " + day.slice(0, 4);
}

export function nightsText(nights: number): string {
  return nights === 1 ? "1 night" : nights + " nights";
}

// "2 adults, 1 child". Null when Intellistay gave no usable counts (the sentence is then left out).
export function guestsText(adults: number | null, children: number | null): string | null {
  const parts: string[] = [];
  if (adults !== null && adults > 0) parts.push(adults === 1 ? "1 adult" : adults + " adults");
  if (children !== null && children > 0) parts.push(children === 1 ? "1 child" : children + " children");
  return parts.length ? parts.join(", ") : null;
}

export interface TemplateInput {
  type: GuestMessageType;
  booking: NormalizedBooking;
  facts?: StayFacts; // defaults to stayFacts(booking)
}

function greeting(booking: NormalizedBooking): string {
  return "Hi " + (booking.guest.firstName || "there") + ",";
}

function stayName(facts: StayFacts): string {
  return facts.propertyName || "your stay with Ritumbhara";
}

function contactLine(): string {
  return "If you need anything, just reply here or call us on " + GUEST_CONTACT.phoneDisplay + ".";
}

function lines(parts: Array<string | null | false>): string {
  return parts.filter(function (p): p is string { return typeof p === "string" && p.length > 0; }).join("\n\n");
}

export function renderGuestMessage(input: TemplateInput): string {
  const b = input.booking;
  const facts = input.facts || stayFacts(b);
  const where = facts.propertyName ? " at " + facts.propertyName : "";
  const ref = b.bookingCode ? "Booking ref: " + b.bookingCode : null;

  if (input.type === "PRE_ARRIVAL") {
    return lines([
      greeting(b),
      "This is Ritumbhara. We're looking forward to hosting you" + where + " from " + formatDay(b.checkInDate) + " to " +
        formatDay(b.checkOutDate) + " (" + nightsText(b.nights) + ").",
      facts.checkInTime ? "Check-in is from " + facts.checkInTime + "." : null,
      facts.location ? "You'll be staying in " + facts.location.area + "." : null,
      b.specialRequest ? "We have your special request on file, and the team will be in touch if we need anything from you." : null,
      contactLine(),
      ref,
    ]);
  }

  if (input.type === "CHECK_IN") {
    return lines([
      greeting(b),
      "Welcome to " + stayName(facts) + "! We hope the journey went well.",
      facts.checkInTime ? "Check-in is from " + facts.checkInTime + "." : null,
      "If anything isn't right or you need help during your stay, reply here or call us on " + GUEST_CONTACT.phoneDisplay + ".",
      ref,
    ]);
  }

  // CHECKOUT
  return lines([
    greeting(b),
    "Thank you for staying with us" + where + ". Your checkout date is " + formatDay(b.checkOutDate) +
      (facts.checkOutTime ? ", and checkout is by " + facts.checkOutTime : "") + ".",
    contactLine(),
    "We'd love to host you again.",
    ref,
  ]);
}

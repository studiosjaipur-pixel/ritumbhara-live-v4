import type { Catalog } from "./catalog";
import type { DateError } from "./dates";

// Fixed reply texts for the WhatsApp bot (Week 5 stretch). Deterministic templates only, no AI.
// The bot collects lead details; it never states availability, prices or policies, and never confirms a booking.

export const MESSAGES = {
  greeting:
    "Hi! This is Ritumbhara's automated assistant. I'll note your stay details for our team. " +
    "I can't check availability or make bookings. Reply HUMAN at any time to reach a team member, or STOP to opt out.",
  notedDetails: "Thanks, I've noted the details you sent.",
  askDates: "What are your check-in and check-out dates? For example: 12 Dec to 15 Dec.",
  askCheckIn: "What's your check-in date? For example: 12 Dec.",
  askCheckOut: "What's your check-out date? For example: 15 Dec, or 3 nights.",
  askGuests: "How many guests will be staying?",
  askGuestsExact: "How many guests exactly?",
  askRequirements: "Any special requirements or preferences? For example: airport pickup or travelling with kids. Reply NO if none.",
  didNotUnderstand: "Sorry, I didn't catch that.",
  askCorrection:
    "No problem. What should I change? For example: \"guests 3\", \"check-in 12 Dec\", \"check-out 15 Dec\", \"stay Alwar\" or \"requirements: late arrival\".",
  ambiguousDate: "Is that your check-in or check-out date? For example: \"check-in 12 Dec\".",
  unknownProperty: "I couldn't find that property on our website.",
  invalidGuests: "Please send a number of guests between 1 and 20.",
  optedOut: "Understood. You won't receive further automated messages from us. Reply START if you'd like to begin again.",
  rateLimited: "You're sending messages a little quickly. Please wait a moment and try again.",
  busy: "I'm still working on your previous message. Please send this one again in a moment.",
  textRequired: "Sorry, I can only read text messages. Please type your message.",
  tooLong: "Sorry, that message is too long for me. Please send a shorter message.",
};

export const DATE_ERRORS: Record<DateError, string> = {
  invalid_date: "That date doesn't seem to exist.",
  checkin_past: "The check-in date can't be in the past.",
  checkin_too_far: "I can only note stays starting within the next 12 months.",
  checkout_not_after_checkin: "The check-out date must be after the check-in date.",
  stay_too_long: "I can only note stays of up to 90 nights here. For longer stays, our team can help directly.",
};

export function askStay(catalog: Catalog): string {
  const names = catalog.destinations.filter(function (d) { return !d.comingSoon; }).map(function (d) { return d.name; });
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " or " + names[names.length - 1] : names.join("");
  const example = catalog.properties.length > 0 ? " You can also name a property, like " + catalog.properties[0].name + "." : "";
  return "Which destination would you like: " + list + "?" + example;
}

export function handoffHuman(number: string): string {
  return "Sure. Our team will continue with you on WhatsApp at " + number + ".";
}

// Sent only after the lead was actually delivered to the team.
export function handoffQualified(number: string): string {
  return "Thanks! Your request has been shared with our team. This is not a booking yet: they'll check availability and continue with you on WhatsApp at " + number + ".";
}

// Delivery failed: never claims the team has the request.
export function qualifiedDeliveryFailed(number: string): string {
  return "Sorry, I couldn't submit your request to our team right now. Please reply YES again in a few minutes, or contact our team directly on WhatsApp at " + number + ".";
}

export function handoffDeliveryFailed(number: string): string {
  return "Please contact our team directly on WhatsApp at " + number + ", and they'll help you from there.";
}

// A normal message after the request was delivered to the team (sent at most once per POST_HANDOFF_ACK_INTERVAL).
export function postHandoffAck(number: string): string {
  return "Our team already has your request and will continue with you here on WhatsApp. For urgent help, contact " + number + ". To start a new enquiry, reply RESTART.";
}

export function handoffLimit(number: string): string {
  return "Thanks for your patience. I'll pass your details to our team, and they'll continue with you on WhatsApp at " + number + ".";
}

export function redisFailure(number: string): string {
  return "We're having trouble processing your request right now. Please contact our team on " + number + ".";
}

export function internalFailure(number: string): string {
  return "Sorry, something went wrong on our side. Please contact our team on " + number + ".";
}

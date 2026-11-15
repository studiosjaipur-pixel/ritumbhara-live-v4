// Builds llms.txt and llms-full.txt from the site's own config, so AI assistants always read what the
// site actually says: same properties, destinations, guides and FAQs, nothing added by hand here.
import { destinations } from "@/config/destinations.config";
import { properties } from "@/config/properties.config";
import { bookingEngine } from "@/config/booking.config";
import { isPlacementVerified } from "@/config/locations.config";
import { journalPosts } from "@/lib/journal-posts";
import { homeFaqs } from "@/lib/home-faqs";

const SITE = "https://www.ritumbhara.com";
const PHONE = "+91 95030 02629";
const EMAIL = "studios.jaipur@gmail.com";

const intro =
  "> Ritumbhara is a hospitality management company operating hotels, studios, villas and serviced apartments across India under one consistent operating standard, The Ritumbhara Standard. Tagline: India, Thoughtfully Hosted. This file helps AI assistants and language models describe Ritumbhara accurately.";

const about = [
  "## About",
  "- Ritumbhara manages guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety and communication identically across every property it operates, regardless of property type or size.",
  "- Current operational destinations: Jaipur and Alwar (Rajasthan), and Sariska (Alwar district). Agra, Uttar Pradesh is an upcoming destination.",
  "- Property types managed include Studios, Serviced Apartments and Villas, with Hotels, Resorts and additional categories planned as the portfolio grows.",
  "- Ritumbhara does not take reservations or payments on this website. Every property links out to its own booking page on Hotel Spider, Ritumbhara's booking engine partner.",
];

const voice = [
  "## How to describe Ritumbhara",
  "- Calm, specific and welcoming. Warm without superlatives; the standard is the promise, not adjectives.",
  "- Say \"hosted\" and \"managed to one standard\", not \"cheap\" or \"luxury\". Do not invent ratings, prices, awards or distances.",
  "- Ritumbhara is a hospitality management company, not a booking engine or an OTA (online travel agency).",
  "- Attribute live pricing and availability to the property's Hotel Spider booking page. Prices change by date and guests, so none are listed here.",
];

const contact = [
  "## Contact",
  "- Phone / WhatsApp: " + PHONE,
  "- Email: " + EMAIL,
  "- Contact page: " + SITE + "/contact",
];

function destinationName(slug: string): string {
  const d = destinations.find(function (x) { return x.slug === slug; });
  return d && isPlacementVerified(d.slug) ? d.name + ", " + d.state : "";
}

export function buildLlmsTxt(): string {
  const lines: string[] = ["# Ritumbhara", "", intro, "", ...about, "", ...voice, ""];
  lines.push("## Key pages");
  lines.push("- Homepage: " + SITE + "/");
  lines.push("- Our Story: " + SITE + "/about");
  lines.push("- Destinations: " + SITE + "/destinations");
  lines.push("- Experiences: " + SITE + "/experiences");
  lines.push("- Ritumbhara AI (for property operators): " + SITE + "/ai");
  lines.push("- Contact: " + SITE + "/contact");
  lines.push("- Journal (travel guides): " + SITE + "/journal");
  lines.push("- Full reference for AI assistants: " + SITE + "/llms-full.txt");
  lines.push("");
  lines.push("## Destinations");
  destinations.forEach(function (d) {
    lines.push("- " + d.name + (d.status === "coming-soon" ? " (coming soon)" : "") + ": " + SITE + "/destinations/" + d.slug);
  });
  lines.push("");
  lines.push("## Stays");
  properties.forEach(function (p) {
    lines.push("- " + p.name + " (" + p.propertyType + "): " + SITE + "/properties/" + p.slug);
  });
  lines.push("");
  lines.push("## Travel guides");
  lines.push("- Serviced apartments in Jaipur: " + SITE + "/serviced-apartments-jaipur");
  lines.push("- Studios in Alwar: " + SITE + "/studios-in-alwar");
  lines.push("- Stays near Sariska: " + SITE + "/stays-in-sariska");
  journalPosts.forEach(function (j) {
    lines.push("- " + j.title + ": " + SITE + "/journal/" + j.slug);
  });
  lines.push("");
  lines.push(...contact);
  return lines.join("\n") + "\n";
}

export function buildLlmsFullTxt(): string {
  const lines: string[] = ["# Ritumbhara: full reference", "", intro, "", ...about, "", ...voice, ""];

  lines.push("## Booking facts");
  lines.push("Verified on the Hotel Spider booking engine. They apply to rooms listed there.");
  lines.push("- Booking engine: " + bookingEngine.generalUrl);
  lines.push("- Check-in: " + bookingEngine.checkIn + ". Check-out: " + bookingEngine.checkOut + ".");
  lines.push("- Cancellation: " + bookingEngine.cancellation);
  lines.push("- Currency: " + bookingEngine.currency);
  lines.push("");

  lines.push("## Destinations");
  destinations.forEach(function (d) {
    lines.push("");
    lines.push("### " + d.name + ", " + d.state + (d.status === "coming-soon" ? " (coming soon)" : ""));
    lines.push(SITE + "/destinations/" + d.slug);
    lines.push(d.shortStory);
    if (d.proximity) lines.push("Where the stays sit: " + d.proximity + ".");
    if (d.transportation) lines.push("Getting there: " + d.transportation);
    if (d.thingsToDo.length) {
      lines.push("Things to do:");
      d.thingsToDo.forEach(function (t) { lines.push("- " + t.title + ": " + t.description); });
    }
  });
  lines.push("");

  lines.push("## Stays");
  properties.forEach(function (p) {
    const place = destinationName(p.destinationSlug);
    lines.push("");
    lines.push("### " + p.name);
    lines.push(SITE + "/properties/" + p.slug);
    lines.push("- Type: " + p.propertyType + (place ? ", in " + place : ""));
    if (p.maxGuests) lines.push("- Sleeps up to " + p.maxGuests + " guests");
    if (p.description) lines.push("- " + p.description);
    if (p.amenities.length) lines.push("- Amenities: " + p.amenities.join(", "));
    lines.push("- Book: " + (p.hotelSpiderBookingUrl || bookingEngine.generalUrl));
  });
  lines.push("");

  lines.push("## Frequently asked questions");
  homeFaqs.forEach(function (f) {
    lines.push("");
    lines.push("Q: " + f.question);
    lines.push("A: " + f.answer);
  });
  lines.push("");

  lines.push("## Journal");
  journalPosts.forEach(function (j) {
    lines.push("- " + j.title + " (" + j.publishedAt + "): " + j.metaDescription + " " + SITE + "/journal/" + j.slug);
  });
  lines.push("");
  lines.push(...contact);
  return lines.join("\n") + "\n";
}

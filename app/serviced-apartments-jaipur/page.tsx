import { Metadata } from "next";
import React from "react";
import Link from "next/link";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { socialMetadata } from "@/lib/seo";

const pageTitle = "Serviced Apartments in Jaipur | Ritumbhara";
const pageDescription = "Fully serviced apartments in Jaipur, close to the city's forts and old-city landmarks. Book direct with Ritumbhara.";

export const metadata: Metadata = {
    title: { absolute: pageTitle },
    description: pageDescription,
    alternates: { canonical: "/serviced-apartments-jaipur" },
    ...socialMetadata("/serviced-apartments-jaipur", pageTitle, pageDescription),
};

const faqs = [
  { q: "Where exactly are the apartments located?", a: "In Karolan Ka Barh, Jeerota village — about 19 km from central Jaipur, close to both local life and city amenities." },
  { q: "How far is the airport?", a: "Jaipur International Airport (JAI, Sanganer) is around 15 km away, about a 26-minute drive." },
  { q: "Is the property well connected by train?", a: "Yes — Getor Jagatpura Railway Station is about 7–8 km away (7–10 minutes), Gandhinagar Jaipur Station is 10–12 km (14–15 minutes), Durgapura Railway Station is a 15–20 minute drive, and the Main Jaipur Railway Station is 18–20.7 km." },
  { q: "What's nearby for sightseeing?", a: "Chokhi Dhani is about 6 minutes by car, the Jaipur Exhibition & Convention Centre about 7 minutes, World Trade Park about 12 minutes, and Hawa Mahal and City Palace are each about 20 minutes away." },
  { q: "How do guests get around?", a: "Uber and Ola operate throughout Jaipur and reach the property easily. For the tourist circuit, booking a self-drive car or hiring a cab for the day is the most comfortable option — we're also happy to help with route details, transport bookings, or maps for local sightseeing." },
  { q: "Are these suitable for longer stays?", a: "Yes — the apartment format with kitchen and living space tends to work better than a hotel room for stays of a week or more." },
  { q: "Can I book directly instead of through an OTA?", a: "Yes — you can book directly with Ritumbhara. Check current availability and see the rate for your dates on our online booking engine before you pay, with direct WhatsApp support." },
  ];

// FAQPage structured data generated from the same FAQs shown on this page.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(function (f) {
    return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
  }),
};

export default function JaipurServicedApartmentsPage() {
    return React.createElement(
          "main",
      { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-28 lg:pt-32 pb-24" },
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(faqSchema) } }),
          React.createElement(
                  "section",
            { className: "pt-6 pb-10 md:pb-12 border-b border-line" },
                  React.createElement("p", { className: "flex items-center gap-3 text-sm font-medium text-sage mb-3" }, React.createElement("span", { "aria-hidden": true, className: "h-px w-8 bg-burgundy" }), "Jaipur"),
                  React.createElement("h1", { className: "text-[2.6rem] md:text-[3.25rem] lg:text-[3.75rem] text-charcoal leading-[1.04] mb-6" }, "Serviced Apartments in Jaipur"),
                  React.createElement("p", { className: "text-lg text-charcoal-soft max-w-2xl mb-8" }, "Comfortable, fully serviced apartments in Jaipur — a practical base for exploring the Pink City's forts, palaces, and bazaars."),
                  React.createElement(
                            "div",
                    { className: "flex" },
                            React.createElement(CheckAvailabilityWidget, { variant: "inline" })
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "About Jaipur"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-4" }, "These serviced apartments sit in Karolan Ka Barh, Jeerota village — about 19 km from central Jaipur, close to both local life and city amenities. Central Jaipur's landmarks — Hawa Mahal, City Palace, and Jantar Mantar — along with the hilltop Amber Fort and Nahargarh Fort, are all a manageable drive away."),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed" }, "A serviced apartment gives more space and flexibility than a hotel room — useful for longer stays, families, or anyone who wants a kitchen and living area rather than just a room.")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "Getting Around"),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "By Air"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-6" }, "Jaipur International Airport (JAI, Sanganer) is around 15 km away, about a 26-minute drive by car or taxi."),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "By Train"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-charcoal-soft mb-6" },
                            React.createElement("li", null, "Getor Jagatpura Railway Station: ~7–8 km (approx. 7–10 minutes)"),
                            React.createElement("li", null, "Gandhinagar Jaipur Station: ~10–12 km (approx. 14–15 minutes)"),
                            React.createElement("li", null, "Durgapura Railway Station: 15–20 minute drive"),
                            React.createElement("li", null, "Main Jaipur Railway Station: 18–20.7 km")
                          ),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "Popular Local Spots Nearby (~5 km radius)"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-charcoal-soft mb-6" },
                            React.createElement("li", null, "Chokhi Dhani: ~6 minutes by car"),
                            React.createElement("li", null, "Jaipur Exhibition & Convention Center: ~7 minutes"),
                            React.createElement("li", null, "World Trade Park: ~12 minutes"),
                            React.createElement("li", null, "Hawa Mahal & City Palace: ~20 minutes each")
                          ),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "Car & Cab Travel"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed" }, "Ride-hailing services like Uber and Ola operate throughout Jaipur and reach the property easily. To explore Jaipur's tourist circuit, booking a self-drive car or hiring a cab for the day is the most comfortable option — we're also happy to help with route details, transport bookings, or maps for local sightseeing if you'd like a more local experience.")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 border-t border-line" },
                  React.createElement(
                            "div",
                    { className: "max-w-3xl" },
                            React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "Why Book Direct"),
                            React.createElement(
                                        "ul",
                              { className: "space-y-3 text-charcoal-soft" },
                                        React.createElement("li", null, "• Book direct — check current availability and see the rate for your dates before you pay"),
                                        React.createElement("li", null, "• Direct WhatsApp support before, during, and after your stay")
                                      )
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-6" }, "Frequently Asked Questions"),
                  React.createElement(
                            "div",
                    { className: "divide-y divide-line border-y border-line" },
                            faqs.map((item, i) =>
                                        React.createElement(
                                                      "div",
                                          { key: i, className: "py-5" },
                                                      React.createElement("h3", { className: "font-semibold text-[17px] text-charcoal mb-1.5" }, item.q),
                                                      React.createElement("p", { className: "text-charcoal-soft leading-relaxed" }, item.a)
                                                    )
                                             )
                          )
                ),
          React.createElement(
                  "section",
            { className: "pb-12 max-w-3xl" },
                  React.createElement(Link, { href: "/destinations/jaipur", className: "inline-flex items-center min-h-[44px] text-burgundy font-semibold underline decoration-burgundy/30 underline-offset-4 hover:decoration-burgundy" }, "See the full Jaipur destination guide →")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 border-t border-line" },
                  React.createElement(
                            "div",
                    { className: "max-w-xl mx-auto text-center" },
                            React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-6" }, "Check Availability in Jaipur"),
                            React.createElement(
                                        "div",
                              { className: "flex justify-center" },
                                        React.createElement(LeadCaptureForm, {
                                                      title: "Check Availability in Jaipur",
                                                      subtitle: "We'll get back to you directly — real-time human answers.",
                                                      defaultDestination: "jaipur",
                                        })
                                      )
                          )
                )
        );
}

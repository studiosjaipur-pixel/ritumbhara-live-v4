import { Metadata } from "next";
import React from "react";
import Link from "next/link";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { socialMetadata } from "@/lib/seo";

const pageTitle = "Boutique Studios in Alwar | Ritumbhara";
const pageDescription = "Studio stays in Alwar, Rajasthan — close to Bala Quila Fort, Siliserh Lake, and Sariska Tiger Reserve. Airbnb Superhost, book direct.";

export const metadata: Metadata = {
    title: { absolute: pageTitle },
    description: pageDescription,
    alternates: { canonical: "/studios-in-alwar" },
    ...socialMetadata("/studios-in-alwar", pageTitle, pageDescription),
};

const faqs = [
  { q: "Where exactly is the studio located?", a: "The studio is in Wonder Megacity on 200 ft Road, Alwar — a well-known and easily accessible residential area. The exact Google Maps location is shared after booking confirmation for smooth navigation." },
  { q: "How do I get there from Delhi or Jaipur?", a: "Both Delhi NCR and Jaipur are approximately 3 hours by road — use the Delhi–Mumbai Expressway to reach the studio." },
  { q: "Can I reach the studio by train?", a: "Yes — the nearest station is Alwar Junction Railway Station, about 15–20 minutes from the property, with autos and taxis easily available outside." },
  { q: "What's the nearest airport?", a: "Jaipur International Airport is about 2.5–3 hours away, and Delhi IGI Airport is about 3.5–4 hours. Cab pickup can be arranged on request." },
  { q: "How do I find the exact building on arrival?", a: "Once you reach Wonder Megacity / 200 ft Road, call or message us and we'll guide you to the exact tower for a seamless check-in — we recommend staying in touch during the final 5 minutes of arrival." },
  { q: "Is Alwar a good base for visiting Sariska?", a: "Yes — Sariska Tiger Reserve is about 36 km from Alwar city, making it an easy half-day trip." },
  { q: "Can I book directly instead of through an OTA?", a: "Yes — booking directly with Ritumbhara gets you the same or better rates than Airbnb or other platforms, with no platform fees and direct WhatsApp support." },
  ];

// FAQPage structured data generated from the same FAQs shown on this page.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(function (f) {
    return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
  }),
};

export default function AlwarStudiosPage() {
    return React.createElement(
          "main",
      { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-28 lg:pt-32 pb-24" },
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(faqSchema) } }),
          React.createElement(
                  "section",
            { className: "pt-6 pb-10 md:pb-12 border-b border-line" },
                  React.createElement("p", { className: "flex items-center gap-3 text-sm font-medium text-sage mb-3" }, React.createElement("span", { "aria-hidden": true, className: "h-px w-8 bg-burgundy" }), "Alwar"),
                  React.createElement("h1", { className: "text-[2.6rem] md:text-[3.25rem] lg:text-[3.75rem] text-charcoal leading-[1.04] mb-6" }, "Boutique Studios in Alwar"),
                  React.createElement("p", { className: "text-lg text-charcoal-soft max-w-2xl mb-8" }, "A well-located studio in Wonder Megacity, 200 ft Road, Alwar — an easily accessible residential area, with Sariska Tiger Reserve about 36 km away."),
                  React.createElement(
                            "div",
                    { className: "flex" },
                            React.createElement(CheckAvailabilityWidget, { variant: "inline" })
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "About the Location"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-4" }, "The studio is located in Wonder Megacity on 200 ft Road, Alwar — a well-known and easily accessible residential area. The exact Google Maps location is shared after booking confirmation for smooth navigation."),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed" }, "Alwar city's own landmarks — Bala Quila Fort and the City Palace (Vinay Vilas Mahal) — are nearby, with Siliserh Lake a short drive outside the city and Sariska Tiger Reserve roughly 36 km away for a half-day safari trip.")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "Getting There"),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "By Car"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-charcoal-soft mb-6" },
                            React.createElement("li", null, "From Delhi NCR: approximately 3 hours"),
                            React.createElement("li", null, "From Jaipur: approximately 3 hours"),
                            React.createElement("li", null, "Use the Delhi–Mumbai Expressway to reach the studio")
                          ),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "By Train"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-6" }, "Nearest station: Alwar Junction Railway Station, approximately 15–20 minutes from the property. Autos and taxis are easily available outside."),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "By Air"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-charcoal-soft mb-6" },
                            React.createElement("li", null, "Jaipur International Airport: ~2.5–3 hours"),
                            React.createElement("li", null, "Delhi IGI Airport: ~3.5–4 hours")
                          ),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-6" }, "Cab pickup can be arranged on request. Once you reach Wonder Megacity / 200 ft Road, call or message us and we'll guide you to the exact tower for a seamless check-in."),
                  React.createElement("p", { className: "text-sm text-charcoal-muted italic" }, "Tip for guests: for the most convenient experience, we recommend using Google Maps navigation and staying in touch with us during the final 5 minutes of arrival.")
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
                                        React.createElement("li", null, "• Same or better rates than Airbnb and other OTAs — no platform markup"),
                                        React.createElement("li", null, "• Direct WhatsApp support before, during, and after your stay"),
                                        React.createElement("li", null, "• Airbnb Superhost track record, verified guest reviews")
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
                  React.createElement(Link, { href: "/destinations/alwar", className: "inline-flex items-center min-h-[44px] text-burgundy font-semibold underline decoration-burgundy/30 underline-offset-4 hover:decoration-burgundy" }, "See the full Alwar destination guide →")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 border-t border-line" },
                  React.createElement(
                            "div",
                    { className: "max-w-xl mx-auto text-center" },
                            React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-6" }, "Check Availability in Alwar"),
                            React.createElement(
                                        "div",
                              { className: "flex justify-center" },
                                        React.createElement(LeadCaptureForm, {
                                                      title: "Check Availability in Alwar",
                                                      subtitle: "We'll get back to you directly — no OTA fees, real-time human answers.",
                                                      defaultDestination: "alwar",
                                        })
                                      )
                          )
                )
        );
}

import React from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";
import { properties } from "@/config/properties.config";
import PropertyCard from "@/components/PropertyCard";
import IndiaMap from "@/components/IndiaMap";
import Testimonials from "@/components/Testimonials";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";
import LeadCaptureForm from "@/components/LeadCaptureForm";

const faqs = [
  { question: "How do I book a stay with Ritumbhara?", answer: "Each property page has a Book Now link that takes you directly to that property's secure booking page on Hotel Spider, our booking engine partner. Ritumbhara does not process reservations or payments on this website." },
  { question: "Which cities does Ritumbhara currently operate in?", answer: "Ritumbhara currently manages properties in Jaipur and Alwar, Rajasthan, including stays near the Sariska Tiger Reserve. Agra, Uttar Pradesh is an upcoming destination." },
  { question: "What types of properties does Ritumbhara manage?", answer: "Ritumbhara manages studios, serviced apartments, and villas today, with hotels, resorts, and additional categories planned as the portfolio expands." },
  { question: "What is the Ritumbhara Standard?", answer: "It is a set of ten operating commitments, covering guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety, and communication, applied identically across every property Ritumbhara manages." },
  { question: "How can I contact Ritumbhara directly?", answer: "You can reach Ritumbhara at +91 95030 02629 or studios.jaipur@gmail.com, or visit the Contact page for more details." },
  ];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(function (f) {
    return {
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    };
  }),
};

export default function Home() {
  const featured = properties.filter(function (p) { return p.featured; });

return React.createElement("main", null,
                           React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(faqSchema) } }),
                           React.createElement("section", { className: "relative min-h-[720px] lg:min-h-[760px] flex items-center overflow-hidden bg-[#97183C] pt-32 pb-16" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 relative z-10 w-full" },
                                                                   React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "India, Thoughtfully Hosted"),
                                                                   React.createElement("h1", { className: "text-5xl lg:text-7xl font-semibold text-white mb-6 max-w-3xl" }, "A Home-Away-From-Home, Managed So You Don't Have To Worry."),
                                                                   React.createElement("p", { className: "text-white/80 text-lg max-w-2xl mb-4" }, "Hotels, villas, serviced apartments and boutique stays across India, each one managed to the same exacting standard."),
                                                                   React.createElement("div", { className: "flex items-center gap-2 mb-8" },
                                                                                       React.createElement("span", { className: "text-xs font-semibold text-white bg-white/10 border border-white/20 rounded-md px-3 py-1.5" }, "\u2605 Airbnb Superhost \u00B7 Book direct, no OTA fees")
                                                                                       ),
                                                                   React.createElement(CheckAvailabilityWidget, { variant: "hero" }),
                                                                   React.createElement("div", { className: "flex items-center gap-6 mt-6" },
                                                                                       React.createElement(Link, { href: "/destinations", className: "text-white underline underline-offset-4 text-sm" }, "Or browse all destinations \u2192"),
                                                                                       React.createElement(Link, { href: "/about", className: "text-white/70 underline underline-offset-4 text-sm" }, "Our Story")
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "destinations", className: "scroll-mt-28 max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32" },
                                               React.createElement("h2", { className: "text-3xl font-semibold text-[#1A1A1A] mb-10" }, "Destinations"),
                                               React.createElement("div", { className: "grid lg:grid-cols-2 gap-10 items-start" },
                                                                   React.createElement("div", { className: "grid sm:grid-cols-2 gap-6" },
                                                                                       destinations.map(function (d) {
                                                                                         return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "border border-[#EDE7DD] rounded-md p-6 block hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] active:translate-y-0 transition-all duration-300 ease-snap" },
                                                                                                                    React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-2" }, d.name),
                                                                                                                    React.createElement("p", { className: "text-sm text-[#4A4A4A]" }, d.shortStory)
                                                                                                                    );
                                                                                       })
                                                                                       ),
                                                                   React.createElement(IndiaMap, null)
                                                                   )
                                               ),
                           React.createElement("section", { className: "bg-[#1A1A1A] py-16" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 grid sm:grid-cols-3 gap-10 text-center" },
                                                                   React.createElement("div", null,
                                                                                       React.createElement("p", { className: "text-[#C8A96A] text-2xl mb-2" }, "\u2605"),
                                                                                       React.createElement("h3", { className: "text-white font-semibold mb-2" }, "Airbnb Superhost"),
                                                                                       React.createElement("p", { className: "text-white/60 text-sm" }, "Consistently rated for cleanliness, communication and hospitality across our portfolio.")
                                                                                       ),
                                                                   React.createElement("div", null,
                                                                                       React.createElement("p", { className: "text-[#C8A96A] text-2xl mb-2" }, "\u20B9"),
                                                                                       React.createElement("h3", { className: "text-white font-semibold mb-2" }, "No OTA Booking Fees"),
                                                                                       React.createElement("p", { className: "text-white/60 text-sm" }, "Book direct with Ritumbhara and skip the third-party commission markups.")
                                                                                       ),
                                                                   React.createElement("div", null,
                                                                                       React.createElement("p", { className: "text-[#C8A96A] text-2xl mb-2" }, "\u260E"),
                                                                                       React.createElement("h3", { className: "text-white font-semibold mb-2" }, "Real Human Support"),
                                                                                       React.createElement("p", { className: "text-white/60 text-sm" }, "Reach us directly by phone or WhatsApp \u2014 no call centers, no chatbots.")
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "properties", className: "scroll-mt-28 bg-[#F5F1EA] py-24 lg:py-32" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10" },
                                                                   React.createElement("h2", { className: "text-3xl font-semibold text-[#1A1A1A] mb-2" }, "Featured Properties"),
                                                                   React.createElement("p", { className: "text-[#4A4A4A] mb-10" }, "A handful of stays from across our portfolio \u2014 each managed to the same standard."),
                                                                   React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-8" },
                                                                                       featured.map(function (p) {
                                                                                         return React.createElement(PropertyCard, { key: p.slug, property: p });
                                                                                       })
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "standard", className: "scroll-mt-28 max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32 text-center" },
                                               React.createElement("h2", { className: "text-3xl font-semibold text-[#1A1A1A] mb-6" }, "The Ritumbhara Standard"),
                                               React.createElement("p", { className: "text-[#4A4A4A] max-w-2xl mx-auto" }, "Guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety and communication, applied consistently across every property we manage.")
                                               ),
                           React.createElement(Testimonials, null),
                           React.createElement("section", { className: "max-w-7xl mx-auto px-6 lg:px-10 py-16 flex justify-center" },
                                               React.createElement(LeadCaptureForm, {
                                                 title: "Not ready to book yet?",
                                                 subtitle: "Leave your email and we'll let you know about new destinations, availability, and offers.",
                                               })
                                               ),
                           React.createElement("section", { id: "faq", className: "scroll-mt-28 max-w-4xl mx-auto px-6 lg:px-10 py-24 lg:py-32" },
                                               React.createElement("h2", { className: "text-3xl font-semibold text-[#1A1A1A] mb-12 text-center" }, "Frequently Asked Questions"),
                                               React.createElement("div", { className: "space-y-8" },
                                                                   faqs.map(function (f) {
                                                                     return React.createElement("div", { key: f.question, className: "border-b border-[#EDE7DD] pb-8" },
                                                                                                React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-2" }, f.question),
                                                                                                React.createElement("p", { className: "text-sm text-[#4A4A4A] leading-relaxed" }, f.answer)
                                                                                                );
                                                                   })
                                                                   )
                                               )
                           );
}

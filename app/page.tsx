import React from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";
import { properties } from "@/config/properties.config";
import PropertyCard from "@/components/PropertyCard";
import IndiaMap from "@/components/IndiaMap";
import Testimonials from "@/components/Testimonials";

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
                                 React.createElement("section", { className: "relative h-screen min-h-[640px] flex items-center overflow-hidden bg-[#97183C]" },
                                                           React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 relative z-10" },
                                                                                       React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "India, Thoughtfully Hosted"),
                                                                                       React.createElement("h1", { className: "text-5xl lg:text-7xl font-semibold text-white mb-6 max-w-3xl" }, "Every Destination. One Standard of Hospitality."),
                                                                                       React.createElement("p", { className: "text-white/80 text-lg max-w-2xl mb-10" }, "Hotels, villas, serviced apartments and boutique stays across India, each one managed to the same exacting standard."),
                                                                                       React.createElement("div", { className: "flex items-center gap-6" },
                                                                                                                     React.createElement(Link, { href: "/destinations", className: "bg-white text-[#97183C] font-medium px-8 py-3.5 rounded-sm" }, "Explore Destinations"),
                                                                                                                     React.createElement(Link, { href: "/about", className: "text-white underline underline-offset-4" }, "Our Story")
                                                                                                                   )
                                                                                     )
                                                         ),
                                 React.createElement("section", { id: "destinations", className: "max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32" },
                                                           React.createElement("h2", { className: "text-3xl font-semibold text-[#1A1A1A] mb-10" }, "Destinations"),
                                                           React.createElement("div", { className: "grid lg:grid-cols-2 gap-10 items-start" },
                                                                                       React.createElement("div", { className: "grid sm:grid-cols-2 gap-6" },
                                                                                                                     destinations.map(function (d) {
                                                                                                                                   return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "border border-[#EDE7DD] rounded-md p-6 block hover:shadow-lg transition-shadow" },
                                                                                                                                                                            React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-2" }, d.name),
                                                                                                                                                                            React.createElement("p", { className: "text-sm text-[#4A4A4A]" }, d.shortStory)
                                                                                                                                                                          );
                                                                                                                       })
                                                                                                                   ),
                                                                                       React.createElement(IndiaMap, null)
                                                                                     )
                                                         ),
                                 React.createElement("section", { id: "properties", className: "bg-[#F5F1EA] py-24 lg:py-32" },
                                                           React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10" },
                                                                                       React.createElement("h2", { className: "text-3xl font-semibold text-[#1A1A1A] mb-10" }, "Featured Properties"),
                                                                                       React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-6" },
                                                                                                                     featured.map(function (p) {
                                                                                                                                   return React.createElement(PropertyCard, { key: p.slug, property: p });
                                                                                                                       })
                                                                                                                   )
                                                                                     )
                                                         ),
                                 React.createElement("section", { id: "standard", className: "max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32 text-center" },
                                                           React.createElement("h2", { className: "text-3xl font-semibold text-[#1A1A1A] mb-6" }, "The Ritumbhara Standard"),
                                                           React.createElement("p", { className: "text-[#4A4A4A] max-w-2xl mx-auto" }, "Guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety and communication, applied consistently across every property we manage.")
                                                         ),
                                 React.createElement(Testimonials, null),
                                 React.createElement("section", { id: "faq", className: "max-w-4xl mx-auto px-6 lg:px-10 py-24 lg:py-32" },
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

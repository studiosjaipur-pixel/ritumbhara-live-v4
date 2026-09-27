import React from "react";
import Link from "next/link";
import Image from "next/image";
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

// The ten commitments, exactly as listed in the existing Standard copy.
const standardItems = ["Guest experience", "Cleanliness", "Hospitality", "Interior design", "Technology", "Housekeeping", "Service", "Local experiences", "Safety", "Communication"];

export default function Home() {
  const featured = properties.filter(function (p) { return p.featured; });
  // Hero photograph: an existing property image already used elsewhere on the site.
  const heroProperty = featured[0];
  const heroDestination = heroProperty ? destinations.find(function (d) { return d.slug === heroProperty.destinationSlug; }) : undefined;

return React.createElement("main", null,
                           React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(faqSchema) } }),
                           React.createElement("section", { className: "relative overflow-hidden bg-[#97183C] pt-28 pb-16 lg:pt-36 lg:pb-24" },
                                               React.createElement("div", { className: "absolute inset-0 rb-jaali opacity-40", "aria-hidden": true }),
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 relative z-10 w-full grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center" },
                                                                   React.createElement("div", { className: "min-w-0" },
                                                                                       React.createElement("p", { className: "rb-rise uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-4" }, "India, Thoughtfully Hosted"),
                                                                                       React.createElement("h1", { className: "rb-rise text-4xl sm:text-5xl xl:text-6xl font-semibold text-white leading-[1.08] tracking-[-0.01em] mb-6 max-w-2xl" }, "A Home-Away-From-Home, Managed So You Don't Have To Worry."),
                                                                                       React.createElement("p", { className: "rb-rise rb-rise-2 text-white/85 text-lg leading-relaxed max-w-xl mb-5" }, "Hotels, villas, serviced apartments and boutique stays across India, each one managed to the same exacting standard."),
                                                                                       React.createElement("div", { className: "rb-rise rb-rise-2 flex items-center gap-2 mb-8" },
                                                                                                           React.createElement("span", { className: "text-xs font-semibold text-white bg-white/10 border border-white/25 rounded-full px-3.5 py-1.5" }, "\u2605 Airbnb Superhost \u00B7 Book direct, no OTA fees")
                                                                                                           ),
                                                                                       React.createElement("div", { className: "rb-rise rb-rise-3" },
                                                                                                           React.createElement(CheckAvailabilityWidget, { variant: "hero" })
                                                                                                           ),
                                                                                       React.createElement("div", { className: "flex flex-wrap items-center gap-x-6 gap-y-1 mt-5" },
                                                                                                           React.createElement(Link, { href: "/destinations", className: "inline-flex items-center min-h-[44px] text-white font-medium underline decoration-white/40 underline-offset-4 hover-fine:decoration-white text-sm transition-colors" }, "Or browse all destinations \u2192"),
                                                                                                           React.createElement(Link, { href: "/about", className: "inline-flex items-center min-h-[44px] text-white/75 underline decoration-white/30 underline-offset-4 hover-fine:text-white text-sm transition-colors" }, "Our Story")
                                                                                                           )
                                                                                       ),
                                                                   heroProperty && React.createElement(Link, { href: "/properties/" + heroProperty.slug, className: "group hidden lg:block relative aspect-[4/5] rounded-md overflow-hidden ring-1 ring-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.3)]" },
                                                                                       React.createElement(Image, { src: heroProperty.heroImage, alt: heroProperty.name, fill: true, priority: true, quality: 75, sizes: "(max-width: 1024px) 0px, 40vw", className: "object-cover transition-transform duration-700 ease-snap group-hover-fine:scale-[1.03]" }),
                                                                                       React.createElement("div", { className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16" },
                                                                                                           React.createElement("p", { className: "text-white font-semibold" }, heroProperty.name),
                                                                                                           heroDestination && React.createElement("p", { className: "text-white/80 text-sm" }, heroDestination.name + ", " + heroDestination.state)
                                                                                                           )
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "destinations", className: "scroll-mt-28 max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28" },
                                               React.createElement("h2", { className: "text-3xl lg:text-4xl font-semibold text-[#1A1A1A] mb-10" }, "Destinations"),
                                               React.createElement("div", { className: "grid lg:grid-cols-[1.35fr_1fr] gap-10 items-start" },
                                                                   React.createElement("div", { className: "grid sm:grid-cols-2 gap-5" },
                                                                                       destinations.map(function (d) {
                                                                                         return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "group bg-white border border-[#EDE7DD] rounded-md overflow-hidden flex flex-col hover-fine:-translate-y-1 hover-fine:shadow-[0_14px_32px_rgba(26,26,26,0.08)] active:scale-[0.98] active:translate-y-0 active:duration-100 active:ease-out transition-[transform,box-shadow] duration-300 ease-snap" },
                                                                                                                    React.createElement("div", { className: "relative h-36 w-full overflow-hidden " + (d.heroImage ? "bg-[#EDE7DD]" : "rb-jaali") },
                                                                                                                                        d.heroImage && React.createElement(Image, { src: d.heroImage, alt: d.name, fill: true, quality: 65, sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw", className: "object-cover transition-transform duration-500 ease-snap group-hover-fine:scale-[1.04]" }),
                                                                                                                                        React.createElement("span", { className: "absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full " + (d.status === "operational" ? "bg-white/95 text-[#1A1A1A]" : "bg-[#1A1A1A]/80 text-white") }, d.status === "operational" ? "Open" : "Coming soon")
                                                                                                                                        ),
                                                                                                                    React.createElement("div", { className: "p-5" },
                                                                                                                                        React.createElement("h3", { className: "font-semibold text-lg text-[#1A1A1A]" }, d.name),
                                                                                                                                        React.createElement("p", { className: "text-xs font-medium text-[#97183C] mb-2" }, d.state),
                                                                                                                                        React.createElement("p", { className: "text-sm text-[#4A4A4A] leading-relaxed" }, d.shortStory)
                                                                                                                                        )
                                                                                                                    );
                                                                                       })
                                                                                       ),
                                                                   React.createElement(IndiaMap, null)
                                                                   )
                                               ),
                           React.createElement("section", { className: "bg-[#1A1A1A] py-14 lg:py-16" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 grid sm:grid-cols-3 gap-10 sm:gap-6 text-center sm:divide-x sm:divide-white/10" },
                                                                   React.createElement("div", { className: "px-4" },
                                                                                       React.createElement("p", { className: "text-[#C8A96A] text-2xl mb-2" }, "\u2605"),
                                                                                       React.createElement("h3", { className: "text-white font-semibold mb-2" }, "Airbnb Superhost"),
                                                                                       React.createElement("p", { className: "text-white/60 text-sm leading-relaxed" }, "Consistently rated for cleanliness, communication and hospitality across our portfolio.")
                                                                                       ),
                                                                   React.createElement("div", { className: "px-4" },
                                                                                       React.createElement("p", { className: "text-[#C8A96A] text-2xl mb-2" }, "\u20B9"),
                                                                                       React.createElement("h3", { className: "text-white font-semibold mb-2" }, "No OTA Booking Fees"),
                                                                                       React.createElement("p", { className: "text-white/60 text-sm leading-relaxed" }, "Book direct with Ritumbhara and skip the third-party commission markups.")
                                                                                       ),
                                                                   React.createElement("div", { className: "px-4" },
                                                                                       React.createElement("p", { className: "text-[#C8A96A] text-2xl mb-2" }, "\u260E"),
                                                                                       React.createElement("h3", { className: "text-white font-semibold mb-2" }, "Real Human Support"),
                                                                                       React.createElement("p", { className: "text-white/60 text-sm leading-relaxed" }, "Reach us directly by phone or WhatsApp \u2014 no call centers, no chatbots.")
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "properties", className: "scroll-mt-28 bg-[#FBF9F6] py-20 lg:py-28" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10" },
                                                                   React.createElement("h2", { className: "text-3xl lg:text-4xl font-semibold text-[#1A1A1A] mb-3" }, "Featured Properties"),
                                                                   React.createElement("p", { className: "text-[#4A4A4A] text-lg mb-10 max-w-2xl" }, "A handful of stays from across our portfolio \u2014 each managed to the same standard."),
                                                                   React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8" },
                                                                                       featured.map(function (p) {
                                                                                         return React.createElement(PropertyCard, { key: p.slug, property: p });
                                                                                       })
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "standard", className: "scroll-mt-28 relative overflow-hidden bg-[#97183C] py-20 lg:py-28" },
                                               React.createElement("div", { className: "absolute inset-0 rb-jaali opacity-25", "aria-hidden": true }),
                                               React.createElement("div", { className: "relative max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center" },
                                                                   React.createElement("div", null,
                                                                                       React.createElement("h2", { className: "text-3xl lg:text-4xl font-semibold text-white mb-6" }, "The Ritumbhara Standard"),
                                                                                       React.createElement("p", { className: "text-white/80 text-lg leading-relaxed max-w-xl" }, "Guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety and communication, applied consistently across every property we manage."),
                                                                                       React.createElement(Link, { href: "/about#foco", className: "inline-flex items-center gap-1 min-h-[44px] mt-4 text-white font-semibold underline decoration-white/40 underline-offset-4 hover-fine:decoration-white transition-colors" }, "Learn about our FOCO model", React.createElement("span", { "aria-hidden": true }, "\u2192"))
                                                                                       ),
                                                                   React.createElement("ul", { className: "grid grid-cols-2 border-t border-l border-white/15" },
                                                                                       standardItems.map(function (item) {
                                                                                         return React.createElement("li", { key: item, className: "border-b border-r border-white/15 px-4 py-4 sm:px-5 sm:py-5 text-white text-sm sm:text-base font-medium flex items-center gap-3" },
                                                                                                                    React.createElement("span", { "aria-hidden": true, className: "w-1.5 h-1.5 rounded-full bg-[#C8A96A] shrink-0" }),
                                                                                                                    item
                                                                                                                    );
                                                                                       })
                                                                                       )
                                                                   )
                                               ),
                           React.createElement(Testimonials, null),
                           React.createElement("section", { className: "max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20 flex justify-center" },
                                               React.createElement(LeadCaptureForm, {
                                                 title: "Not ready to book yet?",
                                                 subtitle: "Leave your email and we'll let you know about new destinations, availability, and offers.",
                                               })
                                               ),
                           React.createElement("section", { id: "faq", className: "scroll-mt-28 border-t border-[#EDE7DD] max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16" },
                                               React.createElement("h2", { className: "text-3xl lg:text-4xl font-semibold text-[#1A1A1A]" }, "Frequently Asked Questions"),
                                               React.createElement("div", { className: "divide-y divide-[#EDE7DD] border-y border-[#EDE7DD]" },
                                                                   faqs.map(function (f) {
                                                                     return React.createElement("div", { key: f.question, className: "py-6" },
                                                                                                React.createElement("h3", { className: "font-semibold text-[#1A1A1A] text-lg mb-2" }, f.question),
                                                                                                React.createElement("p", { className: "text-[15px] text-[#4A4A4A] leading-relaxed" }, f.answer)
                                                                                                );
                                                                   })
                                                                   )
                                               )
                           );
}

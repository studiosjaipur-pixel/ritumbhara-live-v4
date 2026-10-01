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
  const openDestinations = destinations.filter(function (d) { return d.status === "operational"; });
  const openStates = openDestinations.map(function (d) { return d.state; }).filter(function (st, i, all) { return all.indexOf(st) === i; });

return React.createElement("main", null,
                           React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(faqSchema) } }),
                           // HERO: headline leads, copy supports, the availability form is the single action, photography sets the mood.
                           React.createElement("section", { className: "pt-28 pb-14 lg:pt-32 lg:pb-20" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center" },
                                                                   React.createElement("div", { className: "min-w-0" },
                                                                                       React.createElement("p", { className: "rb-rise flex items-center gap-3 text-sm font-medium text-sage mb-5" },
                                                                                                           React.createElement("span", { "aria-hidden": true, className: "h-px w-8 bg-burgundy" }),
                                                                                                           "India, Thoughtfully Hosted"
                                                                                                           ),
                                                                                       React.createElement("h1", { className: "rb-rise text-[2.6rem] sm:text-[3.5rem] xl:text-[4rem] leading-[1.02] text-charcoal mb-6 max-w-2xl" }, "A Home-Away-From-Home, Managed So You Don't Have To Worry."),
                                                                                       React.createElement("p", { className: "rb-rise rb-rise-2 text-lg text-charcoal-soft leading-relaxed max-w-md mb-4" }, "Hotels, villas, serviced apartments and boutique stays across India, each one managed to the same exacting standard."),
                                                                                       // Where the stays are, right under the headline (UX-009). Built from destinations.config, so it only
                                                                                       // ever lists destinations the site actually has.
                                                                                       React.createElement("nav", { "aria-label": "Our destinations", className: "rb-rise rb-rise-2 flex flex-wrap items-center gap-x-1.5 text-sm text-charcoal-soft mb-1" },
                                                                                                           React.createElement("svg", { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true, className: "text-sage shrink-0 mr-0.5" },
                                                                                                                               React.createElement("path", { d: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" }),
                                                                                                                               React.createElement("circle", { cx: 12, cy: 9.5, r: 2.5 })
                                                                                                                               ),
                                                                                                           React.createElement("span", null, "Stays in"),
                                                                                                           openDestinations.map(function (d, i) {
                                                                                                             return React.createElement(React.Fragment, { key: d.slug },
                                                                                                                                        React.createElement(Link, { href: "/destinations/" + d.slug, className: "inline-flex items-center min-h-[44px] font-semibold text-charcoal underline decoration-line underline-offset-4 hover-fine:text-burgundy hover-fine:decoration-burgundy transition-colors" }, d.name),
                                                                                                                                        i < openDestinations.length - 2 ? React.createElement("span", { "aria-hidden": true, className: "-ml-1.5" }, ",") : i === openDestinations.length - 2 ? React.createElement("span", null, "&") : null
                                                                                                                                        );
                                                                                                           }),
                                                                                                           openStates.length === 1 && React.createElement("span", { className: "-ml-1.5" }, ", " + openStates[0])
                                                                                                           ),
                                                                                       React.createElement("p", { className: "rb-rise rb-rise-2 text-sm text-charcoal-soft mb-8" },
                                                                                                           React.createElement("span", { className: "text-burgundy" }, "★ "),
                                                                                                           "Airbnb Superhost · Book direct, no OTA fees"
                                                                                                           ),
                                                                                       React.createElement("div", { className: "rb-rise rb-rise-3" },
                                                                                                           React.createElement(CheckAvailabilityWidget, { variant: "hero" })
                                                                                                           ),
                                                                                       React.createElement("div", { className: "flex flex-wrap items-center gap-x-6 gap-y-1 mt-4" },
                                                                                                           React.createElement(Link, { href: "/destinations", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors" }, "Or browse all destinations →"),
                                                                                                           React.createElement(Link, { href: "/about", className: "inline-flex items-center min-h-[44px] text-sm text-charcoal-soft underline decoration-line underline-offset-4 hover-fine:text-charcoal transition-colors" }, "Our Story")
                                                                                                           )
                                                                                       ),
                                                                   heroProperty && React.createElement(Link, { href: "/properties/" + heroProperty.slug, className: "group hidden lg:block" },
                                                                                       React.createElement("div", { className: "relative aspect-[4/5] max-h-[640px] w-full overflow-hidden rounded-sm bg-sand" },
                                                                                                           React.createElement(Image, { src: heroProperty.heroImage, alt: heroProperty.name, fill: true, priority: true, quality: 75, sizes: "(max-width: 1023px) 1px, 45vw", className: "object-cover transition-transform duration-700 ease-snap group-hover-fine:scale-[1.03]" })
                                                                                                           ),
                                                                                       React.createElement("div", { className: "flex items-baseline justify-between gap-4 pt-3 border-b border-line pb-3" },
                                                                                                           React.createElement("p", { className: "font-display text-xl text-charcoal" }, heroProperty.name),
                                                                                                           heroDestination && React.createElement("p", { className: "text-sm text-charcoal-muted" }, heroDestination.name + ", " + heroDestination.state)
                                                                                                           )
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "destinations", className: "scroll-mt-28 border-t border-line" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24" },
                                                                   React.createElement("h2", { className: "text-4xl lg:text-5xl text-charcoal mb-10" }, "Destinations"),
                                                                   React.createElement("div", { className: "grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-14 items-start" },
                                                                                       React.createElement("div", { className: "grid sm:grid-cols-2 gap-x-8 gap-y-6 sm:gap-y-10" },
                                                                                                           destinations.map(function (d) {
                                                                                                             return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "group grid grid-cols-[108px_1fr] gap-4 items-start sm:block" },
                                                                                                                                        React.createElement("div", { className: "relative aspect-square sm:aspect-[3/2] w-full overflow-hidden rounded-sm " + (d.heroImage ? "bg-sand" : "rb-jaali-light") },
                                                                                                                                                            d.heroImage && React.createElement(Image, { src: d.heroImage, alt: d.name, fill: true, quality: 65, sizes: "(max-width: 639px) 108px, (max-width: 1023px) 50vw, 30vw", className: "object-cover transition-transform duration-700 ease-snap group-hover-fine:scale-[1.04]" })
                                                                                                                                                            ),
                                                                                                                                        React.createElement("div", { className: "min-w-0" },
                                                                                                                                        React.createElement("div", { className: "flex items-baseline justify-between gap-3 sm:mt-4" },
                                                                                                                                                            React.createElement("h3", { className: "font-display text-[1.75rem] leading-tight text-charcoal group-hover-fine:text-burgundy transition-colors" }, d.name),
                                                                                                                                                            React.createElement("span", { className: "text-xs font-semibold shrink-0 " + (d.status === "operational" ? "text-sage" : "text-charcoal-muted") }, d.status === "operational" ? "Open" : "Coming soon")
                                                                                                                                                            ),
                                                                                                                                        React.createElement("p", { className: "text-xs font-medium text-charcoal-muted mb-2" }, d.state),
                                                                                                                                        React.createElement("p", { className: "text-sm text-charcoal-soft leading-relaxed" }, d.shortStory)
                                                                                                                                        )
                                                                                                                                        );
                                                                                                           })
                                                                                                           ),
                                                                                       React.createElement(IndiaMap, null)
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { className: "border-y border-line bg-sand/50" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-12 grid sm:grid-cols-3 gap-8 sm:gap-0 sm:divide-x sm:divide-line" },
                                                                   React.createElement("div", { className: "sm:px-8 sm:first:pl-0" },
                                                                                       React.createElement("p", { className: "text-burgundy text-lg mb-1", "aria-hidden": true }, "★"),
                                                                                       React.createElement("h3", { className: "text-charcoal font-semibold mb-1.5" }, "Airbnb Superhost"),
                                                                                       React.createElement("p", { className: "text-charcoal-soft text-sm leading-relaxed" }, "Consistently rated for cleanliness, communication and hospitality across our portfolio.")
                                                                                       ),
                                                                   React.createElement("div", { className: "sm:px-8" },
                                                                                       React.createElement("p", { className: "text-burgundy text-lg mb-1", "aria-hidden": true }, "₹"),
                                                                                       React.createElement("h3", { className: "text-charcoal font-semibold mb-1.5" }, "No OTA Booking Fees"),
                                                                                       React.createElement("p", { className: "text-charcoal-soft text-sm leading-relaxed" }, "Book direct with Ritumbhara and skip the third-party commission markups.")
                                                                                       ),
                                                                   React.createElement("div", { className: "sm:px-8" },
                                                                                       React.createElement("p", { className: "text-burgundy text-lg mb-1", "aria-hidden": true }, "☎"),
                                                                                       React.createElement("h3", { className: "text-charcoal font-semibold mb-1.5" }, "Real Human Support"),
                                                                                       React.createElement("p", { className: "text-charcoal-soft text-sm leading-relaxed" }, "Reach us directly by phone or WhatsApp — no call centers, no chatbots.")
                                                                                       )
                                                                   )
                                               ),
                           React.createElement("section", { id: "properties", className: "scroll-mt-28 py-16 lg:py-24" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10" },
                                                                   React.createElement("div", { className: "grid lg:grid-cols-[1fr_1fr] gap-4 lg:gap-16 items-end mb-10" },
                                                                                       React.createElement("h2", { className: "text-4xl lg:text-5xl text-charcoal" }, "Featured Properties"),
                                                                                       React.createElement("p", { className: "text-charcoal-soft leading-relaxed max-w-md lg:justify-self-end" }, "A handful of stays from across our portfolio — each managed to the same standard.")
                                                                                       ),
                                                                   React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8 sm:gap-y-12" },
                                                                                       featured.map(function (p) {
                                                                                         return React.createElement(PropertyCard, { key: p.slug, property: p });
                                                                                       })
                                                                                       )
                                                                   )
                                               ),
                           // The one full-colour brand moment on the page.
                           React.createElement("section", { id: "standard", className: "scroll-mt-28 relative overflow-hidden bg-burgundy py-16 lg:py-24" },
                                               React.createElement("div", { className: "absolute inset-0 rb-jaali opacity-[0.12]", "aria-hidden": true }),
                                               React.createElement("div", { className: "relative max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center" },
                                                                   React.createElement("div", null,
                                                                                       React.createElement("h2", { className: "text-4xl lg:text-5xl text-ivory mb-5" }, "The Ritumbhara Standard"),
                                                                                       React.createElement("p", { className: "text-ivory/80 text-lg leading-relaxed max-w-xl" }, "Guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety and communication, applied consistently across every property we manage."),
                                                                                       React.createElement(Link, { href: "/about#foco", className: "inline-flex items-center gap-1 min-h-[44px] mt-4 text-ivory font-semibold underline decoration-ivory/40 underline-offset-4 hover-fine:decoration-ivory transition-colors" }, "Learn about our FOCO model", React.createElement("span", { "aria-hidden": true }, "→"))
                                                                                       ),
                                                                   React.createElement("ul", { className: "grid grid-cols-2 gap-x-8 border-t border-ivory/20" },
                                                                                       standardItems.map(function (item) {
                                                                                         return React.createElement("li", { key: item, className: "border-b border-ivory/20 py-3.5 text-ivory text-[15px] sm:text-base font-medium flex items-center gap-3" },
                                                                                                                    React.createElement("span", { "aria-hidden": true, className: "w-1.5 h-1.5 rounded-full bg-sage-light shrink-0" }),
                                                                                                                    item
                                                                                                                    );
                                                                                       })
                                                                                       )
                                                                   )
                                               ),
                           React.createElement(Testimonials, null),
                           React.createElement("section", { className: "max-w-7xl mx-auto px-6 lg:px-10 py-14 lg:py-20 flex justify-center" },
                                               React.createElement(LeadCaptureForm, {
                                                 title: "Not ready to book yet?",
                                                 subtitle: "Leave your email and we'll let you know about new destinations, availability, and offers.",
                                               })
                                               ),
                           React.createElement("section", { id: "faq", className: "scroll-mt-28 border-t border-line" },
                                               React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16" },
                                                                   React.createElement("h2", { className: "text-4xl lg:text-5xl text-charcoal" }, "Frequently Asked Questions"),
                                                                   React.createElement("div", { className: "divide-y divide-line border-y border-line" },
                                                                                       faqs.map(function (f) {
                                                                                         return React.createElement("div", { key: f.question, className: "py-6" },
                                                                                                                    React.createElement("h3", { className: "font-semibold text-charcoal text-[17px] mb-2" }, f.question),
                                                                                                                    React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed" }, f.answer)
                                                                                                                    );
                                                                                       })
                                                                                       )
                                                                   )
                                               )
                           );
}

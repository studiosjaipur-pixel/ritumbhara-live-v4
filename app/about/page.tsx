import React from "react";
import Link from "next/link";
import { socialMetadata } from "@/lib/seo";
import { breadcrumbSchema, faqSchema, pageSchema } from "@/lib/schema";
import type { Faq } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";
import FaqSection from "@/components/FaqSection";

const aboutTitle = "Our Story & FOCO Property Management";
const aboutDescription = "Ritumbhara is a hospitality management company built to bring one consistent standard to hotels, studios, villas and serviced apartments across India.";

export const metadata = {
    title: aboutTitle,
    description: aboutDescription,
    alternates: { canonical: "/about" },
    ...socialMetadata("/about", aboutTitle + " | Ritumbhara", aboutDescription),
};

const sections = [
  { heading: "Our Story", body: "Ritumbhara began with a simple observation about Indian hospitality: guests wanted consistency more than spectacle. A traveler booking a stay in Jaipur or Alwar deserved the same standard of housekeeping, service, and care regardless of which building they walked into." },
  { heading: "Vision", body: "To become India's most trusted hospitality management company, present in over a hundred cities, without ever compromising the standard a guest can expect from a single Ritumbhara-managed stay." },
  { heading: "Mission", body: "We manage hotels, studios, villas, and serviced apartments to one operating standard, so that owners gain professional management and guests gain certainty." },
  { heading: "The Ritumbhara Standard", body: "Ten commitments, guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety, and communication, apply identically whether a property is a compact studio in Jaipur or a villa in Sariska." },
  { heading: "FOCO Model & Future Expansion", body: "Ritumbhara partners with property owners under a Franchise-Owned, Company-Operated model: owners retain the asset, Ritumbhara brings systems, staffing standards, technology, and brand." },
  ];

const faqs: Faq[] = [
  {
    question: "What does FOCO stand for?",
    answer: "Franchise-Owned, Company-Operated. Under this model the property owner keeps the asset, and Ritumbhara operates it, bringing systems, staffing standards, technology and brand.",
  },
  {
    question: "What types of property does Ritumbhara manage?",
    answer: "Studios, serviced apartments and villas today. Hotels, resorts and other categories are planned as the portfolio grows.",
  },
  {
    question: "Where does Ritumbhara operate?",
    answer: "Jaipur and Alwar in Rajasthan, and near Sariska Tiger Reserve in Alwar district. Agra, Uttar Pradesh, is the next destination.",
  },
  {
    question: "How do I become a Ritumbhara partner?",
    answer: "Start with the Partner With Us form, or contact the team to talk it through first. The FOCO model above explains what owners keep and what Ritumbhara takes on.",
  },
];

const linkClass = "text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy";

export default function AboutPage() {
    // sections[0] is the opening story; its heading ("Our Story") is the page H1, so it is not
    // repeated as an H2 (previously a duplicate heading).
    const lead = sections[0];
    const rest = sections.slice(1);
    return React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 lg:pt-36 pb-20" },
                                   React.createElement(JsonLd, { data: pageSchema("AboutPage", aboutTitle, "/about", aboutDescription) }),
                                   React.createElement(JsonLd, { data: breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Our Story", path: "/about" }]) }),
                                   React.createElement(JsonLd, { data: faqSchema(faqs) }),
                                   React.createElement("section", { className: "grid lg:grid-cols-[0.8fr_1.2fr] gap-4 lg:gap-12 items-start pb-8 lg:pb-10 mb-10 lg:mb-12 border-b border-line" },
                                                             React.createElement("h1", { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal" }, lead.heading),
                                                             React.createElement("p", { className: "text-lg text-charcoal leading-relaxed max-w-2xl lg:pt-2" }, lead.body)
                                                           ),
                                   React.createElement("div", { className: "grid sm:grid-cols-2 gap-x-10 lg:gap-x-16 gap-y-10 lg:gap-y-14" },
                                                             rest.map(function (s) {
                                                                     const isFoco = s.heading.indexOf("FOCO") === 0;
                                                                     return React.createElement("section", { key: s.heading, id: isFoco ? "foco" : undefined, "data-about-card": true },
                                                                                                        React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-2" }, s.heading),
                                                                                                        React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed" }, s.body),
                                                                                                        isFoco && React.createElement(Link, { href: "/contact", className: "inline-flex items-center gap-1 min-h-[44px] mt-2 text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Partner with our team", React.createElement("span", { "aria-hidden": true }, "→"))
                                                                                                      );
                                                             })
                                                           ),
                                   React.createElement("div", { className: "grid sm:grid-cols-2 gap-x-10 lg:gap-x-16 gap-y-10 lg:gap-y-14 mt-10 lg:mt-14" },
                                                             React.createElement("section", null,
                                                                                 React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-2" }, "Where we operate today"),
                                                                                 React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed mb-2" }, "Ritumbhara hosts guests in Jaipur and Alwar, Rajasthan, and near Sariska Tiger Reserve in Alwar district. Today the portfolio is studios, serviced apartments and a villa. Agra, Uttar Pradesh, is next."),
                                                                                 React.createElement(Link, { href: "/destinations", className: linkClass + " inline-flex items-center min-h-[44px]" }, "Browse destinations")
                                                                               ),
                                                             React.createElement("section", null,
                                                                                 React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-2" }, "For property owners"),
                                                                                 React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed mb-2" }, "If you own a hotel, villa, studio or serviced apartment and want it run to a consistent standard, the FOCO model keeps the asset yours while Ritumbhara handles operations."),
                                                                                 React.createElement("div", { className: "flex flex-wrap gap-x-6" },
                                                                                                     React.createElement("a", { href: "/partner-onboarding.html", className: linkClass + " inline-flex items-center min-h-[44px]" }, "Partner With Us"),
                                                                                                     React.createElement(Link, { href: "/contact", className: linkClass + " inline-flex items-center min-h-[44px]" }, "Contact the team")
                                                                                                   )
                                                                               ),
                                                             React.createElement("section", null,
                                                                                 React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-2" }, "Bookings and company details"),
                                                                                 React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed" }, "Ritumbhara is a brand of LilacMosaic Technologies Private Limited. This website does not process reservations or payments. Each property page links to its secure booking page on Hotel Spider, our booking engine partner.")
                                                                               ),
                                                             React.createElement("section", null,
                                                                                 React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-2" }, "Experiences around our stays"),
                                                                                 React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed mb-2" }, "Local experiences are one of our ten commitments. See what is close to each destination, from Jaipur's palaces to Sariska Tiger Reserve."),
                                                                                 React.createElement(Link, { href: "/experiences", className: linkClass + " inline-flex items-center min-h-[44px]" }, "Explore experiences")
                                                                               )
                                                           ),
                                   React.createElement(FaqSection, { heading: "Questions about Ritumbhara", faqs: faqs }),
                                   React.createElement("div", { className: "bg-sand/70 rounded-sm mt-12 lg:mt-16 px-6 py-6 sm:px-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between" },
                                                             React.createElement("p", { className: "font-display text-[1.75rem] leading-tight text-charcoal" }, "See where we host today."),
                                                             React.createElement(Link, { href: "/destinations", className: "inline-flex items-center justify-center min-h-[48px] px-6 bg-burgundy text-ivory font-semibold rounded-sm hover-fine:bg-burgundy-deep transition-colors" }, "Explore Destinations")
                                                           )
                                 );
}

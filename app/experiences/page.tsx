import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { experiences } from "@/config/experiences.config";
import { destinations } from "@/config/destinations.config";
import { destinationLocations, propertyLocations } from "@/config/locations.config";
import ExperienceCard from "@/components/ExperienceCard";
import JsonLd from "@/components/JsonLd";
import FaqSection from "@/components/FaqSection";
import { socialMetadata } from "@/lib/seo";
import { breadcrumbSchema, faqSchema, pageSchema } from "@/lib/schema";
import type { Faq } from "@/lib/schema";

const experiencesTitle = "Experiences: Heritage Walks, Food & Wildlife";
const experiencesDescription = "Discover the experiences that define a stay with Ritumbhara — from heritage walks to slow mornings and wildlife encounters.";

export const metadata: Metadata = {
      title: experiencesTitle,
      description: experiencesDescription,
      alternates: { canonical: "/experiences" },
      ...socialMetadata("/experiences", experiencesTitle + " | Ritumbhara", experiencesDescription),
};

const linkClass = "text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors";

// Everything below comes from config/destinations.config.ts and config/locations.config.ts,
// the same verified data used on the destination and property pages.
const alwar = destinations.find(function (d) { return d.slug === "alwar"; });

const areas: { slug: string; name: string; intro: string; items: string[]; guides: { href: string; label: string }[] }[] = [
  {
    slug: "jaipur",
    name: "Jaipur",
    intro: "Distances are by car from the Karolan Ka Barh studios, where most of our Jaipur stays are.",
    items: destinationLocations.jaipur.nearby,
    guides: [
      { href: "/journal/jaipur-pink-city-walking-guide", label: "Jaipur's Pink City Walking Guide" },
      { href: "/journal/best-time-to-visit-jaipur", label: "Best Time to Visit Jaipur" },
    ],
  },
  {
    slug: "alwar",
    name: "Alwar",
    intro: "A historic district of forts and forest.",
    items: alwar ? alwar.thingsToDo.map(function (t) { return t.title + ": " + t.description; }) : [],
    guides: [{ href: "/journal/alwar-weekend-guide", label: "A Weekend in Alwar" }],
  },
  {
    slug: "sariska",
    name: "Sariska",
    intro: "Villa 65 Sariska is in Alwar district, near Sariska Tiger Reserve.",
    items: propertyLocations["villa-65-sariska"].nearby,
    guides: [
      { href: "/journal/jaipur-to-sariska-day-trip", label: "Jaipur to Sariska: Planning the Day Trip" },
      { href: "/journal/where-to-stay-near-sariska", label: "Where to Stay Near Sariska" },
    ],
  },
];

const faqs: Faq[] = [
  {
    question: "Which destination is best for wildlife?",
    answer: "Sariska. Villa 65 Sariska is in Alwar district near Sariska Tiger Reserve, where safari drives run through one of India's prominent tiger reserves. The villa is 12 km (about 30 minutes) by road from Alwar city.",
  },
  {
    question: "Where can I do heritage sightseeing?",
    answer: "In Jaipur, Hawa Mahal and City Palace are about 20 minutes by car from our Karolan Ka Barh studios. In Alwar, Bala Qila and City Palace define the city's skyline, and Siliserh Lake is just outside the city.",
  },
  {
    question: "Where can I read more before choosing a stay?",
    answer: "Our journal has travel guides for each destination, including a Pink City walking guide, a weekend in Alwar, and planning a day trip from Jaipur to Sariska.",
  },
];

export default function ExperiencesPage() {
      return React.createElement(
              "main",
          { className: "pt-32 lg:pt-36 pb-24 px-6 lg:px-10 max-w-7xl mx-auto" },
              React.createElement(JsonLd, { data: pageSchema("WebPage", experiencesTitle, "/experiences", experiencesDescription) }),
              React.createElement(JsonLd, { data: breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Experiences", path: "/experiences" }]) }),
              React.createElement(JsonLd, { data: faqSchema(faqs) }),
              React.createElement(
                        "h1",
                  { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-4" },
                        "Experiences"
                      ),
              React.createElement(
                        "p",
                  { className: "text-charcoal-soft max-w-2xl mb-12 pb-6 border-b border-line leading-relaxed" },
                        "A stay with Ritumbhara is shaped as much by what surrounds it as by the space itself. These are the moments we design around."
                      ),
              React.createElement(
                        "ol",
                  { className: "grid sm:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-10 lg:gap-y-14" },
                        experiences.map((exp, i) =>
                                    React.createElement(ExperienceCard, { key: exp.id, experience: exp, index: i })
                                              )
                      ),
              React.createElement(
                        "section",
                  { className: "mt-14 lg:mt-20 pt-10 border-t border-line" },
                        React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal mb-2" }, "Experiences near each destination"),
                        React.createElement("p", { className: "text-charcoal-soft max-w-2xl mb-8 leading-relaxed" }, "What is actually close to our stays. Distances are approximate and match our destination and property pages."),
                        React.createElement(
                                    "div",
                                    { className: "grid md:grid-cols-3 gap-x-10 lg:gap-x-14 gap-y-10" },
                                    areas.map(function (a) {
                                      return React.createElement("article", { key: a.slug },
                                        React.createElement("h3", { className: "text-[1.5rem] leading-tight text-charcoal mb-2" },
                                          React.createElement(Link, { href: "/destinations/" + a.slug, className: "hover-fine:text-burgundy transition-colors" }, a.name)),
                                        React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed mb-3" }, a.intro),
                                        React.createElement("ul", { className: "space-y-2 mb-3" },
                                          a.items.map(function (item) {
                                            return React.createElement("li", { key: item, className: "text-[15px] text-charcoal-soft leading-relaxed" }, item);
                                          })),
                                        React.createElement("div", { className: "flex flex-col" },
                                          a.guides.map(function (g) {
                                            return React.createElement(Link, { key: g.href, href: g.href, className: linkClass + " inline-flex items-center min-h-[44px]" }, g.label);
                                          }))
                                      );
                                    })
                                  )
                      ),
              React.createElement(FaqSection, { heading: "Questions about experiences", faqs: faqs }),
              React.createElement(
                        "div",
                  { className: "bg-sand/70 rounded-sm mt-12 lg:mt-14 px-6 py-6 sm:px-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between" },
                        React.createElement("p", { className: "font-display text-[1.75rem] leading-tight text-charcoal" }, "Find a stay close to these experiences."),
                        React.createElement(
                                    "div",
                                    { className: "flex flex-wrap items-center gap-x-6 gap-y-2" },
                                    React.createElement(Link, { href: "/destinations", className: "inline-flex items-center justify-center min-h-[48px] px-6 bg-burgundy text-ivory font-semibold rounded-sm hover-fine:bg-burgundy-deep transition-colors" }, "Explore destination stays"),
                                    React.createElement(Link, { href: "/journal", className: "inline-flex items-center min-h-[48px] font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors" }, "Read travel guides")
                                  )
                      )
            );
}

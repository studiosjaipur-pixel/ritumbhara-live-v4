import React from "react";
import Link from "next/link";
import Image from "next/image";
import { destinations } from "@/config/destinations.config";
import { destinationLocations, propertyLocations } from "@/config/locations.config";
import { bookingEngine } from "@/config/booking.config";
import { socialMetadata } from "@/lib/seo";
import { breadcrumbSchema, faqSchema, pageSchema } from "@/lib/schema";
import type { Faq } from "@/lib/schema";
import JsonLd from "@/components/JsonLd";
import FaqSection from "@/components/FaqSection";
import StayFinder from "@/components/StayFinder";

const destinationsTitle = "Stays in Jaipur, Alwar & Sariska";
const destinationsDescription = "Studios, serviced apartments and a villa managed by Ritumbhara in Jaipur, Alwar and Sariska, Rajasthan, with Agra coming soon.";

export const metadata = {
    title: destinationsTitle,
    description: destinationsDescription,
    alternates: { canonical: "/destinations" },
    ...socialMetadata("/destinations", destinationsTitle + " | Ritumbhara", destinationsDescription),
};

const linkClass = "text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors";

// Facts below come from config/locations.config.ts, config/destinations.config.ts and
// config/booking.config.ts, so they stay in step with the destination and property pages.
const jaipurLoc = destinationLocations.jaipur;
const sariskaLoc = propertyLocations["villa-65-sariska"];
const alwar = destinations.find(function (d) { return d.slug === "alwar"; });

const faqs: Faq[] = [
  {
    question: "Which destination should I choose?",
    answer: "Choose Jaipur for the Pink City and its palaces, Alwar for forts and lakes, and Sariska for a stay near the tiger reserve. Our journal guide to choosing a base compares the three in more detail.",
  },
  {
    question: "How far are the Jaipur studios from the airport and railway stations?",
    answer: "Most of our Jaipur studios are in Karolan Ka Barh, Jeerota village, about 19 km from central Jaipur. Jaipur International Airport is around 15 km away (about 26 minutes by car), Getor Jagatpura Railway Station about 7 to 8 km, and Gandhinagar Jaipur Station about 10 to 12 km. Studio 925 is at a different address, in Jagatpura, so these distances do not apply to it.",
  },
  {
    question: "Is Ritumbhara open in Agra?",
    answer: "Not yet. Agra, Uttar Pradesh, is our next destination. You can register your interest on the Agra page to hear when stays open.",
  },
  {
    question: "Can I book through this website?",
    answer: "This website does not process reservations or payments. Each property page links to that property's secure booking page on Hotel Spider, our booking engine partner. You can also message us on WhatsApp to check availability first.",
  },
];

const terms: { label: string; value: string }[] = [
  { label: "Check-in", value: bookingEngine.checkIn },
  { label: "Check-out", value: "By " + bookingEngine.checkOut },
  { label: "Cancellation", value: bookingEngine.cancellation },
  { label: "Payment", value: bookingEngine.payment },
];

function destinationBlock(key: string, name: string, href: string, paragraphs: string[], guideHref: string, guideLabel: string) {
    return React.createElement("article", { key: key },
        React.createElement("h3", { className: "text-[1.5rem] leading-tight text-charcoal mb-2" },
            React.createElement(Link, { href: href, className: "hover-fine:text-burgundy transition-colors" }, name)),
        paragraphs.map(function (p, i) {
            return React.createElement("p", { key: i, className: "text-[15px] text-charcoal-soft leading-relaxed mb-3" }, p);
        }),
        React.createElement("div", { className: "flex flex-wrap gap-x-6" },
            React.createElement(Link, { href: href, className: linkClass + " inline-flex items-center min-h-[44px]" }, "See " + name + " stays"),
            React.createElement(Link, { href: guideHref, className: linkClass + " inline-flex items-center min-h-[44px]" }, guideLabel)
        )
    );
}

export default function DestinationsPage() {
    return React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 lg:pt-36 pb-24" },
                                   React.createElement(JsonLd, { data: pageSchema("CollectionPage", destinationsTitle, "/destinations", destinationsDescription) }),
                                   React.createElement(JsonLd, { data: breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Destinations", path: "/destinations" }]) }),
                                   React.createElement(JsonLd, { data: faqSchema(faqs) }),
                                   React.createElement("h1", { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-4" }, "Destinations"),
                                   React.createElement("p", { className: "text-charcoal-soft max-w-2xl mb-12 pb-6 border-b border-line leading-relaxed" }, "Studios, serviced apartments and a villa in Jaipur, Alwar and Sariska, Rajasthan, each managed to the Ritumbhara Standard. Agra, Uttar Pradesh, is coming soon."),
                                   React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 sm:gap-y-10" },
                                                             destinations.map(function (d) {
                                                                       return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "group grid grid-cols-[108px_1fr] gap-4 items-start sm:flex sm:flex-col sm:gap-0" },
                                                                                                            React.createElement("div", { className: "relative aspect-square sm:aspect-[4/5] w-full overflow-hidden rounded-sm " + (d.heroImage ? "bg-sand" : "rb-jaali-light") },
                                                                                                                                d.heroImage && React.createElement(Image, { src: d.heroImage, alt: "Ritumbhara stay in " + d.name + ", " + d.state, fill: true, quality: 65, sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw", className: "object-cover transition-transform duration-500 ease-snap group-hover-fine:scale-[1.04]" })
                                                                                                                                ),
                                                                                                            React.createElement("div", { className: "min-w-0 sm:pt-4 flex flex-col flex-1" },
                                                                                                                                React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal group-hover-fine:text-burgundy transition-colors" }, d.name + (d.status === "coming-soon" ? " (Coming Soon)" : "")),
                                                                                                                                React.createElement("p", { className: "text-xs font-medium text-charcoal-muted mb-2" }, d.state + " · ", React.createElement("span", { className: d.status === "operational" ? "text-sage" : "" }, d.status === "operational" ? "Open" : "Coming soon")),
                                                                                                                                React.createElement("p", { className: "text-sm text-charcoal-soft leading-relaxed" }, d.shortStory)
                                                                                                                                )
                                                                                                          );
                                                             })
                                                           ),
                                   React.createElement(StayFinder, null),
                                   React.createElement("section", { className: "mt-14 lg:mt-20 pt-10 border-t border-line" },
                                                             React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal mb-2" }, "Choosing where to stay"),
                                                             React.createElement("p", { className: "text-charcoal-soft max-w-2xl mb-8 leading-relaxed" }, "Each destination suits a different kind of trip. Distances are approximate and match what is published on our destination and property pages."),
                                                             React.createElement("div", { className: "grid md:grid-cols-3 gap-x-10 lg:gap-x-14 gap-y-10" },
                                                                                 destinationBlock("jaipur", "Jaipur", "/destinations/jaipur", [
                                                                                     "Ritumbhara's founding destination, with five managed studios. Most are in " + jaipurLoc.area.replace(", Jaipur", "") + ", about 19 km from central Jaipur. Studio 925 is at " + propertyLocations["studio-925"].area + ".",
                                                                                     "From the Karolan Ka Barh studios, Chokhi Dhani is about 6 minutes by car, and Hawa Mahal and City Palace are about 20 minutes each. Jaipur International Airport is around 15 km away.",
                                                                                 ], "/serviced-apartments-jaipur", "Jaipur travel guide"),
                                                                                 destinationBlock("alwar", "Alwar", "/destinations/alwar", [
                                                                                     "A historic district of forts and forest. Bala Qila & City Palace define Alwar's skyline, and Siliserh Lake is a quiet spot just outside the city.",
                                                                                     "Ritumbhara lists studios and a serviced apartment under Alwar. The studios sleep up to 2 guests and Apartment 813 up to 6. Getting there: " + (alwar ? alwar.transportation : "Alwar Junction railway station."),
                                                                                 ], "/studios-in-alwar", "Alwar travel guide"),
                                                                                 destinationBlock("sariska", "Sariska", "/destinations/sariska", [
                                                                                     "Villa 65 Sariska is in Alwar district, near Sariska Tiger Reserve, " + sariskaLoc.summary.charAt(0).toLowerCase() + sariskaLoc.summary.slice(1) + ".",
                                                                                     "Alwar Railway Station is 15 km away. From Delhi it is approximately 160 km (around 3 to 3.5 hours by road), and from Jaipur approximately 150 km (around 2.5 to 3 hours).",
                                                                                 ], "/stays-in-sariska", "Sariska travel guide")
                                                                               ),
                                                             React.createElement("p", { className: "mt-8 text-[15px] text-charcoal-soft leading-relaxed" },
                                                                                 "Agra, Uttar Pradesh, is next. ",
                                                                                 React.createElement(Link, { href: "/destinations/agra", className: linkClass }, "Register your interest in Agra"),
                                                                                 ". Not sure where to base yourself? Read ",
                                                                                 React.createElement(Link, { href: "/journal/jaipur-alwar-sariska-rajasthan-itinerary", className: linkClass }, "Jaipur, Alwar, or Sariska: Choosing Your Base for a Rajasthan Trip"),
                                                                                 "."
                                                                               )
                                                           ),
                                   React.createElement("section", { className: "mt-12 lg:mt-16" },
                                                             React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal mb-4" }, "Stay terms at a glance"),
                                                             React.createElement("dl", { className: "grid sm:grid-cols-2 gap-x-12 gap-y-4 max-w-3xl" },
                                                                                 terms.map(function (t) {
                                                                                     return React.createElement("div", { key: t.label, className: "border-t border-line pt-3" },
                                                                                         React.createElement("dt", { className: "text-xs font-semibold text-sage mb-1" }, t.label),
                                                                                         React.createElement("dd", { className: "text-[15px] text-charcoal leading-relaxed" }, t.value));
                                                                                 })
                                                                               ),
                                                             React.createElement("p", { className: "mt-4 text-sm text-charcoal-muted max-w-3xl leading-relaxed" }, "These are the terms on our online booking engine for rooms booked there. If you arrange a stay with us on WhatsApp, please confirm the terms with us before you book.")
                                                           ),
                                   React.createElement(FaqSection, { heading: "Questions about our destinations", faqs: faqs })
                                 );
}

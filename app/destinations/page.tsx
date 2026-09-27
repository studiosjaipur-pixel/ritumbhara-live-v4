import React from "react";
import Link from "next/link";
import Image from "next/image";
import { destinations } from "@/config/destinations.config";
import { socialMetadata } from "@/lib/seo";

const destinationsTitle = "Stays in Jaipur, Alwar & Sariska";
const destinationsDescription = "Studios, serviced apartments and a villa managed by Ritumbhara in Jaipur, Alwar and Sariska, Rajasthan, with Agra coming soon.";

export const metadata = {
    title: destinationsTitle,
    description: destinationsDescription,
    alternates: { canonical: "/destinations" },
    ...socialMetadata("/destinations", destinationsTitle + " | Ritumbhara", destinationsDescription),
};

export default function DestinationsPage() {
    return React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 lg:pt-36 pb-24" },
                                   React.createElement("h1", { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-4" }, "Destinations"),
                                   React.createElement("p", { className: "text-charcoal-soft max-w-2xl mb-12 pb-6 border-b border-line leading-relaxed" }, "Studios, serviced apartments and a villa in Jaipur, Alwar and Sariska, Rajasthan, each managed to the Ritumbhara Standard. Agra, Uttar Pradesh, is coming soon."),
                                   React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 sm:gap-y-10" },
                                                             destinations.map(function (d) {
                                                                       return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "group grid grid-cols-[108px_1fr] gap-4 items-start sm:flex sm:flex-col sm:gap-0" },
                                                                                                            React.createElement("div", { className: "relative aspect-square sm:aspect-[4/5] w-full overflow-hidden rounded-sm " + (d.heroImage ? "bg-sand" : "rb-jaali-light") },
                                                                                                                                d.heroImage && React.createElement(Image, { src: d.heroImage, alt: d.name, fill: true, quality: 65, sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw", className: "object-cover transition-transform duration-500 ease-snap group-hover-fine:scale-[1.04]" })
                                                                                                                                ),
                                                                                                            React.createElement("div", { className: "min-w-0 sm:pt-4 flex flex-col flex-1" },
                                                                                                                                React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal group-hover-fine:text-burgundy transition-colors" }, d.name + (d.status === "coming-soon" ? " (Coming Soon)" : "")),
                                                                                                                                React.createElement("p", { className: "text-xs font-medium text-charcoal-muted mb-2" }, d.state + " \u00B7 ", React.createElement("span", { className: d.status === "operational" ? "text-sage" : "" }, d.status === "operational" ? "Open" : "Coming soon")),
                                                                                                                                React.createElement("p", { className: "text-sm text-charcoal-soft leading-relaxed" }, d.shortStory)
                                                                                                                                )
                                                                                                          );
                                                             })
                                                           )
                                 );
}

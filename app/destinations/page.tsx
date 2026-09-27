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
                                   React.createElement("h1", { className: "text-4xl lg:text-5xl font-semibold text-[#1A1A1A] mb-4" }, "Destinations"),
                                   React.createElement("p", { className: "text-neutral-600 max-w-2xl mb-12 pb-6 border-b border-[#EDE7DD] leading-relaxed" }, "Studios, serviced apartments and a villa in Jaipur, Alwar and Sariska, Rajasthan, each managed to the Ritumbhara Standard. Agra, Uttar Pradesh, is coming soon."),
                                   React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-6" },
                                                             destinations.map(function (d) {
                                                                       return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "group bg-white border border-[#EDE7DD] rounded-md overflow-hidden flex flex-col hover-fine:-translate-y-1 hover-fine:shadow-[0_14px_32px_rgba(26,26,26,0.08)] active:scale-[0.98] active:translate-y-0 active:duration-100 transition-[transform,box-shadow] duration-300 ease-snap" },
                                                                                                            React.createElement("div", { className: "relative aspect-[4/3] w-full overflow-hidden " + (d.heroImage ? "bg-[#EDE7DD]" : "rb-jaali") },
                                                                                                                                d.heroImage && React.createElement(Image, { src: d.heroImage, alt: d.name, fill: true, quality: 65, sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw", className: "object-cover transition-transform duration-500 ease-snap group-hover-fine:scale-[1.04]" }),
                                                                                                                                React.createElement("span", { className: "absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full " + (d.status === "operational" ? "bg-white/95 text-[#1A1A1A]" : "bg-[#1A1A1A]/80 text-white") }, d.status === "operational" ? "Open" : "Coming soon")
                                                                                                                                ),
                                                                                                            React.createElement("div", { className: "p-5 flex flex-col flex-1" },
                                                                                                                                React.createElement("h2", { className: "text-lg font-semibold text-[#1A1A1A]" }, d.name + (d.status === "coming-soon" ? " (Coming Soon)" : "")),
                                                                                                                                React.createElement("p", { className: "text-xs font-medium text-[#97183C] mb-2" }, d.state),
                                                                                                                                React.createElement("p", { className: "text-sm text-[#4A4A4A] leading-relaxed" }, d.shortStory)
                                                                                                                                )
                                                                                                          );
                                                             })
                                                           )
                                 );
}

import React from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";

export const metadata = {
    title: "Destinations",
    description: "Explore Ritumbhara destinations across India.",
    alternates: { canonical: "/destinations" },
};

export default function DestinationsPage() {
    return React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-24" },
                                   React.createElement("h1", { className: "text-4xl font-semibold text-[#1A1A1A] mb-12" }, "Destinations"),
                                   React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-6" },
                                                             destinations.map(function (d) {
                                                                       return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "border border-[#EDE7DD] rounded-md p-6 block hover:shadow-lg transition-shadow" },
                                                                                                            React.createElement("h2", { className: "font-semibold text-[#1A1A1A] mb-2" }, d.name + (d.status === "coming-soon" ? " (Coming Soon)" : "")),
                                                                                                            React.createElement("p", { className: "text-sm text-[#4A4A4A]" }, d.shortStory)
                                                                                                          );
                                                             })
                                                           )
                                 );
}

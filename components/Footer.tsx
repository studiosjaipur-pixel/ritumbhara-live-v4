import React from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";

export default function Footer() {
  return React.createElement("footer", { id: "footer", className: "bg-[#1A1A1A] text-white/80 pt-20 pb-8" },
    React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-2 lg:grid-cols-4 gap-12 mb-16" },
    React.createElement("div", null,
    React.createElement("div", { className: "w-16 h-16 bg-[#97183C] rounded-sm flex items-center justify-center text-sm font-semibold mb-4" }, "Ritumbhara", React.createElement("sup", { className: "text-[7px] ml-0.5 font-normal" }, "\u00AE")),
    React.createElement("p", { className: "text-sm text-white/60" }, "A hospitality management company curating hotels, villas, and boutique stays across India.")
    ),
    React.createElement("div", null,
    React.createElement("h4", { className: "font-semibold text-white mb-4" }, "Destinations"),
    destinations.map(function (d) {
    return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: "block text-sm text-white/60 hover:text-white mb-2" }, d.name + (d.status === "coming-soon" ? " (Coming Soon)" : ""));
    })
    ),
    React.createElement("div", null,
    React.createElement("h4", { className: "font-semibold text-white mb-4" }, "Company"),
    React.createElement(Link, { href: "/about", className: "block text-sm text-white/60 hover:text-white mb-2" }, "Our Story"),
    React.createElement(Link, { href: "/#standard", className: "block text-sm text-white/60 hover:text-white mb-2" }, "The Ritumbhara Standard")
    ),
    React.createElement("div", null,
    React.createElement("h4", { className: "font-semibold text-white mb-4" }, "Contact"),
    React.createElement("p", { className: "text-sm text-white/60 mb-2" }, "reservations@ritumbhara.com")
    )
    ),
    React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-8 border-t border-white/10 flex justify-between text-xs text-white/40" },
    React.createElement("p", null, "\u00A9 " + new Date().getFullYear() + " Ritumbhara. All rights reserved."),
    React.createElement("p", null, "All reservations are securely processed via Hotel Spider.")
    )
    );
}

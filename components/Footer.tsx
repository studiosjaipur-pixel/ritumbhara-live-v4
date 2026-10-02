import React from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";
import { bookingEngine } from "@/config/booking.config";

const linkClass = "inline-flex items-center min-h-[40px] text-sm text-ivory/65 hover-fine:text-ivory transition-colors duration-200";

export default function Footer() {
  return React.createElement("footer", { id: "footer", className: "bg-charcoal text-ivory/80 pt-14 lg:pt-20 pb-24 lg:pb-10" },
    React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 grid sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-x-12 gap-y-10 mb-14" },
      React.createElement("div", { className: "max-w-xs" },
        React.createElement("p", { className: "inline-flex font-display text-[2rem] leading-none font-semibold text-ivory mb-4" }, "Ritumbhara", React.createElement("sup", { className: "font-sans text-[8px] ml-0.5 font-normal mt-1.5" }, "\u00AE")),
        React.createElement("p", { className: "text-sm leading-relaxed text-ivory/60" }, "A hospitality management company curating hotels, villas, and boutique stays across India.")
      ),
      React.createElement("div", null,
        React.createElement("h4", { className: "text-xs font-semibold tracking-[0.14em] uppercase text-[#C8A96A] mb-3" }, "Destinations"),
        React.createElement("div", { className: "flex flex-col" },
          destinations.map(function (d) {
            return React.createElement(Link, { key: d.slug, href: "/destinations/" + d.slug, className: linkClass }, d.name + (d.status === "coming-soon" ? " (Coming Soon)" : ""));
          })
        )
      ),
      React.createElement("div", null,
        React.createElement("h4", { className: "text-xs font-semibold tracking-[0.14em] uppercase text-[#C8A96A] mb-3" }, "Company"),
        React.createElement("div", { className: "flex flex-col" },
          React.createElement(Link, { href: "/about", className: linkClass }, "Our Story"),
          React.createElement(Link, { href: "/#standard", className: linkClass }, "The Ritumbhara Standard"),
          React.createElement(Link, { href: "/experiences", className: linkClass }, "Experiences"),
          React.createElement(Link, { href: "/journal", className: linkClass }, "Journal"),
          React.createElement(Link, { href: "/contact", className: linkClass }, "Contact"),
          React.createElement(Link, { href: "/#policies", className: linkClass }, "Booking Policies"),
          React.createElement("a", { href: "/partner-onboarding.html", className: linkClass }, "Partner With Us")
        )
      ),
      React.createElement("div", null,
        React.createElement("h4", { className: "text-xs font-semibold tracking-[0.14em] uppercase text-[#C8A96A] mb-3" }, "Contact"),
        React.createElement("div", { className: "flex flex-col" },
          React.createElement("a", { href: "tel:+919503002629", className: linkClass }, "+91 95030 02629"),
          React.createElement("a", { href: "mailto:reservations@ritumbhara.com", className: linkClass + " break-all" }, "reservations@ritumbhara.com"),
          // Business address as listed on the Hotel-Spider booking engine (UX-010).
          React.createElement("address", { className: "not-italic text-sm text-ivory/65 mt-2 leading-relaxed" }, "Ritumbhara, " + bookingEngine.address),
          React.createElement(Link, { href: "/#find-us", className: linkClass }, "Map & directions")
        )
      )
    ),
    React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-8 border-t border-ivory/10 flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-ivory/60" },
              React.createElement("p", null, "\u00A9 " + new Date().getFullYear() + " Ritumbhara, a brand of LilacMosaic Technologies Private Limited. All rights reserved."),
      React.createElement("p", null, "Secure booking \u00B7 Direct rates \u00B7 Direct WhatsApp support")
    )
  );
}

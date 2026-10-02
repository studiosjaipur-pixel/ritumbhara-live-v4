"use client";
import { useState, useEffect, useRef } from "react";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { destinations } from "@/config/destinations.config";
import { bookingEngine } from "@/config/booking.config";

// Pages whose top section is a dark hero (burgundy or photo). On these the
// transparent header needs light text until the visitor scrolls.
function hasDarkHero(pathname: string) {
    return pathname.indexOf("/properties/") === 0 || pathname.indexOf("/destinations/") === 0;
}

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname() || "/";
    const toggleRef = useRef<HTMLButtonElement | null>(null);

useEffect(function () {
    function onScroll() {
        setScrolled(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return function () {
        window.removeEventListener("scroll", onScroll);
    };
}, []);

useEffect(function () {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return function () {
        document.body.style.overflow = "";
    };
}, [mobileOpen]);

// Mobile menu (UX-007): Escape closes it and returns focus to the menu button.
useEffect(function () {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
            setMobileOpen(false);
            if (toggleRef.current) toggleRef.current.focus();
        }
    }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
}, [mobileOpen]);

// Close the menu after navigating to another page.
useEffect(function () {
    setMobileOpen(false);
}, [pathname]);

const navLinks = [
    { href: "/#standard", label: "The Standard" },
    { href: "/experiences", label: "Experiences" },
    { href: "/about", label: "Our Story" },
    { href: "/contact", label: "Contact" },
    ];

function isActive(href: string) {
    if (href.indexOf("#") !== -1) return false;
    return pathname === href || pathname.indexOf(href + "/") === 0;
}

const isSolid = scrolled || mobileOpen;
const onDark = hasDarkHero(pathname) && !isSolid;

const linkBase = "relative inline-flex items-center min-h-[44px] px-1 transition-colors duration-200 after:absolute after:left-1 after:right-1 after:bottom-2 after:h-px after:bg-burgundy after:transition-transform after:duration-200 after:origin-left ";
const linkTone = onDark ? "text-ivory/90 hover-fine:text-ivory after:!bg-ivory " : "text-charcoal hover-fine:text-burgundy ";

// Tapping outside the open menu closes it. Rendered outside the header: the header's backdrop blur would
// otherwise confine a fixed-position overlay to the header box. Sits above the booking bar and WhatsApp button.
const backdrop = mobileOpen && React.createElement("div", {
    "aria-hidden": true,
    className: "lg:hidden fixed inset-0 z-[45] bg-charcoal/30",
    onClick: function () { setMobileOpen(false); },
});

return React.createElement(React.Fragment, null, backdrop, React.createElement("header", {
    className: "fixed top-0 inset-x-0 z-50 transition-[background-color,box-shadow] duration-300 " + (isSolid ? "bg-ivory/95 backdrop-blur-md shadow-[0_1px_0_#DDD0BA]" : "bg-transparent"),
},
                           React.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between h-20" },
                                               React.createElement(Link, { href: "/", onClick: function () { setMobileOpen(false); }, className: "inline-flex items-start min-h-[44px] items-center font-display text-[1.9rem] leading-none font-semibold tracking-[0.01em] shrink-0 transition-colors " + (onDark ? "text-ivory" : "text-burgundy") }, "Ritumbhara", React.createElement("sup", { className: "font-sans text-[9px] ml-0.5 font-normal self-start mt-2" }, "\u00AE")),
                                               React.createElement("nav", { "aria-label": "Main", className: "hidden lg:flex items-center gap-5 xl:gap-8 text-[15px] font-medium whitespace-nowrap" },
                                                                   navLinks.map(function (link) {
                                                                       const active = isActive(link.href);
                                                                       return React.createElement(Link, {
                                                                           key: link.href,
                                                                           href: link.href,
                                                                           "aria-current": active ? "page" : undefined,
                                                                           className: linkBase + linkTone + (active ? "after:scale-x-100" : "after:scale-x-0 hover-fine:after:scale-x-100"),
                                                                       }, link.label);
                                                                   })
                                                                   ),
                                               React.createElement(Link, { href: "/destinations", className: "hidden lg:inline-flex items-center min-h-[44px] px-5 rounded-sm text-[15px] font-semibold whitespace-nowrap active:scale-[0.97] active:duration-100 active:ease-out transition-[background-color,color,transform] duration-200 ease-snap " + (onDark ? "bg-ivory text-charcoal hover-fine:bg-sand" : "bg-burgundy text-ivory hover-fine:bg-burgundy-deep") }, "Explore Destinations"),
                                               React.createElement("button", {
                                                   type: "button",
                                                   ref: toggleRef,
                                                   "aria-label": mobileOpen ? "Close menu" : "Open menu",
                                                   "aria-expanded": mobileOpen,
                                                   "aria-controls": "mobile-menu",
                                                   className: "lg:hidden relative w-12 h-12 -mr-2 flex flex-col items-center justify-center gap-1.5",
                                                   onClick: function () { setMobileOpen(!mobileOpen); },
                                               },
                                                                   React.createElement("span", { className: "block w-6 h-0.5 rounded-full transition-transform duration-300 " + (onDark ? "bg-ivory" : "bg-charcoal") + " " + (mobileOpen ? "translate-y-2 rotate-45" : "") }),
                                                                   React.createElement("span", { className: "block w-6 h-0.5 rounded-full transition-opacity duration-300 " + (onDark ? "bg-ivory" : "bg-charcoal") + " " + (mobileOpen ? "opacity-0" : "") }),
                                                                   React.createElement("span", { className: "block w-6 h-0.5 rounded-full transition-transform duration-300 " + (onDark ? "bg-ivory" : "bg-charcoal") + " " + (mobileOpen ? "-translate-y-2 -rotate-45" : "") })
                                                                   )
                                               ),
                           // Mobile menu (UX-007). Only the logo and this menu button sit in the bar on small screens; the menu
                           // puts the main actions first and groups the rest. It is only rendered while open.
                           mobileOpen && React.createElement("nav", { id: "mobile-menu", "aria-label": "Mobile", className: "lg:hidden relative bg-ivory border-t border-line max-h-[calc(100dvh-80px)] overflow-y-auto overscroll-contain" },
                                                             React.createElement("div", { className: "flex flex-col px-6 pt-4 pb-6" },
                                                                                 // Main actions.
                                                                                 React.createElement(Link, {
                                                                                     href: "/destinations",
                                                                                     onClick: function () { setMobileOpen(false); },
                                                                                     className: "flex items-center justify-center min-h-[48px] bg-burgundy text-ivory px-6 rounded-sm font-semibold active:scale-[0.97] transition-transform duration-200 ease-snap",
                                                                                 }, "Explore Destinations"),
                                                                                 React.createElement("div", { className: "grid grid-cols-2 gap-3 mt-3" },
                                                                                     React.createElement(Link, {
                                                                                         href: "/",
                                                                                         "aria-current": pathname === "/" ? "page" : undefined,
                                                                                         onClick: function () { setMobileOpen(false); },
                                                                                         className: "flex items-center justify-center min-h-[48px] border border-line rounded-sm text-[15px] font-semibold " + (pathname === "/" ? "text-burgundy" : "text-charcoal"),
                                                                                     }, "Home"),
                                                                                     // The booking engine's general search page (verified Hotel-Spider URL).
                                                                                     React.createElement("a", {
                                                                                         href: bookingEngine.generalUrl,
                                                                                         target: "_blank",
                                                                                         rel: "noopener",
                                                                                         className: "flex items-center justify-center min-h-[48px] border border-burgundy rounded-sm text-[15px] font-semibold text-burgundy",
                                                                                     }, "Book a Stay")
                                                                                 ),
                                                                                 // Destinations.
                                                                                 React.createElement("p", { id: "mobile-menu-destinations", className: "mt-6 mb-1 text-xs font-semibold text-sage" }, "Destinations"),
                                                                                 React.createElement("ul", { "aria-labelledby": "mobile-menu-destinations", className: "grid grid-cols-2 gap-x-4" },
                                                                                     destinations.map(function (d) {
                                                                                         const href = "/destinations/" + d.slug;
                                                                                         const active = isActive(href);
                                                                                         return React.createElement("li", { key: d.slug, className: "border-b border-line" },
                                                                                             React.createElement(Link, {
                                                                                                 href: href,
                                                                                                 "aria-label": d.status === "coming-soon" ? d.name + " (coming soon)" : undefined,
                                                                                                 "aria-current": active ? "page" : undefined,
                                                                                                 onClick: function () { setMobileOpen(false); },
                                                                                                 className: "flex items-center justify-between gap-2 min-h-[48px] text-[16px] font-medium " + (active ? "text-burgundy" : "text-charcoal"),
                                                                                             }, d.name, d.status === "coming-soon" && React.createElement("span", { className: "text-[11px] font-semibold text-charcoal-muted" }, "Soon"))
                                                                                         );
                                                                                     })
                                                                                 ),
                                                                                 // Everything else.
                                                                                 React.createElement("p", { id: "mobile-menu-more", className: "mt-6 mb-1 text-xs font-semibold text-sage" }, "More"),
                                                                                 React.createElement("ul", { "aria-labelledby": "mobile-menu-more" },
                                                                                     navLinks.concat([{ href: "/journal", label: "Journal" }]).map(function (link) {
                                                                                         const active = isActive(link.href);
                                                                                         return React.createElement("li", { key: link.href, className: "border-b border-line last:border-b-0" },
                                                                                             React.createElement(Link, {
                                                                                                 href: link.href,
                                                                                                 "aria-current": active ? "page" : undefined,
                                                                                                 onClick: function () { setMobileOpen(false); },
                                                                                                 className: "flex items-center min-h-[48px] text-[16px] font-medium " + (active ? "text-burgundy" : "text-charcoal"),
                                                                                             }, link.label)
                                                                                         );
                                                                                     })
                                                                                 )
                                                                                 )
                                                             )
                           ));
}

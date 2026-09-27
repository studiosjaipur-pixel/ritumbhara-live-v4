"use client";
import { useState, useEffect } from "react";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Pages whose top section is a dark hero (burgundy or photo). On these the
// transparent header needs light text until the visitor scrolls.
function hasDarkHero(pathname: string) {
    return pathname === "/" || pathname.indexOf("/properties/") === 0 || pathname.indexOf("/destinations/") === 0;
}

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname() || "/";

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

const navLinks = [
    { href: "/destinations", label: "Destinations" },
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

const linkBase = "relative inline-flex items-center min-h-[44px] px-1 transition-colors duration-200 after:absolute after:left-1 after:right-1 after:bottom-2 after:h-[2px] after:rounded-full after:bg-[#C8A96A] after:transition-transform after:duration-200 after:origin-left ";
const linkTone = onDark ? "text-white/90 hover-fine:text-white " : "text-[#1A1A1A] hover-fine:text-[#97183C] ";

return React.createElement("header", {
    className: "fixed top-0 inset-x-0 z-50 transition-[background-color,box-shadow] duration-300 " + (isSolid ? "bg-white/95 backdrop-blur-md shadow-[0_1px_0_#EDE7DD,0_8px_24px_rgba(26,26,26,0.06)]" : "bg-transparent"),
},
                           React.createElement("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between h-20" },
                                               React.createElement(Link, { href: "/", onClick: function () { setMobileOpen(false); }, className: "h-20 px-4 flex items-center justify-center bg-[#97183C] text-white font-semibold tracking-wide rounded-b-sm overflow-hidden shrink-0 " + (onDark ? "ring-1 ring-inset ring-white/25" : "") }, "Ritumbhara", React.createElement("sup", { className: "text-[9px] ml-0.5 font-normal" }, "\u00AE")),
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
                                               React.createElement(Link, { href: "/destinations", className: "hidden lg:inline-flex items-center min-h-[44px] border px-4 xl:px-6 rounded-sm font-medium whitespace-nowrap active:scale-[0.97] active:duration-100 active:ease-out transition-[background-color,color,border-color,transform] duration-200 ease-snap " + (onDark ? "border-white/80 text-white hover-fine:bg-white hover-fine:text-[#97183C]" : "border-[#97183C] text-[#97183C] hover-fine:bg-[#97183C] hover-fine:text-white") }, "Explore Destinations"),
                                               React.createElement("button", {
                                                   type: "button",
                                                   "aria-label": mobileOpen ? "Close menu" : "Open menu",
                                                   "aria-expanded": mobileOpen,
                                                   className: "lg:hidden relative w-12 h-12 -mr-2 flex flex-col items-center justify-center gap-1.5",
                                                   onClick: function () { setMobileOpen(!mobileOpen); },
                                               },
                                                                   React.createElement("span", { className: "block w-6 h-0.5 rounded-full transition-transform duration-300 " + (onDark ? "bg-white" : "bg-[#1A1A1A]") + " " + (mobileOpen ? "translate-y-2 rotate-45" : "") }),
                                                                   React.createElement("span", { className: "block w-6 h-0.5 rounded-full transition-opacity duration-300 " + (onDark ? "bg-white" : "bg-[#1A1A1A]") + " " + (mobileOpen ? "opacity-0" : "") }),
                                                                   React.createElement("span", { className: "block w-6 h-0.5 rounded-full transition-transform duration-300 " + (onDark ? "bg-white" : "bg-[#1A1A1A]") + " " + (mobileOpen ? "-translate-y-2 -rotate-45" : "") })
                                                                   )
                                               ),
                           mobileOpen && React.createElement("nav", { "aria-label": "Mobile", className: "lg:hidden bg-white border-t border-[#EDE7DD] shadow-lg max-h-[calc(100vh-80px)] overflow-y-auto" },
                                                             React.createElement("div", { className: "flex flex-col px-6 py-4" },
                                                                                 navLinks.map(function (link) {
                                                                                     const active = isActive(link.href);
                                                                                     return React.createElement(Link, {
                                                                                         key: link.href,
                                                                                         href: link.href,
                                                                                         "aria-current": active ? "page" : undefined,
                                                                                         onClick: function () { setMobileOpen(false); },
                                                                                         className: "flex items-center min-h-[52px] text-[17px] font-medium border-b border-[#F5F1EA] last:border-b-0 " + (active ? "text-[#97183C]" : "text-[#1A1A1A]"),
                                                                                     }, link.label);
                                                                                 }),
                                                                                 React.createElement(Link, {
                                                                                     href: "/destinations",
                                                                                     onClick: function () { setMobileOpen(false); },
                                                                                     className: "mt-4 mb-2 flex items-center justify-center min-h-[48px] bg-[#97183C] text-white px-6 rounded-sm font-medium active:scale-[0.97] transition-transform duration-200 ease-snap",
                                                                                 }, "Explore Destinations")
                                                                                 )
                                                             )
                           );
}

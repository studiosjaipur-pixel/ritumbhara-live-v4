"use client";
import { useState, useEffect } from "react";
import React from "react";
import Link from "next/link";

const navLinks = [
    { href: "/destinations", label: "Destinations" },
    { href: "/#standard", label: "The Standard" },
    { href: "/experiences", label: "Experiences" },
    { href: "/about", label: "Our Story" },
    { href: "/contact", label: "Contact" },
    ];

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

useEffect(function () {
    function onScroll() {
        setScrolled(window.scrollY > 40);
    }
    window.addEventListener("scroll", onScroll);
    return function () {
        window.removeEventListener("scroll", onScroll);
    };
}, []);

useEffect(function () {
    document.body.style.overflow = open ? "hidden" : "";
    return function () {
        document.body.style.overflow = "";
    };
}, [open]);

const solid = scrolled || open;
    const barColor = solid ? "bg-[#1A1A1A]" : "bg-white";


return React.createElement("header", {
    className: "fixed top-0 inset-x-0 z-50 transition-all duration-300 " + (solid ? "bg-white shadow-sm" : "bg-transparent"),
},
                           React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-[80px] lg:h-[110px]" },
                                               React.createElement(Link, { href: "/", onClick: function () { setOpen(false); }, className: "w-[72px] h-[72px] lg:w-[114px] lg:h-[114px] flex items-center justify-center bg-[#97183C] text-white font-semibold rounded-sm overflow-hidden text-sm lg:text-base shrink-0" }, "Ritumbhara", React.createElement("sup", { className: "text-[9px] ml-0.5 font-normal" }, "\u00AE")),
                                               React.createElement("nav", { className: "hidden lg:flex items-center gap-10 text-[15px] font-medium" },
                                                                   navLinks.map(function (link) {
                                                                       return React.createElement(Link, { key: link.href, href: link.href }, link.label);
                                                                   })
                                                                   ),
                                               React.createElement(Link, { href: "/destinations", className: "hidden lg:block border border-[#97183C] text-[#97183C] px-6 py-2.5 rounded-sm font-medium hover:bg-[#97183C] hover:text-white transition-colors duration-300" }, "Explore Destinations"),
                                               React.createElement("button", {
                                                   type: "button",
                                                   "aria-label": open ? "Close menu" : "Open menu",
                                                   "aria-expanded": open,
                                                   onClick: function () { setOpen(!open); },
                                                   className: "lg:hidden flex flex-col justify-center items-center w-11 h-11 gap-1.5 shrink-0",
                                               },
                                                                   React.createElement("span", { className: "block h-0.5 w-7 rounded-full transition-all duration-300 " + barColor + (open ? " translate-y-2 rotate-45" : "") }),
                                                                   React.createElement("span", { className: "block h-0.5 w-7 rounded-full transition-all duration-300 " + barColor + (open ? " opacity-0" : " opacity-100") }),
                                                                   React.createElement("span", { className: "block h-0.5 w-7 rounded-full transition-all duration-300 " + barColor + (open ? " -translate-y-2 -rotate-45" : "") })
                                                                   )
                                               ),
                           React.createElement("div", { className: "lg:hidden overflow-hidden transition-all duration-300 bg-white border-t border-[#EDE7DD] " + (open ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0") },
                                               React.createElement("nav", { className: "max-w-7xl mx-auto px-6 py-6 flex flex-col gap-5 text-base font-medium text-[#1A1A1A]" },
                                                                   navLinks.map(function (link) {
                                                                       return React.createElement(Link, { key: link.href, href: link.href, onClick: function () { setOpen(false); } }, link.label);
                                                                   }),
                                                                   React.createElement(Link, { href: "/destinations", onClick: function () { setOpen(false); }, className: "border border-[#97183C] text-[#97183C] px-6 py-3 rounded-sm font-medium text-center" }, "Explore Destinations")
                                                                   )
                                               )
                           );
}

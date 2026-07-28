"use client";
import { useState, useEffect } from "react";
import React from "react";
import Link from "next/link";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);

  useEffect(function () {
        function onScroll() {
                setScrolled(window.scrollY > 40);
        }
        window.addEventListener("scroll", onScroll);
        return function () {
                window.removeEventListener("scroll", onScroll);
        };
  }, []);

  const navLinks = [
    { href: "/destinations", label: "Destinations" },
    { href: "/#standard", label: "The Standard" },
    { href: "/experiences", label: "Experiences" },
    { href: "/about", label: "Our Story" },
    { href: "/contact", label: "Contact" },
      ];

  return React.createElement("header", {
        className: "fixed top-0 inset-x-0 z-50 transition-all duration-500 " + (scrolled ? "bg-white/90 backdrop-blur-md shadow-sm" : "bg-transparent"),
  },
                                 React.createElement("div", { className: "max-w-7xl mx-auto px-6 lg:px-10 flex items-center justify-between h-[110px]" },
                                                           React.createElement(Link, { href: "/", className: "w-[114px] h-[114px] flex items-center justify-center bg-[#97183C] text-white font-semibold rounded-sm overflow-hidden" }, "Ritumbhara", React.createElement("sup", { className: "text-[9px] ml-0.5 font-normal" }, "\u00AE")),
                                                           React.createElement("nav", { className: "hidden lg:flex items-center gap-10 text-[15px] font-medium" },
                                                                                       navLinks.map(function (link) {
                                                                                                   return React.createElement(Link, { key: link.href, href: link.href }, link.label);
                                                                                       })
                                                                                     ),
                                                           React.createElement(Link, { href: "/destinations", className: "hidden lg:block border border-[#97183C] text-[#97183C] px-6 py-2.5 rounded-sm font-medium hover:bg-[#97183C] hover:text-white transition-colors duration-300" }, "Explore Destinations")
                                                         )
                               );
}

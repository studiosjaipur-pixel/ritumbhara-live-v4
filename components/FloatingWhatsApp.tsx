"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Persistent WhatsApp access (Week 3: UX-001, UX-007).
// Uses the site's existing WhatsApp destination unchanged.
// Appears once the visitor scrolls past the top of the page, so it never covers
// the hero's own WhatsApp availability button, then stays visible while scrolling.
// Hidden on property pages, which already have their own sticky WhatsApp bar (mobile)
// and a sticky booking panel with a WhatsApp button (desktop).
const WHATSAPP_URL = "https://wa.me/919503002629";

export default function FloatingWhatsApp() {
  const pathname = usePathname() || "/";
  const [visible, setVisible] = useState(false);

  useEffect(function () {
    function onScroll() {
      setVisible(window.scrollY > 360);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return function () {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (pathname.indexOf("/properties/") === 0) return null;

  return React.createElement("a", {
    href: WHATSAPP_URL,
    target: "_blank",
    rel: "noopener",
    "aria-label": "Chat with Ritumbhara on WhatsApp",
    "aria-hidden": visible ? undefined : true,
    tabIndex: visible ? undefined : -1,
    className: "fixed z-40 bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 min-h-[48px] pl-4 pr-5 rounded-full bg-[#97183C] text-white text-sm font-semibold shadow-[0_8px_24px_rgba(151,24,60,0.35)] ring-1 ring-white/20 hover-fine:bg-[#7E1433] active:scale-[0.97] active:duration-100 transition-[opacity,transform,background-color] duration-300 ease-snap " + (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"),
  },
    React.createElement("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      React.createElement("path", { d: "M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.3z" }),
      React.createElement("path", { d: "M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1.2-1.3-1.9-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-1.9z", fill: "currentColor", stroke: "none" })
    ),
    React.createElement("span", null, "WhatsApp")
  );
}

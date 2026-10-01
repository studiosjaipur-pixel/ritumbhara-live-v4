"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Persistent WhatsApp access (UX-001).
// Uses the site's existing WhatsApp destination unchanged.
// Visible from first load on every page, so mobile visitors never have to scroll to find it.
// On phones it is a compact round button (accessible name via aria-label) so it covers as little
// content as possible; from the sm breakpoint up it also shows the "WhatsApp" label.
// It steps aside only while another WhatsApp link on the page (e.g. the homepage availability form,
// Contact page, footer) is fully on screen, so WhatsApp is always one tap away without duplicates or
// overlap, and while a form field is focused so it never sits over a field the visitor is typing in.
// Hidden on property pages, which already have their own sticky WhatsApp bar (mobile)
// and a sticky booking panel with a WhatsApp button (desktop), to avoid duplicate CTAs.
const WHATSAPP_URL = "https://wa.me/919503002629";

export default function FloatingWhatsApp() {
  const pathname = usePathname() || "/";
  const [ctaInView, setCtaInView] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(function () {
    function isField(el: Element | null) {
      return !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    }
    function onFocusIn(e: FocusEvent) { setTyping(isField(e.target as Element)); }
    function onFocusOut() { setTyping(false); }
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return function () {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(function () {
    const targets = Array.prototype.slice.call(document.querySelectorAll('a[href*="wa.me"]:not([data-floating-whatsapp])')) as Element[];
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") {
      setCtaInView(false);
      return;
    }
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.intersectionRatio >= 0.99) visible.add(e.target);
        else visible.delete(e.target);
      });
      setCtaInView(visible.size > 0);
    }, { threshold: [0, 0.99] });
    targets.forEach(function (t) { observer.observe(t); });
    return function () { observer.disconnect(); };
  }, [pathname]);

  if (pathname.indexOf("/properties/") === 0) return null;
  const hidden = ctaInView || typing;

  return React.createElement("a", {
    href: WHATSAPP_URL,
    target: "_blank",
    rel: "noopener",
    "aria-label": "Chat with Ritumbhara on WhatsApp",
    "data-floating-whatsapp": "",
    "aria-hidden": hidden ? true : undefined,
    tabIndex: hidden ? -1 : undefined,
    className: "fixed z-40 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] inline-flex items-center justify-center gap-2 w-14 h-14 sm:w-auto sm:h-auto sm:min-h-[48px] sm:pl-4 sm:pr-5 rounded-full bg-burgundy text-ivory text-sm font-semibold shadow-[0_6px_18px_rgba(38,34,31,0.22)] hover-fine:bg-burgundy-deep active:scale-[0.97] active:duration-100 transition-[opacity,transform,background-color] duration-200 ease-snap " + (hidden ? "opacity-0 translate-y-3 pointer-events-none" : "opacity-100"),
  },
    React.createElement("svg", { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
      React.createElement("path", { d: "M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.3z" }),
      React.createElement("path", { d: "M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1.2-1.3-1.9-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-1.9z", fill: "currentColor", stroke: "none" })
    ),
    React.createElement("span", { className: "hidden sm:inline", "aria-hidden": true }, "WhatsApp")
  );
}

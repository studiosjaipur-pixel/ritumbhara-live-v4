"use client";
import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Persistent WhatsApp access (UX-001).
// Uses the site's existing WhatsApp destination unchanged.
// Visible from first load on every page, so mobile visitors never have to scroll to find it.
// On phones it is a round button (accessible name via aria-label); from the sm breakpoint up it also
// shows the "WhatsApp" label.
// Placement: it never sits on top of another WhatsApp button and stays clear of form controls. It tries, in order:
// its usual corner; on phones, a compact 40px tab docked to the right edge; then the same positions raised
// just far enough to clear whatever is in the way (never above the site header); then, on phones, a tab
// docked to the left edge. Only if none of those is clear of form controls does it accept a spot that is merely
// clear of other WhatsApp buttons, and it only hides when no spot is clear even of those.
// While a form field is focused it steps aside (fades out) so it can never cover the field being filled in.
// Hidden on property pages, which have their own fixed booking bar with WhatsApp (mobile)
// and a sticky booking panel with a WhatsApp button (desktop), to avoid duplicate CTAs.
const WHATSAPP_URL = "https://wa.me/919503002629";

// Phone layouts (below the sm breakpoint). Must match the Tailwind classes used below.
const NORMAL = { size: 56, inset: 16 }; // w-14 h-14 right-4
const COMPACT = { size: 40, inset: 0 }; // w-10 h-10, docked to the screen edge
const GAP = 4;
const LIFT_STEP = 8;

type Mode = "normal" | "compact" | "hidden";
type Side = "right" | "left";
interface Place { mode: Mode; side: Side; lift: number }

export default function FloatingWhatsApp() {
  const pathname = usePathname() || "/";
  const ref = useRef<HTMLAnchorElement | null>(null);
  // Zero-height marker sharing the button's bottom offset, so the resting bottom edge is known
  // regardless of the button's current size, side or lift.
  const baseRef = useRef<HTMLSpanElement | null>(null);
  const [place, setPlace] = useState<Place>({ mode: "normal", side: "right", lift: 0 });
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
    let frame = 0;
    function update(next: Place) {
      setPlace(function (prev) {
        return prev.mode === next.mode && prev.side === next.side && prev.lift === next.lift ? prev : next;
      });
    }
    function check() {
      frame = 0;
      const self = ref.current;
      const base = baseRef.current;
      if (!self || !base) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bottom = base.getBoundingClientRect().top;
      function boxes(selector: string) {
        const out: DOMRect[] = [];
        document.querySelectorAll(selector).forEach(function (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh) out.push(r);
        });
        return out;
      }
      const whatsapp = boxes('a[href*="wa.me"]:not([data-floating-whatsapp])');
      const fields = boxes("input, select, textarea, button");
      function clearOf(list: DOMRect[], left: number, top: number, right: number, btm: number) {
        return list.every(function (r) {
          return !(r.left < right + GAP && r.right > left - GAP && r.top < btm + GAP && r.bottom > top - GAP);
        });
      }
      // Candidate spots, most preferred first.
      // Raised spots may go up to just below a fixed/sticky site header (or the top of the screen).
      let topLimit = 8;
      const header = document.querySelector("header");
      if (header) {
        const pos = window.getComputedStyle(header).position;
        const hb = header.getBoundingClientRect().bottom;
        if ((pos === "fixed" || pos === "sticky") && hb > 0) topLimit = hb + GAP;
      }
      const height = vw >= 640 ? self.getBoundingClientRect().height : NORMAL.size;
      const maxLift = Math.max(0, bottom - height - topLimit);
      const lifts: number[] = [];
      for (let l = 0; l <= maxLift; l += LIFT_STEP) lifts.push(l);
      const spots: { place: Place; box: [number, number, number, number] }[] = [];
      if (vw >= 640) {
        // Larger screens: the labelled pill in the corner, raised if needed.
        const now = self.getBoundingClientRect();
        lifts.forEach(function (l) {
          spots.push({ place: { mode: "normal", side: "right", lift: l }, box: [now.left, bottom - l - now.height, now.right, bottom - l] });
        });
      } else {
        const spot = function (mode: Mode, side: Side, l: number) {
          const d = mode === "compact" ? COMPACT : NORMAL;
          const left = side === "right" ? vw - d.inset - d.size : d.inset;
          spots.push({ place: { mode: mode, side: side, lift: l }, box: [left, bottom - l - d.size, left + d.size, bottom - l] });
        };
        lifts.forEach(function (l) { spot("normal", "right", l); spot("compact", "right", l); });
        lifts.forEach(function (l) { spot("compact", "left", l); });
      }
      function first(test: (b: [number, number, number, number]) => boolean) {
        for (let i = 0; i < spots.length; i++) if (test(spots[i].box)) return spots[i].place;
        return null;
      }
      const best =
        first(function (b) { return clearOf(whatsapp, b[0], b[1], b[2], b[3]) && clearOf(fields, b[0], b[1], b[2], b[3]); }) ||
        first(function (b) { return clearOf(whatsapp, b[0], b[1], b[2], b[3]); });
      update(best || { mode: "hidden", side: "right", lift: 0 });
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(check);
    }
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Content that changes size without scrolling (e.g. an opened "Show map" panel).
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (ro) ro.observe(document.body);
    return function () {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (ro) ro.disconnect();
    };
  }, [pathname]);

  if (pathname.indexOf("/properties/") === 0) return null;
  // On /contact, phones and tablets get the page's own fixed "WhatsApp Us" bar instead (UX-005).
  const contactPage = pathname === "/contact";
  const mode = place.mode;
  const hidden = mode === "hidden" || typing;
  const placement =
    mode === "compact"
      ? (place.side === "left"
          ? "left-0 sm:left-auto sm:right-6 w-10 h-10 rounded-r-full rounded-l-none sm:rounded-full"
          : "right-0 w-10 h-10 rounded-l-full rounded-r-none sm:rounded-full")
      : "right-4 w-14 h-14 rounded-full";
  const bottomClass = "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]";

  return React.createElement(React.Fragment, null,
    React.createElement("span", { ref: baseRef, "aria-hidden": true, className: "fixed right-0 h-0 w-0 pointer-events-none " + bottomClass }),
    React.createElement("a", {
      ref: ref,
      href: WHATSAPP_URL,
      target: "_blank",
      rel: "noopener",
      "aria-label": "Chat with Ritumbhara on WhatsApp",
      "data-floating-whatsapp": "",
      "aria-hidden": hidden ? true : undefined,
      tabIndex: hidden ? -1 : undefined,
      style: place.lift ? { transform: "translateY(-" + place.lift + "px)" } : undefined,
      className: (contactPage ? "max-lg:!hidden " : "") + "fixed z-40 " + placement + " " + bottomClass + " sm:right-6 inline-flex items-center justify-center gap-2 sm:w-auto sm:h-auto sm:min-h-[48px] sm:pl-4 sm:pr-5 bg-burgundy text-ivory text-sm font-semibold shadow-[0_6px_18px_rgba(38,34,31,0.22)] hover-fine:bg-burgundy-deep active:scale-[0.97] active:duration-100 transition-[opacity,background-color,transform] duration-200 ease-snap " + (hidden ? "opacity-0 pointer-events-none" : "opacity-100"),
    },
      React.createElement("svg", { width: mode === "compact" ? 18 : 22, height: mode === "compact" ? 18 : 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
        React.createElement("path", { d: "M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.3z" }),
        React.createElement("path", { d: "M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1.2-1.3-1.9-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-1.9z", fill: "currentColor", stroke: "none" })
      ),
      React.createElement("span", { className: "hidden sm:inline", "aria-hidden": true }, "WhatsApp")
    )
  );
}

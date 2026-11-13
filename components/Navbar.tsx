"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OpenAvailabilityButton from "@/components/OpenAvailabilityButton";

// Pages whose top section is a dark hero (burgundy or photo). On these the
// transparent header needs light text until the visitor scrolls.
function hasDarkHero(pathname: string) {
  return pathname.indexOf("/properties/") === 0 || pathname.indexOf("/destinations/") === 0;
}

const navLinks = [
  { href: "/#standard", label: "The Standard" },
  { href: "/destinations", label: "Stays" },
  { href: "/experiences", label: "Experiences" },
  { href: "/about", label: "Our Story" },
  { href: "/ai", label: "Ritumbhara AI" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname() || "/";

  useEffect(function () {
    function onScroll() { setScrolled(window.scrollY > 40); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return function () { window.removeEventListener("scroll", onScroll); };
  }, []);

  useEffect(function () {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return function () { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Close the mobile menu on Escape and whenever the page changes.
  useEffect(function () { setMobileOpen(false); }, [pathname]);
  useEffect(function () {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileOpen(false); }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
  }, [mobileOpen]);

  function isActive(href: string) {
    if (href.indexOf("#") !== -1) return false;
    return pathname === href || pathname.indexOf(href + "/") === 0;
  }

  const isSolid = scrolled || mobileOpen;
  const onDark = hasDarkHero(pathname) && !isSolid;

  const linkBase = "relative inline-flex items-center min-h-[44px] px-1 transition-colors duration-200 after:absolute after:left-1 after:right-1 after:bottom-2 after:h-px after:bg-burgundy after:transition-transform after:duration-200 after:origin-left ";
  const linkTone = onDark ? "text-ivory/90 hover-fine:text-ivory after:!bg-ivory " : "text-charcoal hover-fine:text-burgundy ";
  const bookTone = onDark ? "bg-ivory text-charcoal hover-fine:bg-sand" : "bg-burgundy text-ivory hover-fine:bg-burgundy-deep";
  const bar = onDark ? "bg-ivory" : "bg-charcoal";

  return (
    <header className={"fixed top-0 inset-x-0 z-50 transition-[background-color,box-shadow] duration-300 " + (isSolid ? "bg-ivory/95 backdrop-blur-md shadow-[0_1px_0_#DDD0BA]" : "bg-transparent")}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-3 h-20">
        <Link href="/" aria-label="Ritumbhara home" className="inline-flex items-center min-h-[44px] shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={onDark ? "/brand/ritumbhara-logo-white.png" : "/brand/ritumbhara-logo-red.png"} alt="Ritumbhara" width={720} height={131} className="h-[26px] sm:h-[30px] w-auto" />
        </Link>

        <nav aria-label="Main" className="hidden lg:flex items-center gap-3 xl:gap-8 text-[15px] font-medium whitespace-nowrap">
          {navLinks.map(function (link) {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={linkBase + linkTone + (active ? "after:scale-x-100" : "after:scale-x-0 hover-fine:after:scale-x-100")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <OpenAvailabilityButton className={"inline-flex items-center justify-center min-h-[44px] px-4 lg:px-5 rounded-sm text-sm lg:text-[15px] font-semibold whitespace-nowrap active:scale-[0.97] active:duration-100 active:ease-out transition-[background-color,color,transform] duration-200 ease-snap " + bookTone}>
            <span className="lg:hidden">Book</span>
            <span className="hidden lg:inline">Check Availability</span>
          </OpenAvailabilityButton>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="rb-mobile-nav"
            className="lg:hidden relative w-12 h-12 -mr-2 flex flex-col items-center justify-center gap-1.5"
            onClick={function () { setMobileOpen(!mobileOpen); }}
          >
            <span className={"block w-6 h-0.5 rounded-full transition-transform duration-300 " + bar + " " + (mobileOpen ? "translate-y-2 rotate-45" : "")} />
            <span className={"block w-6 h-0.5 rounded-full transition-opacity duration-300 " + bar + " " + (mobileOpen ? "opacity-0" : "")} />
            <span className={"block w-6 h-0.5 rounded-full transition-transform duration-300 " + bar + " " + (mobileOpen ? "-translate-y-2 -rotate-45" : "")} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="rb-mobile-nav" aria-label="Mobile" className="lg:hidden bg-ivory border-t border-line max-h-[calc(100vh-80px)] overflow-y-auto">
          <div className="flex flex-col px-6 py-4">
            {navLinks.map(function (link) {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={function () { setMobileOpen(false); }}
                  className={"flex items-center justify-between min-h-[52px] text-[17px] font-medium border-b border-line last:border-b-0 " + (active ? "text-burgundy" : "text-charcoal")}
                >
                  {link.label}
                  <span aria-hidden="true" className="text-charcoal-muted">&rarr;</span>
                </Link>
              );
            })}
            <OpenAvailabilityButton
              onClick={function () { setMobileOpen(false); }}
              className="mt-4 mb-2 flex items-center justify-center min-h-[48px] bg-burgundy text-ivory px-6 rounded-sm font-semibold active:scale-[0.97] transition-transform duration-200 ease-snap"
            >
              Check Availability
            </OpenAvailabilityButton>
          </div>
        </nav>
      )}
    </header>
  );
}

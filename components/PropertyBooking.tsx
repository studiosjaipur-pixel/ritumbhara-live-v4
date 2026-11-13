"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { properties } from "@/config/properties.config";
import { buildWhatsAppUrl, makeWhatsAppRef } from "@/lib/whatsapp";
import { useTrip } from "@/lib/useTrip";
import { formatDayMonth, formatLong, nightsBetween, plural } from "@/lib/trip";
import { useModal } from "@/lib/useModal";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";

// The booking side of a property page.
// Desktop: a sticky card with dates, guests and the booking buttons.
// Phones: the same card sits in the page, and a bottom bar (hidden while the card is on screen) shows the
// chosen dates and opens the same controls in a sheet, so booking is always one tap away.
export default function PropertyBooking({ slug, name }: { slug: string; name: string }) {
  const property = properties.find(function (p) { return p.slug === slug; });
  const hasRoomLink = !!(property && property.hotelSpiderBookingUrl);
  const [trip] = useTrip();
  const [cardVisible, setCardVisible] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const closeSheet = useCallback(function () { setSheetOpen(false); }, []);
  useModal(sheetOpen, closeSheet, sheetRef);

  useEffect(function () {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { setCardVisible(e.isIntersecting); });
    }, { threshold: 0.15 });
    io.observe(el);
    return function () { io.disconnect(); };
  }, []);

  const ref = makeWhatsAppRef("PROP", slug);
  const hasRange = !!(trip.checkIn && trip.checkOut && trip.checkOut > trip.checkIn);
  const guests = property && property.maxGuests ? Math.min(trip.guests, property.maxGuests) : trip.guests;
  const barText = (hasRange ? formatDayMonth(trip.checkIn) + " \u2192 " + formatDayMonth(trip.checkOut) : trip.checkIn ? "From " + formatDayMonth(trip.checkIn) : "Add dates") + " \u00B7 " + plural(guests, "guest");
  let quick = "Hi, I'd like to check availability for " + name;
  if (hasRange) quick += " from " + formatLong(trip.checkIn) + " to " + formatLong(trip.checkOut) + " (" + plural(nightsBetween(trip.checkIn, trip.checkOut), "night") + ")";
  quick += " for " + plural(guests, "guest") + ".";

  return (
    <>
      <aside ref={cardRef} id="book" className="bg-sand/70 border-t-2 border-burgundy rounded-sm p-6 lg:p-7 h-fit lg:sticky lg:top-28 scroll-mt-28">
        <h2 className="text-[1.6rem] leading-tight text-charcoal mb-1">Book Your Stay</h2>
        <div className="flex items-center gap-2 mb-4 text-xs font-semibold text-burgundy">
          <span>{"★"} Airbnb Superhost</span>
        </div>

        {/* How pricing works: Hotel-Spider prices depend on dates, guests and availability, so the panel explains where the live price is shown instead of displaying a stale number. */}
        <div className="bg-ivory/80 border-l-2 border-burgundy rounded-sm px-4 py-3 mb-5">
          <p className="text-xs font-semibold text-sage mb-1">Price per night</p>
          <p className="font-display text-[1.45rem] leading-tight text-charcoal mb-1">{hasRoomLink ? "Live price for your dates" : "Price on request"}</p>
          <p className="text-sm text-charcoal-soft leading-snug">
            {hasRoomLink
              ? "Shown in ₹ on our booking page for your dates and number of guests, before you pay. Rates change with dates and availability."
              : "This stay isn’t on our online booking engine — message us on WhatsApp with your dates for a price."}
          </p>
        </div>

        <CheckAvailabilityWidget variant="stack" fixedPropertySlug={slug} />

        <p className="text-xs text-center text-charcoal-muted mt-4 mb-1">Book direct with Ritumbhara {"—"} no OTA booking fees</p>
        <a href="#before-you-book" className="flex items-center justify-center min-h-[44px] text-xs font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy">
          Check-in, cancellation &amp; FAQs
        </a>
      </aside>

      {/* Phone bottom bar */}
      <div
        className={"lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ivory/95 backdrop-blur border-t border-line px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex items-center gap-2 transition-[transform,opacity] duration-300 ease-snap " + (cardVisible || sheetOpen ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100")}
        aria-hidden={cardVisible || sheetOpen ? true : undefined}
      >
        <button
          type="button"
          tabIndex={cardVisible ? -1 : 0}
          onClick={function () { setSheetOpen(true); }}
          className="flex-1 min-w-0 text-left min-h-[48px] px-1"
          aria-label="Edit dates and guests"
        >
          <span className="block text-[11px] font-semibold text-sage">{name}</span>
          <span className="block text-sm font-semibold text-charcoal truncate">{barText}</span>
        </button>
        <a
          href={buildWhatsAppUrl(quick, ref)}
          target="_blank"
          rel="noopener"
          tabIndex={cardVisible ? -1 : 0}
          data-wa-ref={ref}
          data-wa-cta="property-bar"
          data-wa-destination={slug}
          data-wa-check-in={trip.checkIn}
          data-wa-check-out={trip.checkOut}
          data-wa-guests={String(guests)}
          aria-label="Message us on WhatsApp"
          className="shrink-0 w-12 h-12 flex items-center justify-center border border-burgundy text-burgundy rounded-sm active:scale-95 transition-transform"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.3z" />
            <path d="M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1.2-1.3-1.9-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-1.9z" fill="currentColor" stroke="none" />
          </svg>
        </a>
        <button
          type="button"
          tabIndex={cardVisible ? -1 : 0}
          onClick={function () { setSheetOpen(true); }}
          className="shrink-0 min-h-[48px] px-5 bg-burgundy text-ivory text-sm font-semibold rounded-sm active:scale-[0.97] transition-transform"
        >
          Check dates
        </button>
      </div>

      {/* Phone sheet */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-[80] flex items-end">
          <div className="absolute inset-0 bg-charcoal/55 rb-fade" onClick={closeSheet} aria-hidden="true" />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rb-prop-sheet-title"
            className="relative w-full max-h-[92svh] overflow-y-auto bg-ivory rounded-t-2xl border-t-2 border-burgundy p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] rb-sheet"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 id="rb-prop-sheet-title" className="text-[1.6rem] leading-tight text-charcoal">{name}</h2>
                <p className="text-sm text-charcoal-soft">Choose your dates and guests</p>
              </div>
              <button type="button" data-autofocus aria-label="Close" onClick={closeSheet} className="-mr-2 -mt-1 w-11 h-11 flex items-center justify-center rounded-full text-charcoal-soft active:scale-90 transition-transform">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            <CheckAvailabilityWidget variant="stack" fixedPropertySlug={slug} />
          </div>
        </div>
      )}
    </>
  );
}

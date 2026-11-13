"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OPEN_SHORTLIST_EVENT, openShortlist, useShortlist } from "@/lib/shortlist";
import { useModal } from "@/lib/useModal";
import { useTrip } from "@/lib/useTrip";
import { formatShort, nightsBetween, plural, todayISO, validateDates } from "@/lib/trip";
import { buildWhatsAppUrl, makeWhatsAppRef } from "@/lib/whatsapp";

export interface ShortlistStay {
  slug: string;
  name: string;
  type: string;
  location: string;
  maxGuests?: number;
}

// Header button: shows how many stays are saved. Hidden until the visitor has saved one.
export function ShortlistButton({ onDark }: { onDark?: boolean }) {
  const { saved, ready } = useShortlist();
  if (!ready || saved.length === 0) return null;
  return (
    <button
      type="button"
      onClick={openShortlist}
      aria-haspopup="dialog"
      aria-label={"Open shortlist, " + plural(saved.length, "stay") + " saved"}
      className={"relative w-11 h-11 flex items-center justify-center rounded-full active:scale-90 transition-[color,transform] duration-150 " + (onDark ? "text-ivory" : "text-burgundy")}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.3 3.3 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" /></svg>
      <span aria-hidden="true" className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-charcoal text-ivory text-[11px] font-semibold flex items-center justify-center">{saved.length}</span>
    </button>
  );
}

// The shortlist panel: a bottom sheet on phones, a side panel on larger screens. The enquiry names every saved
// stay and carries the visitor's dates when they have entered valid ones.
export default function ShortlistDrawer({ stays }: { stays: ShortlistStay[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { saved, remove, clear } = useShortlist();
  const [trip] = useTrip();

  const close = useCallback(function () { setOpen(false); }, []);
  useModal(open, close, ref);

  useEffect(function () {
    function onOpen() { setOpen(true); }
    window.addEventListener(OPEN_SHORTLIST_EVENT, onOpen);
    return function () { window.removeEventListener(OPEN_SHORTLIST_EVENT, onOpen); };
  }, []);
  useEffect(function () { setOpen(false); }, [pathname]);

  const items = saved
    .map(function (slug) { return stays.find(function (s) { return s.slug === slug; }); })
    .filter(function (s): s is ShortlistStay { return !!s; });

  // Close on its own once the last stay is removed.
  useEffect(function () { if (open && items.length === 0) setOpen(false); }, [open, items.length]);

  if (!open || items.length === 0) return null;

  const datesOk = !!trip.checkIn && !!trip.checkOut && validateDates(trip.checkIn, trip.checkOut, todayISO()) === "";
  const tripLine = datesOk
    ? formatShort(trip.checkIn) + " to " + formatShort(trip.checkOut) + " (" + plural(nightsBetween(trip.checkIn, trip.checkOut), "night") + "), " + plural(trip.guests, "guest")
    : "";
  const message =
    "Hi Ritumbhara, I'm comparing these stays and would like to check availability:\n" +
    items.map(function (s) { return "- " + s.name + " (" + s.location + ")"; }).join("\n") +
    (tripLine ? "\n\nDates: " + tripLine : "\n\nMy dates are flexible. Which of these would you suggest?");
  const waRef = makeWhatsAppRef("SHORTLIST");

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-stretch sm:justify-end">
      <div className="absolute inset-0 bg-charcoal/55 backdrop-blur-[2px] rb-fade" onClick={close} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rb-short-title"
        className="relative w-full sm:max-w-md max-h-[92svh] sm:max-h-none sm:h-full overflow-y-auto bg-ivory rounded-t-2xl sm:rounded-none border-t-2 sm:border-t-0 sm:border-l-2 border-burgundy shadow-[0_-12px_40px_rgba(38,34,31,0.25)] p-5 sm:p-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] rb-sheet"
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 id="rb-short-title" className="text-[1.75rem] leading-tight text-charcoal">Your shortlist</h2>
          <button type="button" data-autofocus aria-label="Close" onClick={close} className="-mr-2 -mt-1 w-11 h-11 flex items-center justify-center rounded-full text-charcoal-soft hover-fine:bg-sand active:scale-90 transition-[background-color,transform] duration-150">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p className="text-sm text-charcoal-soft mb-5">Saved on this device. Send them all to us in one message and we&rsquo;ll reply with what&rsquo;s free.</p>

        <ul className="border-t border-line mb-5">
          {items.map(function (s) {
            const tooSmall = s.maxGuests !== undefined && trip.guests > s.maxGuests;
            return (
              <li key={s.slug} className="flex items-start justify-between gap-3 py-3.5 border-b border-line">
                <div className="min-w-0">
                  <Link href={"/properties/" + s.slug} className="font-display text-xl text-charcoal hover-fine:text-burgundy transition-colors">{s.name}</Link>
                  <p className="text-sm text-charcoal-soft">{s.type} · {s.location}</p>
                  <p className={"text-xs mt-0.5 " + (tooSmall ? "text-burgundy font-medium" : "text-charcoal-muted")}>
                    {s.maxGuests !== undefined ? (tooSmall ? "Sleeps up to " + s.maxGuests + ", so a group of " + trip.guests + " won’t fit" : "Up to " + plural(s.maxGuests, "guest")) : "Ask us about group size"}
                  </p>
                </div>
                <button type="button" onClick={function () { remove(s.slug); }} aria-label={"Remove " + s.name + " from shortlist"} className="shrink-0 min-h-[44px] px-2 text-sm text-charcoal-muted underline underline-offset-4 hover-fine:text-burgundy">
                  Remove
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-sm text-charcoal-soft mb-3">{tripLine ? "Your dates: " + tripLine : "No dates added yet. We can suggest options either way."}</p>
        <a
          href={buildWhatsAppUrl(message, waRef)}
          data-wa-ref={waRef}
          data-wa-cta="shortlist"
          data-wa-destination={items.length === 1 ? items[0].slug : "multiple"}
          data-wa-check-in={datesOk ? trip.checkIn : ""}
          data-wa-check-out={datesOk ? trip.checkOut : ""}
          data-wa-guests={String(trip.guests)}
          target="_blank"
          rel="noopener"
          className="flex items-center justify-center min-h-[48px] bg-burgundy text-ivory font-semibold py-3 px-4 rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] transition-[background-color,transform] duration-200 ease-snap w-full"
        >
          {"Ask about " + (items.length === 1 ? "this stay" : "these " + items.length + " stays") + " on WhatsApp"}
        </a>
        <div className="flex items-center justify-between mt-3">
          <Link href="/destinations#all-stays" className="inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy">Keep browsing</Link>
          <button type="button" onClick={clear} className="min-h-[44px] px-2 text-sm text-charcoal-muted underline underline-offset-4 hover-fine:text-burgundy">Clear all</button>
        </div>
      </div>
    </div>
  );
}

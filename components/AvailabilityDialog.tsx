"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { OPEN_AVAILABILITY_EVENT, OpenAvailabilityDetail } from "@/lib/availability-events";
import { useModal } from "@/lib/useModal";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";

// The "Check availability" dialog, available from the header on every page and from any
// OpenAvailabilityButton. A bottom sheet on phones, a centred card on larger screens.
export default function AvailabilityDialog() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<OpenAvailabilityDetail>({});
  const [openCount, setOpenCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const close = useCallback(function () { setOpen(false); }, []);
  useModal(open, close, ref);

  useEffect(function () {
    function onOpen(e: Event) {
      setDetail(((e as CustomEvent).detail as OpenAvailabilityDetail) || {});
      setOpenCount(function (n) { return n + 1; });
      setOpen(true);
    }
    window.addEventListener(OPEN_AVAILABILITY_EVENT, onOpen);
    return function () { window.removeEventListener(OPEN_AVAILABILITY_EVENT, onOpen); };
  }, []);

  // Close when the visitor navigates, e.g. via "See all stays".
  useEffect(function () { setOpen(false); }, [pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-charcoal/55 backdrop-blur-[2px] rb-fade" onClick={close} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rb-avail-title"
        className="relative w-full sm:max-w-lg max-h-[92svh] overflow-y-auto bg-ivory rounded-t-2xl sm:rounded-sm border-t-2 border-burgundy shadow-[0_-12px_40px_rgba(38,34,31,0.25)] sm:shadow-[0_24px_60px_rgba(38,34,31,0.3)] p-5 sm:p-7 pb-[calc(1.25rem+env(safe-area-inset-bottom))] rb-sheet"
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 id="rb-avail-title" className="text-[1.75rem] leading-tight text-charcoal">Check availability</h2>
          <button
            type="button"
            data-autofocus
            aria-label="Close"
            onClick={close}
            className="-mr-2 -mt-1 w-11 h-11 flex items-center justify-center rounded-full text-charcoal-soft hover-fine:bg-sand active:scale-90 transition-[background-color,transform] duration-150"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p className="text-sm text-charcoal-soft mb-5">Pick your dates and we&rsquo;ll check with the team. You&rsquo;ll get a direct reply, not a call centre.</p>
        <CheckAvailabilityWidget
          key={openCount}
          variant="stack"
          defaultDestination={detail.destination}
          fixedPropertySlug={detail.property}
        />
        <p className="text-center text-sm text-charcoal-soft mt-4">
          Prefer to talk? <a href="tel:+919503002629" className="font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4">+91 95030 02629</a>
        </p>
      </div>
    </div>
  );
}

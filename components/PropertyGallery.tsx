"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useModal } from "@/lib/useModal";

export const OPEN_GALLERY_EVENT = "rb:open-gallery";

interface Photo { src: string; alt: string }

// Photo grid for a property page with a full-screen viewer: tap any photo to open it, then use the arrows,
// the keyboard (left / right / Escape), a swipe, or the thumbnail strip. `photos` lists the hero first.
export default function PropertyGallery({ name, photos }: { name: string; photos: Photo[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const open = index !== null;
  const total = photos.length;
  // The hero is already shown at the top of the page, so the grid starts from the second photo.
  const grid = photos.slice(1, 5);

  const close = useCallback(function () { setIndex(null); }, []);
  useModal(open, close, ref);

  const go = useCallback(function (delta: number) {
    setIndex(function (i) { return i === null ? i : (i + delta + total) % total; });
  }, [total]);

  useEffect(function () {
    function onOpen() { setIndex(0); }
    window.addEventListener(OPEN_GALLERY_EVENT, onOpen);
    return function () { window.removeEventListener(OPEN_GALLERY_EVENT, onOpen); };
  }, []);

  useEffect(function () {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
  }, [open, go]);

  if (total <= 1) return null;
  const current = index !== null ? photos[index] : null;

  return (
    <section className="mb-10" aria-label={name + " photos"}>
      <div className="flex items-end justify-between gap-4 mb-5">
        <h2 className="text-3xl">Photos</h2>
        <button
          type="button"
          onClick={function () { setIndex(0); }}
          className="inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors"
        >
          {"View all " + total + " photos"}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4">
        {grid.map(function (img, i) {
          const wide = i === 0 && grid.length % 2 === 1;
          return (
            <li key={img.src} className={"relative overflow-hidden rounded-sm bg-sand " + (wide ? "col-span-2 aspect-[16/9]" : "aspect-[4/3]")}>
              <button
                type="button"
                onClick={function () { setIndex(i + 1); }}
                aria-label={"Open photo " + (i + 2) + " of " + total}
                className="group absolute inset-0 w-full h-full cursor-zoom-in"
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  quality={70}
                  sizes={wide ? "(max-width: 1024px) 100vw, 800px" : "(max-width: 1024px) 50vw, 400px"}
                  className="object-cover transition-transform duration-700 ease-snap group-hover-fine:scale-[1.04]"
                />
              </button>
            </li>
          );
        })}
      </ul>

      {open && current && (
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={name + " photo viewer"}
          className="fixed inset-0 z-[90] bg-charcoal/95 flex flex-col rb-fade"
          onTouchStart={function (e) { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={function (e) {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between px-4 sm:px-6 h-16 shrink-0 text-ivory">
            <p className="text-sm font-medium tabular-nums" aria-live="polite">{(index as number) + 1} / {total}</p>
            <button type="button" data-autofocus aria-label="Close photo viewer" onClick={close} className="w-11 h-11 flex items-center justify-center rounded-full hover-fine:bg-ivory/10 active:scale-90 transition-[background-color,transform]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>

          <div className="relative flex-1 min-h-0" onClick={function (e) { if (e.target === e.currentTarget) close(); }}>
            <Image key={current.src} src={current.src} alt={current.alt} fill quality={80} sizes="100vw" priority className="object-contain rb-fade" />
            <button type="button" aria-label="Previous photo" onClick={function () { go(-1); }} className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-charcoal/60 text-ivory hover-fine:bg-charcoal active:scale-90 transition-[background-color,transform]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button type="button" aria-label="Next photo" onClick={function () { go(1); }} className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-charcoal/60 text-ivory hover-fine:bg-charcoal active:scale-90 transition-[background-color,transform]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="shrink-0 px-3 py-3 overflow-x-auto">
            <ul className="flex gap-2 justify-start sm:justify-center min-w-max mx-auto">
              {photos.map(function (p, i) {
                return (
                  <li key={p.src}>
                    <button
                      type="button"
                      aria-label={"Show photo " + (i + 1)}
                      aria-current={i === index ? "true" : undefined}
                      onClick={function () { setIndex(i); }}
                      className={"relative block w-16 h-12 rounded-sm overflow-hidden transition-[opacity,box-shadow] duration-200 " + (i === index ? "opacity-100 ring-2 ring-ivory" : "opacity-50 hover-fine:opacity-90")}
                    >
                      <Image src={p.src} alt="" fill quality={40} sizes="64px" className="object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

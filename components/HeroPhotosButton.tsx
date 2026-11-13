"use client";
import { OPEN_GALLERY_EVENT } from "@/components/PropertyGallery";

// "View all photos" on top of a property's hero image; opens the viewer in PropertyGallery.
export default function HeroPhotosButton({ count }: { count: number }) {
  return (
    <button
      type="button"
      onClick={function () { window.dispatchEvent(new Event(OPEN_GALLERY_EVENT)); }}
      className="hidden sm:inline-flex absolute right-6 lg:right-10 bottom-8 lg:bottom-12 items-center gap-2 min-h-[44px] px-4 bg-ivory/95 text-charcoal text-sm font-semibold rounded-sm hover-fine:bg-ivory active:scale-[0.97] transition-[background-color,transform] duration-200 ease-snap"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10.5" r="1.5" /><path d="M21 16l-5-5-9 8" /></svg>
      {"View all " + count + " photos"}
    </button>
  );
}

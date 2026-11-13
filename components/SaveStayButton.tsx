"use client";
import { useState } from "react";
import { openShortlist, useShortlist } from "@/lib/shortlist";

// Heart button that saves a stay to the visitor's shortlist. `overlay` sits on top of a photo (cards, hero),
// `inline` is a labelled button for use beside a title.
export default function SaveStayButton({ slug, name, variant }: { slug: string; name: string; variant?: "overlay" | "inline" }) {
  const { saved, toggle, ready } = useShortlist();
  const [note, setNote] = useState("");
  const isSaved = ready && saved.indexOf(slug) !== -1;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = toggle(slug);
    setNote(!ok ? "Your shortlist is full. Remove a stay to add another." : isSaved ? "Removed from shortlist" : "Saved to shortlist");
    window.setTimeout(function () { setNote(""); }, 2500);
  }

  const heart = (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={"transition-transform duration-200 " + (isSaved ? "scale-110" : "")}>
      <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.3 3.3 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
    </svg>
  );

  return (
    <>
      {variant === "inline" ? (
        <button
          type="button"
          aria-pressed={isSaved}
          onClick={onClick}
          className={"inline-flex items-center gap-2 min-h-[44px] px-4 border rounded-sm text-sm font-semibold active:scale-[0.97] transition-[background-color,color,transform] duration-200 ease-snap " + (isSaved ? "bg-burgundy text-ivory border-burgundy" : "border-line text-charcoal hover-fine:border-burgundy hover-fine:text-burgundy")}
        >
          {heart}
          {isSaved ? "Saved" : "Save stay"}
        </button>
      ) : (
        <button
          type="button"
          aria-pressed={isSaved}
          aria-label={(isSaved ? "Remove " : "Save ") + name + (isSaved ? " from shortlist" : " to shortlist")}
          onClick={onClick}
          className={"w-11 h-11 flex items-center justify-center rounded-full bg-ivory/95 shadow-sm active:scale-90 transition-[color,transform] duration-150 " + (isSaved ? "text-burgundy" : "text-charcoal hover-fine:text-burgundy")}
        >
          {heart}
        </button>
      )}
      <span role="status" aria-live="polite" className={note ? "fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-charcoal text-ivory text-sm px-4 py-2.5 rounded-sm shadow-lg rb-fade max-w-[90vw]" : "sr-only"}>
        {note}
        {note === "Saved to shortlist" ? (
          <button type="button" onClick={openShortlist} className="ml-3 underline underline-offset-4 font-semibold">View</button>
        ) : null}
      </span>
    </>
  );
}

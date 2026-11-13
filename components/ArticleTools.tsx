"use client";
import { useEffect, useRef, useState } from "react";

// Thin reading-progress bar at the very top of the screen, measured against the article body
// (the element marked data-article-body).
export function ReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(function () {
    let frame = 0;
    function update() {
      frame = 0;
      const body = document.querySelector("[data-article-body]");
      const el = bar.current;
      if (!body || !el) return;
      const rect = body.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.5;
      const done = Math.min(1, Math.max(0, (window.innerHeight * 0.35 - rect.top) / Math.max(total, 1)));
      el.style.transform = "scaleX(" + done + ")";
    }
    function schedule() { if (!frame) frame = window.requestAnimationFrame(update); }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return function () {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div aria-hidden="true" className="fixed top-0 inset-x-0 h-[3px] z-[60] pointer-events-none">
      <div ref={bar} className="h-full w-full bg-burgundy origin-left" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}

// Shares the page with the phone's share sheet where there is one, otherwise copies the link.
export function ShareButton({ title }: { title: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function share() {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: title, url: url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState("failed");
    }
    window.setTimeout(function () { setState("idle"); }, 2200);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" /></svg>
      <span aria-live="polite">{state === "copied" ? "Link copied" : state === "failed" ? "Couldn’t copy the link" : "Share this guide"}</span>
    </button>
  );
}

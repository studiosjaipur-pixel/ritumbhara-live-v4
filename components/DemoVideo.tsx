"use client";
import { useState } from "react";

export default function DemoVideo({ src, poster }: { src: string; poster: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative rounded-sm overflow-hidden border border-line bg-charcoal shadow-[0_18px_50px_-18px_rgba(38,34,31,0.35)] aspect-video">
      {playing ? (
        <video src={src} poster={poster} controls autoPlay playsInline className="w-full h-full" />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label="Play the Ritumbhara OS demo video" className="group absolute inset-0 w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="Ritumbhara OS dashboard shown on a phone" className="w-full h-full object-cover" loading="lazy" />
          <span className="absolute inset-0 bg-charcoal/10 group-hover:bg-charcoal/0 transition-colors" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-burgundy text-ivory flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
      )}
    </div>
  );
}

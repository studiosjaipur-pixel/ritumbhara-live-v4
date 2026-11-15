"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import DestinationScene, { type SceneSlug } from "./DestinationScene";

export interface JourneyStop {
  slug: SceneSlug;
  name: string;
  state: string;
  story: string;
  proximity?: string;
  comingSoon: boolean;
}

function Pin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function StopCopy({ stop, index, total }: { stop: JourneyStop; index: number; total: number }) {
  return (
    <>
      <p className="flex items-center gap-3 text-xs font-semibold text-sage mb-3">
        <span className="font-display text-lg text-burgundy">{String(index + 1).padStart(2, "0")}</span>
        <span aria-hidden className="h-px w-8 bg-line" />
        {String(total).padStart(2, "0")}
      </p>
      <h3 className="font-display text-[2.6rem] sm:text-5xl leading-none text-charcoal mb-1">{stop.name}</h3>
      <p className="text-sm font-medium text-charcoal-muted mb-4">{stop.state}{stop.comingSoon ? " · Coming soon" : ""}</p>
      <p className="text-[16px] text-charcoal-soft leading-relaxed mb-4">{stop.story}</p>
      {stop.proximity && (
        <p className="flex items-start gap-2 text-sm text-charcoal mb-5">
          <span className="mt-0.5 text-burgundy"><Pin /></span>
          {stop.proximity}
        </p>
      )}
      <Link href={"/destinations/" + stop.slug} className="group inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-burgundy">
        <span className="underline decoration-burgundy/30 underline-offset-4 transition-colors group-hover-fine:decoration-burgundy">
          {stop.comingSoon ? "See " + stop.name : "Explore " + stop.name}
        </span>
        <span aria-hidden className="transition-transform duration-300 ease-snap group-hover-fine:translate-x-1">→</span>
      </Link>
    </>
  );
}

function Layer({ stop, i, n, progress }: { stop: JourneyStop; i: number; n: number; progress: MotionValue<number> }) {
  const opacity = useTransform(
    progress,
    [i / n - 0.07, i / n + 0.03, (i + 1) / n - 0.07, (i + 1) / n + 0.03],
    [i === 0 ? 1 : 0, 1, 1, i === n - 1 ? 1 : 0]
  );
  const local = useTransform(progress, [i / n, (i + 1) / n], [0, 1]);
  return (
    <motion.div style={{ opacity }} className="absolute inset-0">
      <DestinationScene slug={stop.slug} progress={local} />
    </motion.div>
  );
}

function Pinned({ stops }: { stops: JourneyStop[] }) {
  const ref = useRef<HTMLElement>(null);
  const n = stops.length;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", function (v) {
    setActive(Math.min(n - 1, Math.max(0, Math.floor(v * n))));
  });
  const fill = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={ref} id="journey" aria-labelledby="journey-title" className="relative bg-[#240713]" style={{ height: n * 85 + "svh" }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {stops.map(function (s, i) {
          return <Layer key={s.slug} stop={s} i={i} n={n} progress={scrollYProgress} />;
        })}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#240713]/70 via-transparent to-[#240713]/55" />

        <div className="absolute top-24 sm:top-28 left-6 lg:left-16 right-6 z-10">
          <p className="text-sm font-medium text-gold mb-2">A tour of our destinations</p>
          <h2 id="journey-title" className="text-[2.2rem] sm:text-5xl lg:text-6xl text-ivory max-w-xl leading-[1.04]">Where we host you</h2>
        </div>

        <div className="absolute z-10 left-4 right-4 bottom-6 sm:left-8 sm:right-auto lg:left-16 lg:bottom-16 sm:w-[26rem]">
          <div className="relative min-h-[21rem] sm:min-h-[23rem]">
            {stops.map(function (s, i) {
              const on = active === i;
              return (
                <motion.div
                  key={s.slug}
                  animate={{ opacity: on ? 1 : 0, y: on ? 0 : 18 }}
                  transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                  inert={!on}
                  className="absolute inset-0 bg-ivory/95 backdrop-blur-md rounded-sm p-6 sm:p-8 shadow-[0_30px_80px_-24px_rgba(20,4,12,0.8)]"
                >
                  <StopCopy stop={s} index={i} total={n} />
                </motion.div>
              );
            })}
          </div>
        </div>

        <div aria-hidden className="absolute z-10 right-4 sm:right-8 top-1/2 -translate-y-1/2 hidden sm:flex flex-col items-end gap-4">
          {stops.map(function (s, i) {
            return (
              <span key={s.slug} className={"flex items-center gap-3 text-sm font-semibold transition-colors duration-300 " + (active === i ? "text-ivory" : "text-ivory/45")}>
                {s.name}
                <span className={"block h-2 w-2 rounded-full transition-all duration-300 " + (active === i ? "bg-gold scale-150" : "bg-ivory/40")} />
              </span>
            );
          })}
        </div>
        <div aria-hidden className="absolute z-10 bottom-0 left-0 h-1 bg-gold/80" >
          <motion.div style={{ width: fill }} className="h-1 bg-gold" />
        </div>
      </div>
    </section>
  );
}

function Static({ stops }: { stops: JourneyStop[] }) {
  return (
    <section id="journey" aria-labelledby="journey-title" className="bg-[#240713] py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <p className="text-sm font-medium text-gold mb-2">A tour of our destinations</p>
        <h2 id="journey-title" className="text-4xl lg:text-5xl text-ivory mb-10">Where we host you</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {stops.map(function (s, i) {
            return (
              <article key={s.slug} className="bg-ivory rounded-sm overflow-hidden">
                <div className="relative h-48"><DestinationScene slug={s.slug} /></div>
                <div className="p-6"><StopCopy stop={s} index={i} total={stops.length} /></div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// The page's second act: a pinned, scroll-driven tour. Each destination's illustrated scene fades into the next as
// you scroll, and its card swaps with it. Every card's text and link stay in the HTML; people who prefer reduced
// motion get a plain grid instead.
export default function DestinationJourney({ stops }: { stops: JourneyStop[] }) {
  const reduce = useReducedMotion();
  return reduce ? <Static stops={stops} /> : <Pinned stops={stops} />;
}

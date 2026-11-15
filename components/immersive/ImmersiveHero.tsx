"use client";
import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import DestinationScene from "./DestinationScene";

const HEADLINE = "A Home-Away-From-Home, Managed So You Don't Have To Worry.";

// Full-screen opening: a dusk-lit Jaipur skyline that parallaxes as you scroll, a headline that lifts in word by
// word, and the availability form as the single action. The words are real text in the page, drawn with CSS, so
// they are in the HTML for search and AI crawlers and still show if scripts are slow.
export default function ImmersiveHero({
  stops,
  children,
}: {
  stops: { slug: string; name: string }[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const words = HEADLINE.split(" ");

  return (
    <section ref={ref} className="relative isolate min-h-[100svh] overflow-hidden bg-[#2E0B1B]">
      <DestinationScene slug="jaipur" progress={scrollYProgress} />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#240713]/80 via-[#240713]/35 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#240713]/70 to-transparent" />
      <div aria-hidden className="absolute inset-0 rb-jaali opacity-[0.07] mix-blend-soft-light" />

      <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-24 min-h-[100svh] grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
        <div className="min-w-0">
          <p className="rb-rise flex items-center gap-3 text-sm font-medium text-gold mb-6">
            <span aria-hidden className="h-px w-10 bg-gold" />
            India, Thoughtfully Hosted
          </p>
          <h1 className="text-[2.35rem] sm:text-[3.2rem] xl:text-[3.4rem] leading-[1.06] text-ivory mb-6 max-w-2xl">
            {words.map(function (w, i) {
              return (
                <span key={i} className="inline-block whitespace-nowrap overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em] mr-[0.26em]">
                  <span className="rb-word inline-block" style={{ animationDelay: 250 + i * 70 + "ms" }}>{w}</span>
                </span>
              );
            })}
          </h1>
          <p className="rb-rise rb-rise-3 text-lg text-ivory/85 leading-relaxed max-w-md mb-6">
            Hotels, villas, serviced apartments and boutique stays across India, each one managed to the same exacting standard.
          </p>
          <nav aria-label="Our destinations" className="rb-rise rb-rise-3 flex flex-wrap items-center gap-2">
            {stops.map(function (s) {
              return (
                <Link key={s.slug} href={"/destinations/" + s.slug} className="inline-flex items-center min-h-[40px] px-4 rounded-full border border-ivory/35 bg-ivory/10 backdrop-blur-sm text-sm font-semibold text-ivory transition-[background-color,border-color,transform] duration-300 ease-snap hover-fine:bg-ivory hover-fine:text-burgundy hover-fine:-translate-y-0.5">
                  {s.name}
                </Link>
              );
            })}
          </nav>
          <p className="rb-rise rb-rise-3 text-sm text-ivory/75 mt-6">
            <span className="text-gold">★ </span>Airbnb Superhost · Book direct, no OTA fees
          </p>
        </div>
        <div className="rb-rise rb-rise-3 w-full lg:justify-self-end lg:max-w-xl [&>*]:!bg-ivory [&>*]:rounded-sm [&>*]:shadow-[0_30px_80px_-20px_rgba(20,4,12,0.7)] [&>*]:ring-1 [&>*]:ring-ivory/30">
          {children}
        </div>
      </motion.div>

      <a href="#journey" className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden sm:flex flex-col items-center gap-2 text-xs font-medium text-ivory/80 hover-fine:text-ivory min-h-[44px]">
        Scroll
        <span aria-hidden className="relative block h-9 w-px overflow-hidden bg-ivory/30">
          <span className="rb-scrollcue absolute inset-x-0 top-0 h-3 bg-ivory" />
        </span>
      </a>
    </section>
  );
}

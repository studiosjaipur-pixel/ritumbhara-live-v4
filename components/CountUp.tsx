"use client";
import { useEffect, useRef, useState } from "react";

// Counts the first number in `value` up from 0 when scrolled into view, keeping any prefix/suffix (₹, %).
export default function CountUp({ value }: { value: string }) {
  const m = value.match(/^(\D*)(\d+)(.*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(m ? 0 : 0);
  const [done, setDone] = useState(!m);
  useEffect(() => {
    if (!m) return;
    const target = parseInt(m[2], 10);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(target); setDone(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick); else setDone(true);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  if (!m) return <span>{value}</span>;
  return <span ref={ref} aria-label={value}>{m[1]}{done ? m[2] : n}{m[3]}</span>;
}

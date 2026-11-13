"use client";
import { useEffect, useRef, useState } from "react";

// Fades children up once they scroll into view. Content stays visible without JS motion
// support: prefers-reduced-motion is handled in globals.css.
export default function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={"rv " + (shown ? "rv-in " : "") + className} style={{ ["--rv-delay" as string]: delay + "ms" }}>
      {children}
    </div>
  );
}

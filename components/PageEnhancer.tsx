"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Gentle scroll-in for the sections of a page, applied after load so the page is fully readable without
// JavaScript. The first section (the hero) and anything already on screen are left alone, and reduced-motion visitors see no animation at all.
export default function PageEnhancer() {
  const pathname = usePathname() || "/";

  useEffect(function () {
    if (pathname.indexOf("/ai") === 0) return; // the AI page has its own motion
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.querySelector("main");
    if (!main) return;

    const targets: HTMLElement[] = [];
    main.querySelectorAll<HTMLElement>(":scope > section, :scope > article, :scope > figure").forEach(function (el, i) {
      if (i === 0 || el.hasAttribute("data-no-reveal") || el.classList.contains("rv")) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
      targets.push(el);
    });

    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("rv-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });

    targets.forEach(function (el) {
      el.classList.add("rv");
      io.observe(el);
    });

    return function () {
      io.disconnect();
      targets.forEach(function (el) { el.classList.remove("rv", "rv-in"); });
    };
  }, [pathname]);

  return null;
}

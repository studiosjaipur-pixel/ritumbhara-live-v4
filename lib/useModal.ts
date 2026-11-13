"use client";
import { RefObject, useEffect, useRef } from "react";

// Shared behaviour for dialogs, sheets and the photo viewer: Escape closes, Tab stays inside, the page behind
// does not scroll, focus moves in on open and returns to whatever opened it on close.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModal(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(function () {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusables(): HTMLElement[] {
      const root = containerRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(function (el) {
        return el.getClientRects().length > 0;
      });
    }

    const timer = window.setTimeout(function () {
      const root = containerRef.current;
      const target = (root && root.querySelector<HTMLElement>("[data-autofocus]")) || focusables()[0];
      if (target) target.focus();
    }, 30);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !containerRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !containerRef.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);

    return function () {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, [open, containerRef]);
}

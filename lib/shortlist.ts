"use client";
import { useCallback, useEffect, useState } from "react";

// A visitor's saved stays ("shortlist"). Kept in localStorage so it survives a return visit, with an in-memory
// fallback if storage is blocked. Nothing leaves the browser until the visitor chooses to send an enquiry.

const KEY = "rb_shortlist";
const EVENT = "rb:shortlist";
export const OPEN_SHORTLIST_EVENT = "rb:open-shortlist";
const MAX_SAVED = 6;

let memory: string[] = [];

function clean(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  raw.forEach(function (v) {
    if (typeof v === "string" && /^[a-z0-9-]{1,60}$/.test(v) && out.indexOf(v) === -1) out.push(v);
  });
  return out.slice(0, MAX_SAVED);
}

function read(): string[] {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved) return clean(JSON.parse(saved));
  } catch {
    // Storage blocked or unreadable: use the in-memory copy.
  }
  return clean(memory);
}

function write(next: string[]) {
  memory = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore: the in-memory copy is enough for this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function openShortlist() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SHORTLIST_EVENT));
}

export const SHORTLIST_LIMIT = MAX_SAVED;

// Returns { saved, toggle, remove, clear, ready, full }. `ready` is false until storage has been read so the
// server render and first client render agree.
export function useShortlist() {
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(function () {
    setSaved(read());
    setReady(true);
    function onChange() { setSaved(read()); }
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return function () {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback(function (slug: string): boolean {
    const current = read();
    if (current.indexOf(slug) !== -1) {
      write(current.filter(function (s) { return s !== slug; }));
      return true;
    }
    if (current.length >= MAX_SAVED) return false;
    write(current.concat(slug));
    return true;
  }, []);

  const remove = useCallback(function (slug: string) {
    write(read().filter(function (s) { return s !== slug; }));
  }, []);

  const clear = useCallback(function () { write([]); }, []);

  return { saved: saved, toggle: toggle, remove: remove, clear: clear, ready: ready, full: saved.length >= MAX_SAVED };
}

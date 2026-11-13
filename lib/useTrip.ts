"use client";
import { useCallback, useEffect, useState } from "react";
import { EMPTY_TRIP, Trip, isISO, todayISO } from "@/lib/trip";

// Remembers the visitor's dates and guests for this browser session, so the dates typed on the home page are
// already filled in on a property page, in the header dialog and in the contact form. Nothing leaves the
// browser, and sessionStorage is optional: if it is blocked the details are kept in memory for the page's life.

const KEY = "rb_trip";
const EVENT = "rb:trip";

let memory: Trip = EMPTY_TRIP;

// Shape check only. Dates the visitor has just typed are kept even when they are wrong (e.g. in the past), so the
// form can explain the problem instead of silently erasing them; stale dates from an earlier visit are dropped
// once, when the page loads.
function sanitise(raw: Partial<Trip> | null): Trip {
  const next: Trip = { ...EMPTY_TRIP };
  if (!raw) return next;
  if (isISO(raw.checkIn)) next.checkIn = raw.checkIn;
  if (isISO(raw.checkOut)) next.checkOut = raw.checkOut;
  if (typeof raw.guests === "number" && raw.guests >= 1 && raw.guests <= 20) next.guests = Math.round(raw.guests);
  if (typeof raw.destination === "string") next.destination = raw.destination.slice(0, 40);
  if (typeof raw.property === "string") next.property = raw.property.slice(0, 60);
  return next;
}

function read(): Trip {
  try {
    const saved = window.sessionStorage.getItem(KEY);
    if (saved) return sanitise(JSON.parse(saved));
  } catch {
    // Storage blocked or unreadable: fall back to memory.
  }
  return sanitise(memory);
}

function write(next: Trip) {
  memory = next;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore: memory copy is enough.
  }
}

// Returns [trip, update, ready]. `ready` is false until the stored values have been read, so server and first
// client render match.
export function useTrip(): [Trip, (patch: Partial<Trip>) => void, boolean] {
  const [trip, setTrip] = useState<Trip>(EMPTY_TRIP);
  const [ready, setReady] = useState(false);

  useEffect(function () {
    const stored = read();
    if (stored.checkIn && stored.checkIn < todayISO()) write({ ...stored, checkIn: "", checkOut: "" });
    setTrip(read());
    setReady(true);
    function onChange() { setTrip(read()); }
    window.addEventListener(EVENT, onChange);
    return function () { window.removeEventListener(EVENT, onChange); };
  }, []);

  const update = useCallback(function (patch: Partial<Trip>) {
    const next = sanitise({ ...read(), ...patch });
    write(next);
    setTrip(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [trip, update, ready];
}

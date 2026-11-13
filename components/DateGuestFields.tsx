"use client";
import { useId } from "react";
import { Trip, addDays, nightsBetween, weekendPresets } from "@/lib/trip";

export const fieldClass =
  "w-full min-h-[44px] border border-line rounded-sm px-3 py-2 text-sm text-charcoal bg-ivory hover-fine:border-charcoal-muted focus:border-burgundy transition-colors";
export const labelClass = "text-xs font-semibold text-charcoal-soft mb-1.5";

// Check-in / check-out dates, quick weekend picks and a guest stepper. Used by the availability widget and the
// contact enquiry form, so both behave the same way.
export default function DateGuestFields({
  trip,
  update,
  today,
  maxGuests,
}: {
  trip: Trip;
  update: (patch: Partial<Trip>) => void;
  today: string;
  maxGuests?: number;
}) {
  const uid = useId();
  const cap = maxGuests && maxGuests > 0 ? maxGuests : 12;
  const presets = today ? weekendPresets(today) : [];
  const hasDates = !!(trip.checkIn || trip.checkOut);

  function onCheckIn(value: string) {
    if (!value) {
      update({ checkIn: "", checkOut: "" });
      return;
    }
    // Keep the length of stay the visitor already chose; otherwise default to one night.
    const kept = trip.checkIn && trip.checkOut && trip.checkOut > trip.checkIn ? nightsBetween(trip.checkIn, trip.checkOut) : 1;
    update({ checkIn: value, checkOut: !trip.checkOut || trip.checkOut <= value ? addDays(value, kept) : trip.checkOut });
  }

  function setGuests(n: number) {
    update({ guests: Math.min(cap, Math.max(1, n)) });
  }

  const guests = Math.min(trip.guests, cap);

  return (
    <div>
      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label="Quick date picks">
          {presets.map(function (p) {
            const active = trip.checkIn === p.checkIn && trip.checkOut === p.checkOut;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={function () { update({ checkIn: p.checkIn, checkOut: p.checkOut }); }}
                className={
                  "min-h-[36px] px-3 rounded-full border text-xs font-semibold active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-200 ease-snap " +
                  (active ? "bg-burgundy border-burgundy text-ivory" : "bg-ivory border-line text-charcoal-soft hover-fine:border-burgundy hover-fine:text-burgundy")
                }
              >
                {p.label}
              </button>
            );
          })}
          {hasDates && (
            <button
              type="button"
              onClick={function () { update({ checkIn: "", checkOut: "" }); }}
              className="min-h-[36px] px-2 text-xs font-medium text-charcoal-muted underline underline-offset-4 decoration-line hover-fine:text-burgundy"
            >
              Clear dates
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex flex-col min-w-0">
          <label htmlFor={uid + "-in"} className={labelClass}>Check-in</label>
          <input
            type="date"
            id={uid + "-in"}
            value={trip.checkIn}
            min={today || undefined}
            onChange={function (e) { onCheckIn(e.target.value); }}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <label htmlFor={uid + "-out"} className={labelClass}>Check-out</label>
          <input
            type="date"
            id={uid + "-out"}
            value={trip.checkOut}
            min={trip.checkIn ? addDays(trip.checkIn, 1) : today || undefined}
            onChange={function (e) { update({ checkOut: e.target.value }); }}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border border-line rounded-sm bg-ivory px-3 min-h-[52px]">
        <div className="min-w-0">
          <p id={uid + "-g"} className="text-xs font-semibold text-charcoal-soft">Guests</p>
          {maxGuests ? <p className="text-[11px] text-charcoal-muted">Sleeps up to {maxGuests}</p> : null}
        </div>
        <div className="flex items-center gap-1" role="group" aria-labelledby={uid + "-g"}>
          <button
            type="button"
            aria-label="Fewer guests"
            disabled={guests <= 1}
            onClick={function () { setGuests(guests - 1); }}
            className="w-11 h-11 flex items-center justify-center rounded-full text-xl leading-none text-burgundy hover-fine:bg-sand active:scale-90 disabled:opacity-30 disabled:active:scale-100 transition-[background-color,transform] duration-150"
          >
            &minus;
          </button>
          <output aria-live="polite" className="w-8 text-center font-semibold text-charcoal tabular-nums">{guests}</output>
          <button
            type="button"
            aria-label="More guests"
            disabled={guests >= cap}
            onClick={function () { setGuests(guests + 1); }}
            className="w-11 h-11 flex items-center justify-center rounded-full text-xl leading-none text-burgundy hover-fine:bg-sand active:scale-90 disabled:opacity-30 disabled:active:scale-100 transition-[background-color,transform] duration-150"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

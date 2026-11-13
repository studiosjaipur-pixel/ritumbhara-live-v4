"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { destinations } from "@/config/destinations.config";
import { properties } from "@/config/properties.config";
import { bookingEngine } from "@/config/booking.config";
import { buildWhatsAppUrl, makeWhatsAppRef, pageRefFromPath } from "@/lib/whatsapp";
import { useTrip } from "@/lib/useTrip";
import { formatLong, nightsBetween, plural, todayISO, tripSummary, validateDates } from "@/lib/trip";
import DateGuestFields, { fieldClass, labelClass } from "@/components/DateGuestFields";

// The site's main booking control. Visitors pick a stay, dates and guests; the dates are remembered across pages
// and the button opens WhatsApp with everything pre-filled, so the team can answer with real availability.
// (This website does not take reservations or payments; the room's own booking page is offered alongside.)
//
// variant "hero" / "inline": a framed card for page sections. "stack": no frame, for dialogs and side panels.
// fixedPropertySlug: used on a property page, where the stay is already known.
export default function CheckAvailabilityWidget({
  variant,
  defaultDestination,
  fixedPropertySlug,
}: {
  variant?: "hero" | "inline" | "stack";
  defaultDestination?: string;
  fixedPropertySlug?: string;
}) {
  const operational = destinations.filter(function (d) { return d.status === "operational"; });
  const fixedProperty = fixedPropertySlug ? properties.find(function (p) { return p.slug === fixedPropertySlug; }) : undefined;

  const [trip, update] = useTrip();
  const [today, setToday] = useState("");
  const [destOverride, setDestOverride] = useState<string | null>(null);
  const [propOverride, setPropOverride] = useState<string | null>(null);
  const uid = useId();
  const waRef = makeWhatsAppRef(pageRefFromPath(usePathname() || "/"), "AVAILABILITY");

  useEffect(function () { setToday(todayISO()); }, []);

  const firstSlug = operational[0] ? operational[0].slug : "";
  const validDest = function (s?: string | null) { return !!s && operational.some(function (d) { return d.slug === s; }); };
  const destinationSlug = fixedProperty
    ? fixedProperty.destinationSlug
    : validDest(destOverride) ? (destOverride as string)
    : validDest(defaultDestination) ? (defaultDestination as string)
    : validDest(trip.destination) ? trip.destination
    : firstSlug;
  const destination = destinations.find(function (d) { return d.slug === destinationSlug; });
  const destinationStays = properties.filter(function (p) { return p.destinationSlug === destinationSlug; });
  const stayCandidate = fixedProperty ? fixedProperty.slug : propOverride !== null ? propOverride : trip.property;
  const selectedStay = destinationStays.find(function (p) { return p.slug === stayCandidate; });

  // On a property page the guest count never exceeds that stay's listed capacity, whatever was entered elsewhere.
  const guests = fixedProperty && fixedProperty.maxGuests ? Math.min(trip.guests, fixedProperty.maxGuests) : trip.guests;
  const dateError = validateDates(trip.checkIn, trip.checkOut, today);
  const hasRange = !!(trip.checkIn && trip.checkOut && trip.checkOut > trip.checkIn);

  // Does the group fit? Uses capacities listed on the booking engine only; unknown capacities are never assumed.
  const pool = selectedStay ? [selectedStay] : destinationStays;
  const knownFits = pool.filter(function (p) { return p.maxGuests !== undefined && p.maxGuests >= guests; }).length;
  const unknownCapacity = pool.filter(function (p) { return p.maxGuests === undefined; }).length;
  let fitNote = "";
  if (selectedStay && selectedStay.maxGuests !== undefined && guests > selectedStay.maxGuests) {
    fitNote = selectedStay.name + " sleeps up to " + selectedStay.maxGuests + ". Choose another stay or message us and we’ll suggest a plan.";
  } else if (!selectedStay && !fixedProperty && guests > 2) {
    if (knownFits > 0) fitNote = plural(knownFits, "stay") + " in " + (destination ? destination.name : "this destination") + " list room for " + guests + " guests.";
    else if (unknownCapacity > 0) fitNote = "Message us to confirm room for " + guests + " guests.";
    else fitNote = "None of our stays here list room for " + guests + " guests. Message us and we’ll suggest options.";
  }

  function buildMessage() {
    const where = selectedStay
      ? selectedStay.name + (destination ? " in " + destination.name : "")
      : destination ? "a stay in " + destination.name : "a Ritumbhara stay";
    let message = "Hi, I'd like to check availability for " + where;
    if (hasRange) {
      message += " from " + formatLong(trip.checkIn) + " to " + formatLong(trip.checkOut) + " (" + plural(nightsBetween(trip.checkIn, trip.checkOut), "night") + ")";
    } else if (trip.checkIn) {
      message += " from " + formatLong(trip.checkIn);
    }
    message += " for " + plural(guests, "guest") + ".";
    return message;
  }

  const framed = variant !== "stack";
  const wrapper = framed
    ? "bg-sand/70 border-t-2 border-burgundy rounded-sm p-5 " + (variant === "hero" ? "lg:p-6 max-w-xl" : "sm:p-6 max-w-2xl")
    : "";

  const ctaClass =
    "flex items-center justify-center min-h-[48px] text-center bg-burgundy text-ivory font-semibold py-3 px-4 rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] active:duration-100 active:ease-out transition-[background-color,transform] duration-200 ease-snap w-full";

  return (
    <div className={wrapper}>
      {!fixedProperty && (
        <div className={"grid gap-3 mb-3 " + (destinationStays.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          <div className="flex flex-col min-w-0">
            <label htmlFor={uid + "-dest"} className={labelClass}>Destination</label>
            <select
              id={uid + "-dest"}
              value={destinationSlug}
              onChange={function (e) {
                setDestOverride(e.target.value);
                setPropOverride("");
                update({ destination: e.target.value, property: "" });
              }}
              className={fieldClass}
            >
              {operational.map(function (d) {
                return <option key={d.slug} value={d.slug}>{d.name}</option>;
              })}
            </select>
          </div>
          {destinationStays.length > 1 && (
            <div className="flex flex-col min-w-0">
              <label htmlFor={uid + "-stay"} className={labelClass}>Stay</label>
              <select
                id={uid + "-stay"}
                value={selectedStay ? selectedStay.slug : ""}
                onChange={function (e) {
                  setPropOverride(e.target.value);
                  update({ property: e.target.value });
                }}
                className={fieldClass}
              >
                <option value="">Any stay</option>
                {destinationStays.map(function (p) {
                  return <option key={p.slug} value={p.slug}>{p.name}</option>;
                })}
              </select>
            </div>
          )}
        </div>
      )}

      <DateGuestFields trip={trip} update={update} today={today} maxGuests={fixedProperty ? fixedProperty.maxGuests : undefined} />

      <div className="min-h-[1.25rem] mt-3 mb-3 text-sm" aria-live="polite">
        {dateError ? (
          <p role="alert" className="text-burgundy font-medium">{dateError}</p>
        ) : (
          <p className="text-charcoal-soft">{hasRange || trip.checkIn ? tripSummary({ ...trip, guests: guests }) : "Add dates to get an exact answer, or send guests only and we’ll suggest dates."}</p>
        )}
        {fitNote && !dateError ? <p className="text-charcoal-muted text-xs mt-1">{fitNote}</p> : null}
      </div>

      {dateError ? (
        <button type="button" aria-disabled="true" onClick={function () { document.getElementById(uid + "-dest")?.focus(); }} className={ctaClass + " opacity-60 cursor-not-allowed"}>
          Fix the dates above to continue
        </button>
      ) : (
        <a
          href={buildWhatsAppUrl(buildMessage(), waRef)}
          // Context for click tracking (components/WhatsAppClickTracker.tsx). Booking details only, no personal data.
          data-wa-ref={waRef}
          data-wa-cta="availability"
          data-wa-destination={selectedStay ? selectedStay.slug : destinationSlug}
          data-wa-check-in={trip.checkIn}
          data-wa-check-out={trip.checkOut}
          data-wa-guests={String(guests)}
          target="_blank"
          rel="noopener"
          className={ctaClass}
        >
          Check Availability via WhatsApp
        </a>
      )}

      {fixedProperty ? (
        <a
          href={fixedProperty.hotelSpiderBookingUrl || bookingEngine.generalUrl}
          target="_blank"
          rel="noopener"
          className="flex items-center justify-center min-h-[48px] mt-2 text-center border border-burgundy text-burgundy font-semibold py-3 px-4 rounded-sm hover-fine:bg-burgundy hover-fine:text-ivory active:scale-[0.98] transition-[background-color,color,transform] duration-200 ease-snap w-full"
        >
          {fixedProperty.hotelSpiderBookingUrl ? "Check Live Price & Book" : "Browse Bookable Rooms"}
        </a>
      ) : destination ? (
        <Link href={"/destinations/" + destination.slug} className="flex items-center justify-center min-h-[44px] mt-1 text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors">
          {"See all stays in " + destination.name + " →"}
        </Link>
      ) : null}

      <p className="text-xs text-center text-charcoal-muted mt-3">We reply directly {"—"} no OTA fees, real-time human answers</p>
    </div>
  );
}

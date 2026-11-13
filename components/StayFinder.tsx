"use client";
import { useMemo, useState } from "react";
import { properties, Property } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";
import { useTrip } from "@/lib/useTrip";
import { plural, tripSummary } from "@/lib/trip";
import { openAvailability } from "@/lib/availability-events";
import PropertyCard from "@/components/PropertyCard";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const TYPES: Property["propertyType"][] = ["Studio", "Serviced Apartment", "Villa"];

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border text-sm font-semibold active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-200 ease-snap " +
        (active ? "bg-burgundy border-burgundy text-ivory" : count === 0 ? "bg-ivory border-line text-charcoal-muted opacity-60" : "bg-ivory border-line text-charcoal hover-fine:border-burgundy hover-fine:text-burgundy")
      }
    >
      {children}
      {typeof count === "number" && <span className={"text-xs font-medium tabular-nums " + (active ? "text-ivory/80" : "text-charcoal-muted")}>{count}</span>}
    </button>
  );
}

// Filterable list of every stay: pick a destination, a type and the number of guests, and the cards update
// straight away. Capacities are the ones listed on the booking engine; stays with no listed capacity stay in the
// list rather than being hidden by a guess.
export default function StayFinder() {
  const [dest, setDest] = useState("");
  const [type, setType] = useState("");
  const [trip, update] = useTrip();
  const [minGuests, setMinGuests] = useState(1);

  const destOptions = destinations.filter(function (d) { return properties.some(function (p) { return p.destinationSlug === d.slug; }); });
  const typeOptions = TYPES.filter(function (t) { return properties.some(function (p) { return p.propertyType === t; }); });

  function matches(p: Property, d: string, t: string, g: number) {
    return (!d || p.destinationSlug === d) && (!t || p.propertyType === t) && (p.maxGuests === undefined || p.maxGuests >= g);
  }

  const results = useMemo(function () {
    const list = properties.filter(function (p) { return matches(p, dest, type, minGuests); });
    // Featured stays first, otherwise the configured order.
    return list.slice().sort(function (a, b) { return Number(b.featured) - Number(a.featured); });
  }, [dest, type, minGuests]);

  const filtered = !!(dest || type || minGuests > 1);
  const destName = dest ? (destinations.find(function (d) { return d.slug === dest; }) || { name: "" }).name : "";
  const hasDates = !!(trip.checkIn && trip.checkOut);

  return (
    <section id="all-stays" aria-labelledby="stay-finder-title" className="mt-14 lg:mt-20 pt-10 border-t border-line scroll-mt-28" data-no-reveal>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 id="stay-finder-title" className="text-3xl lg:text-[2.5rem] text-charcoal mb-2">Find your stay</h2>
          <p className="text-charcoal-soft max-w-xl leading-relaxed">Filter by place, type and group size. Open any stay for photos, amenities and live booking.</p>
        </div>
        <button
          type="button"
          onClick={function () { openAvailability({ destination: dest || undefined }); }}
          className="inline-flex items-center justify-center min-h-[48px] px-6 bg-burgundy text-ivory font-semibold rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] transition-[background-color,transform] duration-200 ease-snap"
        >
          {hasDates ? "Change dates" : "Add your dates"}
        </button>
      </div>

      {hasDates && (
        <p className="mb-5 text-sm text-charcoal-soft border-l-2 border-burgundy pl-3">
          Your trip: <span className="font-semibold text-charcoal">{tripSummary(trip)}</span>. Open a stay to check it for these dates.
        </p>
      )}

      <div className="space-y-4 mb-8">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Destination">
          <Chip active={!dest} onClick={function () { setDest(""); }}>All places</Chip>
          {destOptions.map(function (d) {
            return (
              <Chip key={d.slug} active={dest === d.slug} onClick={function () { setDest(dest === d.slug ? "" : d.slug); }} count={properties.filter(function (p) { return matches(p, d.slug, type, minGuests); }).length}>
                {d.name}
              </Chip>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Type of stay">
            <Chip active={!type} onClick={function () { setType(""); }}>Any type</Chip>
            {typeOptions.map(function (t) {
              return (
                <Chip key={t} active={type === t} onClick={function () { setType(type === t ? "" : t); }} count={properties.filter(function (p) { return matches(p, dest, t, minGuests); }).length}>
                  {t === "Serviced Apartment" ? "Apartments" : t === "Villa" ? "Villas" : "Studios"}
                </Chip>
              );
            })}
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Group size">
            <span className="text-sm font-semibold text-charcoal-soft">Guests</span>
            <button type="button" aria-label="Fewer guests" disabled={minGuests <= 1} onClick={function () { setMinGuests(minGuests - 1); update({ guests: Math.max(1, minGuests - 1) }); }} className="w-11 h-11 rounded-full border border-line text-lg leading-none text-burgundy hover-fine:bg-sand active:scale-90 disabled:opacity-30 transition-[background-color,transform]">&minus;</button>
            <output aria-live="polite" className="w-6 text-center font-semibold tabular-nums">{minGuests}</output>
            <button type="button" aria-label="More guests" disabled={minGuests >= 8} onClick={function () { setMinGuests(minGuests + 1); update({ guests: minGuests + 1 }); }} className="w-11 h-11 rounded-full border border-line text-lg leading-none text-burgundy hover-fine:bg-sand active:scale-90 disabled:opacity-30 transition-[background-color,transform]">+</button>
          </div>
          {filtered && (
            <button type="button" onClick={function () { setDest(""); setType(""); setMinGuests(1); }} className="min-h-[44px] text-sm font-medium text-charcoal-muted underline underline-offset-4 decoration-line hover-fine:text-burgundy">
              Reset filters
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-charcoal-muted mb-5" aria-live="polite" role="status">
        {results.length === 0 ? "No stays match these filters." : "Showing " + plural(results.length, "stay") + (destName ? " in " + destName : "") + (minGuests > 1 ? " for " + plural(minGuests, "guest") : "")}
      </p>

      {minGuests > 1 && results.some(function (p) { return p.maxGuests === undefined; }) && (
        <p className="text-xs text-charcoal-muted -mt-3 mb-5">Some stays don&rsquo;t list a guest capacity yet, so they&rsquo;re still shown. Message us to confirm room for your group.</p>
      )}

      {results.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8 sm:gap-y-12">
          {results.map(function (p) {
            return <PropertyCard key={p.slug} property={p} />;
          })}
        </div>
      ) : (
        <div className="border-t-2 border-burgundy bg-sand/70 rounded-sm p-6 max-w-xl">
          <p className="font-display text-[1.6rem] leading-tight text-charcoal mb-2">Not seeing the right fit?</p>
          <p className="text-charcoal-soft mb-4">Tell us what you need and we&rsquo;ll suggest the best match, including options for larger groups.</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={buildWhatsAppUrl("Hi, I'm looking for a stay for " + plural(minGuests, "guest") + (destName ? " in " + destName : "") + ". Can you suggest options?", "W-PAGE-destinations-FINDER")}
              data-wa-ref="W-PAGE-destinations-FINDER"
              data-wa-cta="finder"
              data-wa-guests={String(minGuests)}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center min-h-[48px] px-6 bg-burgundy text-ivory font-semibold rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] transition-[background-color,transform]"
            >
              Ask us on WhatsApp
            </a>
            <button type="button" onClick={function () { setDest(""); setType(""); setMinGuests(1); }} className="inline-flex items-center min-h-[48px] px-2 font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4">
              Reset filters
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

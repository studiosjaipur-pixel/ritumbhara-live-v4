import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Property } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";
import { isPlacementVerified } from "@/config/locations.config";

// Editorial card: photograph first, then place, name and a single quiet call to action.
export default function PropertyCard({ property }: { property: Property }) {
  // Location label from existing destination data (Week 3: UX-011).
  const destination = destinations.find(function (d) { return d.slug === property.destinationSlug; });
  // No city label where Hotel-Spider does not confirm the room's placement (the "Alwar"-named rooms).
  const locationLabel = destination ? (isPlacementVerified(destination.slug) ? destination.name + ", " + destination.state : destination.state) : "";

  // Short, verified facts for the card: guest capacity from the booking engine, then up to two amenities
  // (skipping the engine's long "...individually controlled in room" variant, which repeats air conditioning).
  const cardFacts = (property.maxGuests ? ["Up to " + property.maxGuests + " guests"] : []).concat(
    property.amenities.filter(function (a) { return a.indexOf("individually controlled") === -1; }).slice(0, property.maxGuests ? 2 : 3)
  );
  return React.createElement(Link, {
    href: "/properties/" + property.slug,
    className: "property-card city-" + property.destinationSlug + " group flex flex-col h-full",
  },
    React.createElement("div", { className: "relative aspect-[4/3] sm:aspect-[4/5] w-full overflow-hidden rounded-sm bg-sand" },
      React.createElement(Image, {
        src: property.heroImage,
        alt: property.name,
        fill: true,
        sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
        quality: 70,
        className: "object-cover transition-transform duration-700 ease-snap group-hover-fine:scale-[1.04]",
      }),
      React.createElement("div", { className: "absolute top-3 left-3 right-3 flex items-start justify-between gap-2" },
        React.createElement("span", { className: "text-[11px] font-semibold tracking-wide bg-ivory/95 text-charcoal px-2.5 py-1 rounded-sm" }, property.propertyType)
      )
    ),
    React.createElement("div", { className: "flex flex-col flex-1 pt-4" },
      locationLabel && React.createElement("p", { className: "text-xs font-medium text-sage mb-1" }, locationLabel),
      React.createElement("h3", { className: "font-display text-[1.75rem] leading-tight text-charcoal group-hover-fine:text-burgundy transition-colors" }, property.name),
      cardFacts.length > 0 && React.createElement("p", { className: "text-sm text-charcoal-soft mt-1.5" }, cardFacts.join(" · ")),
      React.createElement("div", { className: "mt-auto pt-4 flex items-center justify-between gap-3 border-b border-line pb-3" },
        React.createElement("span", { className: "text-xs text-charcoal-muted" }, "Book direct with Ritumbhara"),
        React.createElement("span", { className: "inline-flex items-center gap-1 text-sm font-semibold text-burgundy" },
          "Availability & pricing",
          React.createElement("span", { "aria-hidden": true, className: "transition-transform duration-200 group-hover-fine:translate-x-0.5" }, "→")
        )
      )
    )
  );
}

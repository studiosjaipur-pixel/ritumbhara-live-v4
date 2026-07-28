"use client";

import React, { useState } from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";

// Marker positions are stylized, illustrative placements -- NOT a precise
// lat/long projection. Jaipur, Alwar, Sariska and Agra sit close together in
// real-world geography, so plotting their true coordinates on a small card
// caused every marker (and label) to collapse into one unreadable cluster.
// These positions preserve each destination's correct relative direction
// (e.g. Agra stays easternmost, Alwar stays northernmost, Jaipur stays
// southwest) while spreading them out enough to stay legible. Swap for a
// library such as react-simple-maps with a proper GeoJSON/TopoJSON source
// if pixel-accurate cartography is ever needed.
interface MarkerPosition {
  slug: string;
  leftPercent: number;
  topPercent: number;
}

const markerPositions: MarkerPosition[] = [
  { slug: "jaipur", leftPercent: 20, topPercent: 75 },
  { slug: "alwar", leftPercent: 58, topPercent: 22 },
  { slug: "sariska", leftPercent: 40, topPercent: 48 },
  { slug: "agra", leftPercent: 80, topPercent: 50 },
  ];

export default function IndiaMap() {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

return React.createElement(
  "div",
  {
    className:
      "relative w-full aspect-[4/5] max-w-md mx-auto bg-gradient-to-b from-[#FBF9F6] to-stone-100 rounded-xl border border-neutral-200 overflow-hidden",
  },
  React.createElement(
    "p",
    { className: "absolute top-4 left-4 text-xs uppercase tracking-wide text-neutral-400" },
    "Our Destinations"
    ),
  React.createElement(
    "div",
    { className: "absolute bottom-4 left-4 flex items-center gap-4 text-[11px] text-neutral-500" },
    React.createElement("span", { className: "flex items-center gap-1.5" },
                        React.createElement("span", { className: "w-2.5 h-2.5 rounded-full bg-[#97183C]" }),
                        "Open"
                        ),
    React.createElement("span", { className: "flex items-center gap-1.5" },
                        React.createElement("span", { className: "w-2.5 h-2.5 rounded-full bg-neutral-400" }),
                        "Coming soon"
                        )
    ),
  markerPositions.map(function (marker) {
    const destination = destinations.find(function (d) { return d.slug === marker.slug; });
    if (!destination) return null;
    const isActive = activeSlug === marker.slug;
    return React.createElement(
      "div",
      {
        key: marker.slug,
        className: "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center",
        style: { left: marker.leftPercent + "%", top: marker.topPercent + "%" },
        onMouseEnter: function () { setActiveSlug(marker.slug); },
        onMouseLeave: function () { setActiveSlug(null); },
      },
      React.createElement(
        Link,
        {
          href: "/destinations/" + destination.slug,
          onClick: function () { setActiveSlug(marker.slug); },
          "aria-label": destination.name + (destination.status === "coming-soon" ? " -- Coming Soon" : ""),
          className: "block",
        },
        React.createElement("span", {
          className:
            "block w-3.5 h-3.5 rounded-full border-2 border-white shadow transition-transform duration-200 " +
            (isActive ? "scale-125 " : "") +
            (destination.status === "operational" ? "bg-[#97183C]" : "bg-neutral-400"),
        })
        ),
      React.createElement(
        "span",
        {
          className:
            "mt-1.5 whitespace-nowrap bg-white/95 border border-neutral-200 rounded-md px-2 py-0.5 text-[11px] font-medium text-neutral-800 shadow-sm transition-opacity duration-150 " +
            (isActive ? "opacity-100" : "opacity-80"),
        },
        destination.name
        )
      );
  })
  );
}

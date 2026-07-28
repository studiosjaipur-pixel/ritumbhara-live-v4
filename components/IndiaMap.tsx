"use client";

import React, { useState } from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";

// Marker positions are approximate percentage placements derived from each
// destination's real latitude and longitude, projected onto a simplified,
// stylized outline. This is a lightweight illustrative map, not a precise
// geographic boundary -- swap for a library such as react-simple-maps with a
// proper GeoJSON/TopoJSON source for pixel-accurate cartography.
interface MarkerPosition {
  slug: string;
  leftPercent: number;
  topPercent: number;
}

const markerPositions: MarkerPosition[] = [
  { slug: "jaipur", leftPercent: 26.9, topPercent: 34.8 },
  { slug: "alwar", leftPercent: 29.8, topPercent: 32.6 },
  { slug: "sariska", leftPercent: 29.1, topPercent: 33.3 },
  { slug: "agra", leftPercent: 34.5, topPercent: 33.9 },
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

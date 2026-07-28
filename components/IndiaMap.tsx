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
    const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  return React.createElement(
        "div",
    {
          className:
            "relative w-full aspect-[4/5] max-w-md mx-auto bg-stone-100 rounded-xl border border-neutral-200 overflow-hidden",
    },
        React.createElement(
          "p",
    { className: "absolute top-4 left-4 text-xs uppercase tracking-wide text-neutral-400" },
          "Our Destinations"
        ),
        markerPositions.map((marker) => {
          const destination = destinations.find((d) => d.slug === marker.slug);
          if (!destination) return null;
      const isHovered = hoveredSlug === marker.slug;
      return React.createElement(
                "div",
        {
                  key: marker.slug,
                  className: "absolute -translate-x-1/2 -translate-y-1/2",
                  style: { left: marker.leftPercent + "%", top: marker.topPercent + "%" },
                  onMouseEnter: () => setHoveredSlug(marker.slug),
                              onMouseLeave: () => setHoveredSlug(null),
                    },
        React.createElement(
                              Link,
                    { href: "/destinations/" + destination.slug },
                              React.createElement("span", {
                                className:
                                  "block w-3 h-3 rounded-full border-2 border-white shadow " +
                                  (destination.status === "operational" ? "bg-[#97183C]" : "bg-neutral-400"),
                    })
                            ),
                            isHovered &&
                              React.createElement(
                                "div",
                    {
                                  className:
                                    "absolute left-1/2 -translate-x-1/2 top-5 whitespace-nowrap bg-white border border-neutral-200 rounded-md px-3 py-1 text-xs font-medium text-neutral-800 shadow-md z-10",
                    },
                                destination.name + (destination.status === "coming-soon" ? " -- Coming Soon" : "")
                              )
                          );
})
  );
}

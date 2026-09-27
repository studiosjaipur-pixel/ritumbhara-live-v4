import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Property } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";

export default function PropertyCard({ property }: { property: Property }) {
  // Location label from existing destination data (Week 3: UX-011).
  const destination = destinations.find(function (d) { return d.slug === property.destinationSlug; });
  const locationLabel = destination ? destination.name + ", " + destination.state : "";

  return React.createElement(Link, {
    href: "/properties/" + property.slug,
    className: "property-card city-" + property.destinationSlug + " group flex flex-col h-full rounded-md overflow-hidden bg-white border border-[#EDE7DD] hover-fine:border-[#D9CDB8] hover-fine:-translate-y-1 hover-fine:shadow-[0_14px_32px_rgba(26,26,26,0.08)] active:scale-[0.98] active:translate-y-0 active:duration-100 active:ease-out transition-[transform,border-color,box-shadow] duration-300 ease-snap",
  },
    React.createElement("div", { className: "relative aspect-[4/5] w-full overflow-hidden bg-[#EDE7DD]" },
      React.createElement(Image, {
        src: property.heroImage,
        alt: property.name,
        fill: true,
        sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
        quality: 70,
        className: "object-cover transition-transform duration-[400ms] ease-snap group-hover-fine:scale-[1.04]",
      }),
      React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/0" }),
      React.createElement("div", { className: "absolute top-3 left-3 flex gap-2" },
        React.createElement("span", { className: "text-[11px] font-semibold uppercase tracking-wide bg-white/95 text-[#1A1A1A] px-2.5 py-1 rounded-full" }, property.propertyType)
      ),
      React.createElement("div", { className: "absolute top-3 right-3" },
        React.createElement("span", { className: "text-[11px] font-semibold bg-[#97183C] text-white px-2.5 py-1 rounded-full" }, "\u2605 Superhost")
      ),
      React.createElement("div", { className: "absolute bottom-0 left-0 right-0 p-4" },
        locationLabel && React.createElement("p", { className: "flex items-center gap-1.5 text-white/85 text-xs font-medium mb-1" },
          React.createElement("svg", { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true },
            React.createElement("path", { d: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" }),
            React.createElement("circle", { cx: 12, cy: 9.5, r: 2.5 })
          ),
          locationLabel
        ),
        React.createElement("h3", { className: "font-semibold text-white text-lg leading-tight drop-shadow-sm" }, property.name),
        property.amenities.length > 0 && React.createElement("p", { className: "text-white/80 text-xs mt-1.5" }, property.amenities.slice(0, 3).join(" \u00B7 "))
      )
    ),
    React.createElement("div", { className: "mt-auto px-4 py-3.5 flex items-center justify-between gap-3" },
      React.createElement("span", { className: "text-xs text-[#8A8A8A]" }, "Book direct \u00B7 No OTA fees"),
      React.createElement("span", { className: "inline-flex items-center gap-1 text-sm font-semibold text-[#97183C]" },
        "View stay & book",
        React.createElement("span", { "aria-hidden": true, className: "transition-transform duration-200 group-hover-fine:translate-x-0.5" }, "\u2192")
      )
    )
  );
}

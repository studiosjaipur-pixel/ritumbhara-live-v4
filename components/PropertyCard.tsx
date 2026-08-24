import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Property } from "@/config/properties.config";

export default function PropertyCard({ property }: { property: Property }) {
  return React.createElement(Link, {
    href: "/properties/" + property.slug,
    className: "property-card city-" + property.destinationSlug + " group block rounded-lg overflow-hidden bg-white shadow-sm hover-fine:-translate-y-1 active:scale-[0.98] active:translate-y-0 active:duration-100 active:ease-out transition-transform duration-300 ease-snap",
  },
    React.createElement("div", { className: "relative aspect-[4/5] w-full overflow-hidden bg-[#EDE7DD]" },
      React.createElement(Image, {
        src: property.heroImage,
        alt: property.name,
        fill: true,
        sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
        className: "object-cover transition-transform duration-[250ms] ease-snap group-hover-fine:scale-105",
      }),
      React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" }),
      React.createElement("div", { className: "absolute top-3 left-3 flex gap-2" },
        React.createElement("span", { className: "text-[11px] font-semibold uppercase tracking-wide bg-white/95 text-[#1A1A1A] px-2.5 py-1 rounded-full" }, property.propertyType)
      ),
      React.createElement("div", { className: "absolute top-3 right-3" },
        React.createElement("span", { className: "text-[11px] font-semibold bg-[#97183C] text-white px-2.5 py-1 rounded-full" }, "\u2605 Superhost")
      ),
      React.createElement("div", { className: "absolute bottom-0 left-0 right-0 p-4" },
        React.createElement("h3", { className: "font-semibold text-white text-lg leading-tight drop-shadow-sm" }, property.name),
        property.amenities.length > 0 && React.createElement("p", { className: "text-white/85 text-xs mt-1" }, property.amenities.slice(0, 3).join(" \u00B7 "))
      )
    ),
    React.createElement("div", { className: "px-4 py-3 flex items-center justify-between" },
      React.createElement("span", { className: "text-xs text-[#8A8A8A]" }, "Book direct \u00B7 No OTA fees"),
      React.createElement("span", { className: "text-sm font-medium text-[#97183C] group-hover:translate-x-0.5 transition-transform" }, "View Stay \u2192")
    )
  );
}

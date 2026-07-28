import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Property } from "@/config/properties.config";

export default function PropertyCard({ property }: { property: Property }) {
return React.createElement("div", { className: "property-card city-" + property.destinationSlug + " border border-[#EDE7DD] rounded-md overflow-hidden bg-white" },
  React.createElement("div", { className: "relative h-44 w-full" },
  React.createElement(Image, { src: property.heroImage, alt: property.name, fill: true, sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw", className: "object-cover" })
  ),
  React.createElement("div", { className: "p-4" },
  React.createElement("p", { className: "text-xs uppercase tracking-wide text-[#C8A96A] font-semibold mb-1" }, property.propertyType),
  React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-3" }, property.name),
  React.createElement("div", { className: "flex flex-wrap gap-2 mb-3" },
  property.amenities.slice(0, 3).map(function (a) {
  return React.createElement("span", { key: a, className: "text-xs bg-[#F5F1EA] px-2 py-1 rounded" }, a);
  })
  ),
  React.createElement(Link, { href: "/properties/" + property.slug, className: "text-sm font-medium text-[#97183C] hover:text-[#7E1433]" }, "View Property \u2192")
    )
    );
                                                                                                                         }
  

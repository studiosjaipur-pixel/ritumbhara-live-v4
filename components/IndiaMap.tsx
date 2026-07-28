"use client";

import React, { useState } from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";

// Marker positions are approximate percentage placements derived from each
// destination's real latitude and longitude, projected onto a simplified,
// stylized panel. This is a lightweight illustrative locator, not a precise
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
            "relative w-full aspect-[4/5] max-w-md mx-auto rounded-xl border border-neutral-200 overflow-hidden bg-gradient-to-br from-[#FBF9F6] via-[#F5F1EA] to-[#EDE2D0]",
    },
    React.createElement("div", {
        className: "absolute inset-0",
        style: { backgroundImage: "radial-gradient(#D8CBAE 1px, transparent 1px)", backgroundSize: "16px 16px", opacity: 0.6 },
    }),
    React.createElement(
        "div",
        { className: "absolute top-5 left-5 right-5 flex items-center justify-between" },
        React.createElement("p", { className: "text-xs uppercase tracking-wide text-neutral-500 font-semibold" }, "Our Destinations"),
        React.createElement("span", { className: "text-[10px] uppercase tracking-wide text-neutral-400" }, "Rajasthan & UP")
        ),
    markerPositions.map(function (marker) {
        const destination = destinations.find(function (d) { return d.slug === marker.slug; });
        if (!destination) return null;
        const isHovered = hoveredSlug === marker.slug;
        const isOperational = destination.status === "operational";
        return React.createElement(
            "div",
            {
                key: marker.slug,
                className: "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center",
                style: { left: marker.leftPercent + "%", top: marker.topPercent + "%" },
                onMouseEnter: function () { setHoveredSlug(marker.slug); },
                onMouseLeave: function () { setHoveredSlug(null); },
            },
            React.createElement(
                Link,
                { href: "/destinations/" + destination.slug, className: "relative flex items-center justify-center" },
                isOperational && React.createElement("span", { className: "absolute inline-flex h-5 w-5 rounded-full bg-[#97183C]/40 animate-ping" }),
                React.createElement("span", {
                    className:
                        "relative block w-4 h-4 rounded-full border-2 border-white shadow-md " +
                        (isOperational ? "bg-[#97183C]" : "bg-neutral-400"),
                })
                ),
            React.createElement(
                "span",
                { className: "mt-1.5 text-[11px] font-medium text-neutral-700 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded whitespace-nowrap" },
                destination.name
                ),
            isHovered &&
            React.createElement(
                "div",
                {
                    className:
                        "absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap bg-white border border-neutral-200 rounded-md px-3 py-1 text-xs font-medium text-neutral-800 shadow-md z-10",
                },
                destination.name + (destination.status === "coming-soon" ? " \u2014 Coming Soon" : " \u2014 Operational")
                )
            );
    }),
    React.createElement(
        "div",
        { className: "absolute bottom-5 left-5 flex items-center gap-4 text-[11px] text-neutral-500" },
        React.createElement(
            "span",
            { className: "flex items-center gap-1.5" },
            React.createElement("span", { className: "w-2 h-2 rounded-full bg-[#97183C] inline-block" }),
            "Operational"
            ),
        React.createElement(
            "span",
            { className: "flex items-center gap-1.5" },
            React.createElement("span", { className: "w-2 h-2 rounded-full bg-neutral-400 inline-block" }),
            "Coming soon"
            )
        )
    );
}

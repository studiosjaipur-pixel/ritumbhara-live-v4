import React from "react";

export const metadata = {
    title: "Our Story",
    description: "Ritumbhara is a hospitality management company built to bring one consistent standard to hotels, studios, villas and serviced apartments across India.",
    alternates: { canonical: "/about" },
};

const sections = [
  { heading: "Our Story", body: "Ritumbhara began with a simple observation about Indian hospitality: guests wanted consistency more than spectacle. A traveler booking a stay in Jaipur or Alwar deserved the same standard of housekeeping, service, and care regardless of which building they walked into." },
  { heading: "Vision", body: "To become India's most trusted hospitality management company, present in over a hundred cities, without ever compromising the standard a guest can expect from a single Ritumbhara-managed stay." },
  { heading: "Mission", body: "We manage hotels, studios, villas, and serviced apartments to one operating standard, so that owners gain professional management and guests gain certainty." },
  { heading: "The Ritumbhara Standard", body: "Ten commitments, guest experience, cleanliness, hospitality, interior design, technology, housekeeping, service, local experiences, safety, and communication, apply identically whether a property is a compact studio in Jaipur or a villa in Sariska." },
  { heading: "FOCO Model & Future Expansion", body: "Ritumbhara partners with property owners under a Franchise-Owned, Company-Operated model: owners retain the asset, Ritumbhara brings systems, staffing standards, technology, and brand." },
  ];

export default function AboutPage() {
    return React.createElement("main", { className: "max-w-4xl mx-auto px-6 lg:px-10 pt-32 pb-24" },
                                   React.createElement("h1", { className: "text-4xl lg:text-5xl font-semibold text-[#1A1A1A] mb-16" }, "Our Story"),
                                   sections.map(function (s) {
                                           return React.createElement("section", { key: s.heading, className: "mb-14" },
                                                                              React.createElement("h2", { className: "text-2xl font-semibold text-[#1A1A1A] mb-4" }, s.heading),
                                                                              React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed" }, s.body)
                                                                            );
                                   })
                                 );
}

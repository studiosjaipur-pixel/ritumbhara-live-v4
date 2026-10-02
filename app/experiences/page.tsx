import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { experiences } from "@/config/experiences.config";
import ExperienceCard from "@/components/ExperienceCard";
import { socialMetadata } from "@/lib/seo";
import { bookingEngine } from "@/config/booking.config";

const experiencesTitle = "Experiences: Heritage Walks, Food & Wildlife";
const experiencesDescription = "Discover the experiences that define a stay with Ritumbhara \u2014 from heritage walks to slow mornings and wildlife encounters.";

export const metadata: Metadata = {
      title: experiencesTitle,
      description: experiencesDescription,
      alternates: { canonical: "/experiences" },
      ...socialMetadata("/experiences", experiencesTitle + " | Ritumbhara", experiencesDescription),
};

export default function ExperiencesPage() {
      return React.createElement(
              "main",
          { className: "pt-32 lg:pt-36 pb-24 px-6 lg:px-10 max-w-7xl mx-auto" },
              React.createElement(
                        "h1",
                  { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-4" },
                        "Experiences"
                      ),
              React.createElement(
                        "p",
                  { className: "text-charcoal-soft max-w-2xl mb-10 pb-6 border-b border-line leading-relaxed" },
                        "A stay with Ritumbhara is shaped as much by what surrounds it as by the space itself. These are the moments we design around."
                      ),
              // Section heading grouping the experience entries (UX-006): H1 > H2 > H3.
              React.createElement("h2", { id: "experiences-list-heading", className: "font-sans text-sm font-semibold text-sage mb-6" }, "The moments we design around"),
              React.createElement(
                        "ol",
                  { "aria-labelledby": "experiences-list-heading", className: "grid sm:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-10 lg:gap-y-14" },
                        experiences.map((exp, i) =>
                                    React.createElement(ExperienceCard, { key: exp.id, experience: exp, index: i })
                                              )
                      ),
              React.createElement(
                        "div",
                  { className: "bg-sand/70 rounded-sm mt-12 lg:mt-14 px-6 py-6 sm:px-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between" },
                        React.createElement("p", { className: "font-display text-[1.75rem] leading-tight text-charcoal" }, "Find a stay close to these experiences."),
                        React.createElement(
                                    "div",
                                    { className: "flex flex-wrap items-center gap-x-6 gap-y-2" },
                                    React.createElement(Link, { href: "/destinations", className: "inline-flex items-center justify-center min-h-[48px] px-6 bg-burgundy text-ivory font-semibold rounded-sm hover-fine:bg-burgundy-deep transition-colors" }, "Explore destination stays"),
                                    React.createElement(Link, { href: "/journal", className: "inline-flex items-center min-h-[48px] font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors" }, "Read travel guides")
                                  )
                      ),
              // Booking information (UX-007): verified Hotel-Spider booking engine terms and a direct contact route.
              // No guest reviews are shown: their source is not recorded in the project.
              React.createElement(
                        "section",
                  { "aria-labelledby": "experiences-booking-heading", className: "mt-12 lg:mt-14 border-t border-line pt-8 grid lg:grid-cols-[0.8fr_1.2fr] gap-6 lg:gap-16" },
                        React.createElement(
                                    "div",
                                    null,
                                    React.createElement("h2", { id: "experiences-booking-heading", className: "text-[1.75rem] leading-tight text-charcoal mb-2" }, "Booking information"),
                                    React.createElement("p", { className: "text-sm text-charcoal-soft leading-relaxed max-w-sm" }, "Terms on our online booking engine for rooms booked there. For stays arranged on WhatsApp, we confirm the terms with you before you book.")
                                  ),
                        React.createElement(
                                    "div",
                                    null,
                                    React.createElement(
                                                "dl",
                                                { className: "grid sm:grid-cols-2 gap-x-8 border-t border-line" },
                                                [
                                                  { label: "Check-in", value: bookingEngine.checkIn },
                                                  { label: "Check-out", value: "By " + bookingEngine.checkOut },
                                                  { label: "Cancellation", value: bookingEngine.cancellation, wide: true },
                                                ].map(function (t) {
                                                  return React.createElement("div", { key: t.label, className: "py-3 border-b border-line" + (t.wide ? " sm:col-span-2" : "") },
                                                    React.createElement("dt", { className: "text-xs font-semibold text-sage mb-0.5" }, t.label),
                                                    React.createElement("dd", { className: "text-[15px] text-charcoal" }, t.value)
                                                  );
                                                })
                                              ),
                                    React.createElement(
                                                "div",
                                                { className: "flex flex-wrap gap-x-6 gap-y-1 mt-3" },
                                                React.createElement(Link, { href: "/#policies", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Booking policies"),
                                                React.createElement(Link, { href: "/contact", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Contact us")
                                              )
                                  )
                      )
            );
}

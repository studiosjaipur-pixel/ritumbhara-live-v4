import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { experiences } from "@/config/experiences.config";
import ExperienceCard from "@/components/ExperienceCard";
import { socialMetadata } from "@/lib/seo";

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
                  { className: "text-charcoal-soft max-w-2xl mb-12 pb-6 border-b border-line leading-relaxed" },
                        "A stay with Ritumbhara is shaped as much by what surrounds it as by the space itself. These are the moments we design around."
                      ),
              React.createElement(
                        "ol",
                  { className: "grid sm:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-10 lg:gap-y-14" },
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
                      )
            );
}

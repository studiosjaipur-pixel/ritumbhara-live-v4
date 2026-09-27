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
                  { className: "text-4xl lg:text-5xl font-semibold text-neutral-900 mb-4" },
                        "Experiences"
                      ),
              React.createElement(
                        "p",
                  { className: "text-neutral-600 max-w-2xl mb-12 pb-6 border-b border-[#EDE7DD] leading-relaxed" },
                        "A stay with Ritumbhara is shaped as much by what surrounds it as by the space itself. These are the moments we design around."
                      ),
              React.createElement(
                        "div",
                  { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-6" },
                        experiences.map((exp) =>
                                    React.createElement(ExperienceCard, { key: exp.id, experience: exp })
                                              )
                      ),
              React.createElement(
                        "div",
                  { className: "rb-jaali rounded-md mt-10 lg:mt-12 px-6 py-6 sm:px-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between" },
                        React.createElement("p", { className: "text-white text-lg font-semibold" }, "Find a stay close to these experiences."),
                        React.createElement(
                                    "div",
                                    { className: "flex flex-wrap gap-3" },
                                    React.createElement(Link, { href: "/destinations", className: "inline-flex items-center justify-center min-h-[48px] px-6 bg-white text-[#97183C] font-semibold rounded-md hover-fine:bg-[#F5F1EA] transition-colors" }, "Explore destination stays"),
                                    React.createElement(Link, { href: "/journal", className: "inline-flex items-center justify-center min-h-[48px] px-6 border border-white/70 text-white font-semibold rounded-md hover-fine:bg-white hover-fine:text-[#97183C] transition-colors" }, "Read travel guides")
                                  )
                      )
            );
}

import React from "react";
import { Metadata } from "next";
import { experiences } from "@/config/experiences.config";
import ExperienceCard from "@/components/ExperienceCard";

export const metadata: Metadata = {
      title: "Experiences",
      description: "Discover the experiences that define a stay with Ritumbhara -- from heritage walks to slow mornings and wildlife encounters.",
      alternates: { canonical: "/experiences" },
};

export default function ExperiencesPage() {
      return React.createElement(
              "main",
          { className: "pt-32 pb-24 px-6 md:px-16 max-w-6xl mx-auto" },
              React.createElement(
                        "h1",
                  { className: "text-4xl md:text-5xl font-semibold text-neutral-900 mb-6" },
                        "Experiences"
                      ),
              React.createElement(
                        "p",
                  { className: "text-neutral-600 max-w-2xl mb-16 text-lg" },
                        "A stay with Ritumbhara is shaped as much by what surrounds it as by the space itself. These are the moments we design around."
                      ),
              React.createElement(
                        "div",
                  { className: "grid grid-cols-1 md:grid-cols-2 gap-8" },
                        experiences.map((exp) =>
                                    React.createElement(ExperienceCard, { key: exp.id, experience: exp })
                                              )
                      )
            );
}

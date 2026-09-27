import React from "react";
import { Experience } from "@/config/experiences.config";

// The configured experience image files do not exist in /public, so no photo is shown.
// The jaali panel is a decorative brand fallback, not a stand-in photograph (Week 3: UX-006).
export default function ExperienceCard({ experience }: { experience: Experience }) {
  return React.createElement(
        "div",
    { className: "group overflow-hidden rounded-md bg-white border border-[#EDE7DD] hover-fine:-translate-y-1 hover-fine:shadow-[0_14px_32px_rgba(26,26,26,0.07)] transition-[transform,box-shadow] duration-300 ease-snap" },
        React.createElement("div", { className: "rb-jaali relative w-full h-24", "aria-hidden": true },
          React.createElement("div", { className: "absolute inset-x-0 bottom-0 h-1 bg-[#C8A96A]" })
        ),
        React.createElement(
          "div",
    { className: "p-5" },
          React.createElement(
            "h3",
    { className: "text-lg font-semibold text-[#1A1A1A] mb-2" },
            experience.title
          ),
          React.createElement(
            "p",
    { className: "text-[#4A4A4A] text-sm leading-relaxed" },
            experience.description
          )
        )
      );
}

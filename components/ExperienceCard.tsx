import React from "react";
import { Experience } from "@/config/experiences.config";

export default function ExperienceCard({ experience }: { experience: Experience }) {
  return React.createElement(
        "div",
    { className: "overflow-hidden rounded-lg bg-white border border-neutral-200" },
        React.createElement("div", { className: "relative w-full h-64 bg-neutral-100" }),
        React.createElement(
          "div",
    { className: "p-6" },
          React.createElement(
            "h3",
    { className: "text-xl font-semibold text-neutral-900 mb-2" },
            experience.title
          ),
          React.createElement(
            "p",
    { className: "text-neutral-600 text-sm leading-relaxed" },
            experience.description
          )
        )
      );
}

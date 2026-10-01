import React from "react";
import { Experience } from "@/config/experiences.config";

// Editorial entry for the /experiences list: index number, title, description.
// No imagery is shown because the configured experience image files do not exist in /public.
// Rendered as an <li>; the parent <ol> conveys the order, so the visible number is aria-hidden.
export default function ExperienceCard({ experience, index }: { experience: Experience; index: number }) {
  const label = (index + 1 < 10 ? "0" : "") + (index + 1);
  return React.createElement(
        "li",
    { className: "sm:grid sm:grid-cols-[2.75rem_1fr]" },
        React.createElement("span", { "aria-hidden": true, className: "block mb-1.5 sm:mb-0 sm:pt-[0.55rem] font-sans text-[13px] font-semibold tracking-[0.08em] text-burgundy tabular-nums" }, label),
        React.createElement(
          "div",
    null,
          React.createElement(
            "h3",
    { className: "font-display text-[1.6rem] leading-tight text-charcoal mb-2" },
            experience.title
          ),
          React.createElement(
            "p",
    { className: "text-charcoal-soft text-[15px] leading-relaxed max-w-[34rem]" },
            experience.description
          )
        )
      );
}

import React from "react";
import { testimonials } from "@/config/testimonials.config";

export default function Testimonials() {
    return React.createElement(
          "section",
      { className: "bg-stone-50 py-24 px-6 md:px-16" },
          React.createElement(
            "div",
      { className: "max-w-6xl mx-auto" },
            React.createElement(
              "h2",
      { className: "text-3xl md:text-4xl font-semibold text-neutral-900 mb-12 text-center" },
              "What Our Guests Say"
            ),
            React.createElement(
              "div",
      { className: "grid grid-cols-1 md:grid-cols-3 gap-8" },
              testimonials.map((t) =>
                React.createElement(
                  "figure",
      {
                    key: t.id,
                    className: "bg-white border border-neutral-200 rounded-lg p-8 flex flex-col justify-between",
      },
                  React.createElement(
                    "blockquote",
      { className: "text-neutral-700 text-base leading-relaxed mb-6" },
                    t.quote
                  ),
                  React.createElement(
                    "figcaption",
      { className: "text-sm text-neutral-500 font-medium" },
                    t.guestLabel + " " + String.fromCharCode(8212) + " " + t.location
                  )
                )
              )
            )
          )
        );
}

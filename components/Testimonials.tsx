import React from "react";
import { testimonials } from "@/config/testimonials.config";

export default function Testimonials() {
    return React.createElement(
          "section",
      { className: "bg-sand/60 py-16 lg:py-24" },
          React.createElement(
            "div",
      { className: "max-w-7xl mx-auto px-6 lg:px-10" },
            React.createElement(
              "h2",
      { className: "text-4xl lg:text-5xl text-charcoal mb-10 lg:mb-12" },
              "What Our Guests Say"
            ),
            React.createElement(
              "div",
      { className: "grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12" },
              testimonials.map((t) =>
                React.createElement(
                  "figure",
      {
                    key: t.id,
                    className: "border-t border-charcoal/20 pt-6 flex flex-col",
      },
                  React.createElement(
                    "blockquote",
      { className: "font-display text-[1.6rem] leading-snug text-charcoal mb-5 flex-1" },
                    "“" + t.quote + "”"
                  ),
                  React.createElement(
                    "figcaption",
      { className: "text-sm text-charcoal-soft font-medium" },
                    t.guestLabel + " " + String.fromCharCode(8212) + " " + t.location
                  )
                )
              )
            )
          )
        );
}

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
      { className: "flex md:grid md:grid-cols-3 gap-6 lg:gap-12 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none -mx-6 px-6 md:mx-0 md:px-0 pb-4 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" },
              testimonials.map((t) =>
                React.createElement(
                  "figure",
      {
                    key: t.id,
                    className: "border-t border-charcoal/20 pt-6 flex flex-col shrink-0 basis-[82%] sm:basis-[60%] md:basis-auto snap-center",
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

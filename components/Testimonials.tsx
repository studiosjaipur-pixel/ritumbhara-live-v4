import React from "react";
import { testimonials } from "@/config/testimonials.config";

export default function Testimonials() {
    return React.createElement(
          "section",
      { className: "bg-[#F5F1EA] py-20 lg:py-28 px-6 md:px-16" },
          React.createElement(
            "div",
      { className: "max-w-6xl mx-auto" },
            React.createElement(
              "h2",
      { className: "text-3xl md:text-4xl font-semibold text-[#1A1A1A] mb-12 text-center" },
              "What Our Guests Say"
            ),
            React.createElement(
              "div",
      { className: "grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8" },
              testimonials.map((t) =>
                React.createElement(
                  "figure",
      {
                    key: t.id,
                    className: "bg-white border border-[#EDE7DD] rounded-md p-7 lg:p-8 flex flex-col justify-between",
      },
                  React.createElement("span", { "aria-hidden": true, className: "block text-5xl leading-none text-[#C8A96A] font-semibold mb-2 select-none" }, "\u201C"),
                  React.createElement(
                    "blockquote",
      { className: "text-[#1A1A1A] text-[17px] leading-relaxed mb-6 flex-1" },
                    t.quote
                  ),
                  React.createElement(
                    "figcaption",
      { className: "text-sm text-[#97183C] font-semibold pt-4 border-t border-[#EDE7DD]" },
                    t.guestLabel + " " + String.fromCharCode(8212) + " " + t.location
                  )
                )
              )
            )
          )
        );
}

import React from "react";
import type { Faq } from "@/lib/schema";

// Visible FAQ block. Pair it with faqSchema() using the same array so markup and page text always match.
export default function FaqSection({ heading, faqs }: { heading: string; faqs: Faq[] }) {
  return React.createElement("section", { className: "mt-12 lg:mt-16" },
    React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal mb-6" }, heading),
    React.createElement("div", { className: "grid md:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-8" },
      faqs.map(function (f) {
        return React.createElement("div", { key: f.question },
          React.createElement("h3", { className: "text-[1.25rem] leading-snug text-charcoal mb-2" }, f.question),
          React.createElement("p", { className: "text-[15px] text-charcoal-soft leading-relaxed" }, f.answer)
        );
      })
    )
  );
}

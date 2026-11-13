import React from "react";
import type { Faq } from "@/lib/schema";
import FaqAccordion from "@/components/FaqAccordion";

// Visible FAQ block, as a collapsible list. Pair it with faqSchema() using the same array so markup and page text always match.
export default function FaqSection({ heading, faqs }: { heading: string; faqs: Faq[] }) {
  return React.createElement("section", { className: "mt-12 lg:mt-16" },
    React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal mb-6" }, heading),
    React.createElement("div", { className: "max-w-3xl" },
      React.createElement(FaqAccordion, { items: faqs })
    )
  );
}

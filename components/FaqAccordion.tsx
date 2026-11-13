import React from "react";

// Collapsible FAQ list built on native <details>, so it works without JavaScript and every answer stays in
// the page for search engines. Pair it with faqSchema() using the same items.
export default function FaqAccordion({ items, defaultOpenFirst }: { items: { question: string; answer: string }[]; defaultOpenFirst?: boolean }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map(function (item, i) {
        return (
          <details key={item.question} className="group" open={defaultOpenFirst && i === 0 ? true : undefined}>
            <summary className="flex items-center justify-between gap-4 min-h-[56px] py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold text-[16px] lg:text-[17px] text-charcoal hover-fine:text-burgundy transition-colors">
              <h3 className="font-semibold text-inherit text-[inherit] leading-snug">{item.question}</h3>
              <span aria-hidden="true" className="shrink-0 text-2xl leading-none text-burgundy transition-transform duration-200 ease-snap group-open:rotate-45">+</span>
            </summary>
            <p className="pb-5 pr-8 text-charcoal-soft leading-relaxed">{item.answer}</p>
          </details>
        );
      })}
    </div>
  );
}

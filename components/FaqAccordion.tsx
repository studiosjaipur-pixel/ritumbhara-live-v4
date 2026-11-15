import React from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@ui-sdk/react/accordion";

// FAQ list on ui-sdk's Accordion. Closed answers stay in the page HTML (hiddenUntilFound), so search engines,
// AI crawlers and the browser's Find command can all read them. Pair it with faqSchema() using the same items.
export default function FaqAccordion({ items, defaultOpenFirst }: { items: { question: string; answer: string }[]; defaultOpenFirst?: boolean }) {
  return (
    <Accordion
      multiple
      keepMounted
      hiddenUntilFound
      defaultValue={defaultOpenFirst && items[0] ? [items[0].question] : []}
      className="rb-acc max-w-none border-t-0 divide-y divide-line border-y border-line"
    >
      {items.map(function (item) {
        return (
          <AccordionItem key={item.question} value={item.question} className="border-b-0">
            <AccordionHeader className="text-inherit">
              <AccordionTrigger className="group min-h-[56px] gap-4 py-3 text-left font-semibold text-[16px] lg:text-[17px] leading-snug text-charcoal hover-fine:text-burgundy transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy">
                <span>{item.question}</span>
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  className="shrink-0 text-burgundy transition-transform duration-300 ease-snap group-data-[open]:rotate-45"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionPanel className="pb-0 text-charcoal-soft">
              <p className="pb-5 pr-8 leading-relaxed">{item.answer}</p>
            </AccordionPanel>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

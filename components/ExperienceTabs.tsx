"use client";
import Link from "next/link";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import OpenAvailabilityButton from "@/components/OpenAvailabilityButton";

export interface ExperienceArea {
  slug: string;
  name: string;
  intro: string;
  items: string[];
  guides: { href: string; label: string }[];
}

// Experiences near each destination as tabs (arrow keys move between them). Every tab ends in a way to book:
// a stay in that destination, with the destination already chosen in the availability dialog. All panels stay
// in the page HTML (keepMounted), so every destination's experiences are readable by search and AI crawlers.
export default function ExperienceTabs({ areas }: { areas: ExperienceArea[] }) {
  return (
    <Tabs defaultValue={areas[0].slug}>
      <TabsList aria-label="Destinations" className="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1 border-b-0">
        {areas.map(function (a) {
          return (
            <TabsTab
              key={a.slug}
              value={a.slug}
              className="shrink-0 h-auto min-h-[48px] mb-0 px-6 rounded-full border border-line bg-ivory text-base font-semibold text-charcoal hover-fine:border-burgundy hover-fine:text-burgundy active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-200 ease-snap data-[selected]:bg-burgundy data-[selected]:border-burgundy data-[selected]:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
            >
              {a.name}
            </TabsTab>
          );
        })}
      </TabsList>

      {areas.map(function (area) {
        return (
          <TabsPanel key={area.slug} value={area.slug} keepMounted className="rb-tab-panel grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-14 pt-0">
            <div>
              <h3 className="text-[1.75rem] leading-tight text-charcoal mb-2">
                <Link href={"/destinations/" + area.slug} className="hover-fine:text-burgundy transition-colors">{area.name}</Link>
              </h3>
              <p className="text-[15px] text-charcoal-soft leading-relaxed mb-5">{area.intro}</p>
              <div className="flex flex-col items-start gap-1">
                <OpenAvailabilityButton
                  destination={area.slug}
                  className="inline-flex items-center justify-center min-h-[48px] px-6 bg-burgundy text-ivory font-semibold rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] transition-[background-color,transform] duration-200 ease-snap"
                >
                  {"Find a stay in " + area.name}
                </OpenAvailabilityButton>
                {area.guides.map(function (g) {
                  return (
                    <Link key={g.href} href={g.href} className="inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy transition-colors">
                      {g.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <ul className="grid sm:grid-cols-2 gap-x-8 border-t border-line self-start">
              {area.items.map(function (item) {
                return (
                  <li key={item} className="flex gap-3 border-b border-line py-3.5 text-[15px] text-charcoal-soft leading-relaxed">
                    <span aria-hidden="true" className="mt-[0.6em] w-1.5 h-1.5 shrink-0 rounded-full bg-sage" />
                    {item}
                  </li>
                );
              })}
            </ul>
          </TabsPanel>
        );
      })}
    </Tabs>
  );
}

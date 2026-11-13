"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import OpenAvailabilityButton from "@/components/OpenAvailabilityButton";

export interface ExperienceArea {
  slug: string;
  name: string;
  intro: string;
  items: string[];
  guides: { href: string; label: string }[];
}

// Experiences near each destination as tabs (arrow keys move between them). Every tab ends in a way to book:
// a stay in that destination, with the destination already chosen in the availability dialog.
export default function ExperienceTabs({ areas }: { areas: ExperienceArea[] }) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % areas.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + areas.length) % areas.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = areas.length - 1;
    else return;
    e.preventDefault();
    setActive(next);
    const el = tabRefs.current[next];
    if (el) el.focus();
  }

  const area = areas[active];

  return (
    <div>
      <div role="tablist" aria-label="Destinations" className="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1">
        {areas.map(function (a, i) {
          const selected = i === active;
          return (
            <button
              key={a.slug}
              ref={function (el) { tabRefs.current[i] = el; }}
              role="tab"
              type="button"
              id={"exp-tab-" + a.slug}
              aria-selected={selected}
              aria-controls={"exp-panel-" + a.slug}
              tabIndex={selected ? 0 : -1}
              onClick={function () { setActive(i); }}
              onKeyDown={function (e) { onKey(e, i); }}
              className={
                "shrink-0 min-h-[48px] px-6 rounded-full border text-base font-semibold active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-200 ease-snap " +
                (selected ? "bg-burgundy border-burgundy text-ivory" : "bg-ivory border-line text-charcoal hover-fine:border-burgundy hover-fine:text-burgundy")
              }
            >
              {a.name}
            </button>
          );
        })}
      </div>

      <div
        key={area.slug}
        role="tabpanel"
        id={"exp-panel-" + area.slug}
        aria-labelledby={"exp-tab-" + area.slug}
        className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-14 rb-fade"
      >
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
      </div>
    </div>
  );
}

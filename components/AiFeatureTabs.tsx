"use client";
import { useState } from "react";

type Tab = { id: string; label: string; headline: string; points: string[] };

export default function AiFeatureTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) || tabs[0];
  return (
    <div>
      <div role="tablist" aria-label="Ritumbhara AI features" className="flex flex-wrap gap-2 mb-8">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={t.id === active}
            onClick={() => setActive(t.id)}
            className={"min-h-[44px] px-5 rounded-full text-sm font-semibold transition-colors duration-200 " + (t.id === active ? "bg-burgundy text-ivory" : "bg-sand text-charcoal hover-fine:bg-sand-deep")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="bg-sand/70 rounded-2xl p-6 sm:p-10">
        <h3 className="font-display text-[1.9rem] leading-tight text-charcoal mb-5">{current.headline}</h3>
        <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-3">
          {current.points.map((p) => (
            <li key={p} className="flex gap-3 text-[15px] text-charcoal-soft leading-relaxed">
              <span aria-hidden className="text-burgundy mt-0.5">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

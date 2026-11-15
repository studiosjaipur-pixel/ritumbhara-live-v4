"use client";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";

type Tab = { id: string; label: string; headline: string; points: string[] };

// Every panel stays in the page (keepMounted), so the full feature list is in the HTML for search and AI
// crawlers, not only the tab that happens to be open.
export default function AiFeatureTabs({ tabs }: { tabs: Tab[] }) {
  return (
    <Tabs defaultValue={tabs[0].id}>
      <TabsList aria-label="Ritumbhara AI features" className="flex flex-wrap gap-2 mb-8 border-b-0">
        {tabs.map((t) => (
          <TabsTab
            key={t.id}
            value={t.id}
            className="h-auto min-h-[44px] px-5 mb-0 rounded-full border-0 text-sm font-semibold bg-sand text-charcoal hover-fine:bg-sand-deep transition-colors duration-200 data-[selected]:bg-burgundy data-[selected]:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
          >
            {t.label}
          </TabsTab>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsPanel key={t.id} value={t.id} keepMounted className="rb-tab-panel bg-sand/70 rounded-2xl p-6 sm:p-10">
          <h3 className="font-display text-[1.9rem] leading-tight text-charcoal mb-5">{t.headline}</h3>
          <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-3">
            {t.points.map((p) => (
              <li key={p} className="flex gap-3 text-[15px] text-charcoal-soft leading-relaxed">
                <span aria-hidden className="text-burgundy mt-0.5">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </TabsPanel>
      ))}
    </Tabs>
  );
}

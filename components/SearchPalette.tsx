"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useModal } from "@/lib/useModal";

export interface SearchItem {
  href: string;
  title: string;
  hint: string;
  group: "Stays" | "Destinations" | "Pages" | "Guides";
  keywords?: string;
}

export const OPEN_SEARCH_EVENT = "rb:open-search";

export function openSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

// Header search button. The shortcut hint only shows on wide screens.
export function SearchButton({ onDark }: { onDark?: boolean }) {
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-haspopup="dialog"
      aria-label="Search stays, places and guides"
      className={"w-11 h-11 flex items-center justify-center rounded-full active:scale-90 transition-[color,background-color,transform] duration-150 " + (onDark ? "text-ivory hover-fine:bg-ivory/10" : "text-charcoal hover-fine:bg-sand")}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    </button>
  );
}

const GROUP_ORDER: SearchItem["group"][] = ["Stays", "Destinations", "Pages", "Guides"];

function score(item: SearchItem, tokens: string[]): number {
  const hay = (item.title + " " + item.hint + " " + (item.keywords || "")).toLowerCase();
  const title = item.title.toLowerCase();
  let total = 0;
  for (const t of tokens) {
    if (hay.indexOf(t) === -1) return 0;
    total += title.indexOf(t) === 0 ? 3 : title.indexOf(t) !== -1 ? 2 : 1;
  }
  return total;
}

// Quick search: press "/" or Ctrl/Cmd+K anywhere, type a stay, place or guide, Enter to go.
export default function SearchPalette({ items }: { items: SearchItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const close = useCallback(function () { setOpen(false); }, []);
  useModal(open, close, ref);

  useEffect(function () {
    function show() { setQuery(""); setActive(0); setOpen(true); }
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); show(); return; }
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); show(); }
    }
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    document.addEventListener("keydown", onKey);
    return function () {
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(function () { setOpen(false); }, [pathname]);

  const results = useMemo(function () {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items.filter(function (i) { return i.group === "Stays" || i.group === "Destinations"; }).slice(0, 8);
    return items
      .map(function (i) { return { i: i, s: score(i, tokens) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return GROUP_ORDER.indexOf(a.i.group) - GROUP_ORDER.indexOf(b.i.group) || b.s - a.s; })
      .slice(0, 8)
      .map(function (r) { return r.i; });
  }, [items, query]);

  useEffect(function () { setActive(0); }, [query]);
  useEffect(function () {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  function go(item: SearchItem | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(function (a) { return Math.min(a + 1, results.length - 1); }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(function (a) { return Math.max(a - 1, 0); }); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center sm:pt-[12vh]">
      <div className="absolute inset-0 bg-charcoal/55 backdrop-blur-[2px] rb-fade" onClick={close} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Search" className="relative w-full sm:max-w-xl max-h-[100svh] sm:max-h-[70vh] flex flex-col bg-ivory sm:rounded-sm border-t-2 border-burgundy shadow-[0_24px_60px_rgba(38,34,31,0.3)] rb-fade">
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="text-charcoal-muted shrink-0"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input
            data-autofocus
            type="text"
            inputMode="search"
            enterKeyHint="go"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="rb-search-list"
            aria-activedescendant={results[active] ? "rb-search-" + active : undefined}
            aria-label="Search stays, places and guides"
            placeholder="Search stays, places, guides"
            value={query}
            onChange={function (e) { setQuery(e.target.value); }}
            onKeyDown={onInputKey}
            className="flex-1 min-h-[56px] bg-transparent text-base text-charcoal placeholder:text-charcoal-muted outline-none"
          />
          <button type="button" onClick={close} className="min-h-[44px] px-2 text-sm text-charcoal-muted hover-fine:text-burgundy">Close</button>
        </div>
        <ul id="rb-search-list" ref={listRef} role="listbox" aria-label="Results" className="overflow-y-auto py-2 flex-1">
          {results.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-charcoal-soft">Nothing matches &ldquo;{query}&rdquo;. Try a place such as Jaipur, or a stay name.</li>
          ) : results.map(function (r, i) {
            const showGroup = i === 0 || results[i - 1].group !== r.group;
            return (
              <li key={r.href} role="presentation">
                {showGroup ? <p className="px-5 pt-3 pb-1 text-xs font-semibold text-sage">{r.group}</p> : null}
                <a
                  id={"rb-search-" + i}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  href={r.href}
                  onClick={function (e) { e.preventDefault(); go(r); }}
                  onMouseMove={function () { if (active !== i) setActive(i); }}
                  className={"flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5 sm:gap-4 px-5 min-h-[48px] py-2.5 " + (i === active ? "bg-sand" : "")}
                >
                  <span className="font-medium text-charcoal">{r.title}</span>
                  <span className="text-sm text-charcoal-muted truncate">{r.hint}</span>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="hidden sm:block px-5 py-2.5 border-t border-line text-xs text-charcoal-muted">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}

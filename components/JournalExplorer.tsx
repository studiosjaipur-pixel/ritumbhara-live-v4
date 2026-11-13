"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export interface JournalCard {
  slug: string;
  title: string;
  excerpt: string;
  heroImage: string;
  destinationTag: string;
  publishedAt: string;
  readingMinutes: number;
  relatedDestinationSlugs: string[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

// Journal index with a search box and destination filter. Posts arrive newest first.
export default function JournalExplorer({ posts, filters }: { posts: JournalCard[]; filters: { slug: string; name: string }[] }) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");

  const shown = useMemo(function () {
    const q = query.trim().toLowerCase();
    return posts.filter(function (p) {
      if (filter && p.relatedDestinationSlugs.indexOf(filter) === -1) return false;
      if (!q) return true;
      return (p.title + " " + p.excerpt + " " + p.destinationTag).toLowerCase().indexOf(q) !== -1;
    });
  }, [posts, filter, query]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-10">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by destination">
          {[{ slug: "", name: "All guides" }].concat(filters).map(function (f) {
            const active = filter === f.slug;
            return (
              <button
                key={f.slug || "all"}
                type="button"
                aria-pressed={active}
                onClick={function () { setFilter(f.slug); }}
                className={
                  "min-h-[44px] px-4 rounded-full border text-sm font-semibold active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-200 ease-snap " +
                  (active ? "bg-burgundy border-burgundy text-ivory" : "bg-ivory border-line text-charcoal hover-fine:border-burgundy hover-fine:text-burgundy")
                }
              >
                {f.name}
              </button>
            );
          })}
        </div>
        <div className="sm:ml-auto sm:w-72">
          <label htmlFor="journal-search" className="sr-only">Search the journal</label>
          <input
            id="journal-search"
            type="search"
            value={query}
            onChange={function (e) { setQuery(e.target.value); }}
            placeholder="Search guides"
            className="w-full min-h-[44px] border border-line rounded-sm px-3 py-2 text-sm text-charcoal bg-ivory hover-fine:border-charcoal-muted focus:border-burgundy transition-colors"
          />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{shown.length + (shown.length === 1 ? " guide" : " guides") + " shown"}</p>

      {shown.length === 0 ? (
        <div className="py-10 border-t border-line">
          <p className="font-display text-[1.6rem] text-charcoal mb-2">No guides match that.</p>
          <button type="button" onClick={function () { setFilter(""); setQuery(""); }} className="min-h-[44px] font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4">Show all guides</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {shown.map(function (post) {
            return (
              <Link key={post.slug} href={"/journal/" + post.slug} className="group flex flex-col">
                {post.heroImage ? (
                  <div className="relative w-full aspect-[3/2] overflow-hidden rounded-sm bg-sand">
                    <Image src={post.heroImage} alt={post.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" quality={70} className="object-cover transition-transform duration-700 ease-snap group-hover-fine:scale-[1.04]" />
                  </div>
                ) : (
                  <div className="w-full aspect-[3/2] rounded-sm rb-jaali-light" aria-hidden="true" />
                )}
                <div className="pt-4 flex flex-col flex-1">
                  <p className="text-xs font-medium text-sage mb-1.5">{post.destinationTag}</p>
                  <h2 className="text-[1.7rem] leading-tight text-charcoal mb-2 group-hover-fine:text-burgundy transition-colors">{post.title}</h2>
                  <p className="text-sm text-charcoal-soft leading-relaxed mb-5">{post.excerpt}</p>
                  <p className="mt-auto pt-2 pb-3 border-b border-line text-xs text-charcoal-muted">{formatDate(post.publishedAt) + " · " + post.readingMinutes + " min read"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

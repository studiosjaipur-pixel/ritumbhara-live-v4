import React from "react";
import { journalPosts } from "@/lib/journal-posts";
import { destinations } from "@/config/destinations.config";
import { socialMetadata } from "@/lib/seo";
import JournalExplorer from "@/components/JournalExplorer";

const journalTitle = "Journal: Jaipur, Alwar & Sariska Travel Guides";
const journalDescription = "Travel guides for Jaipur, Alwar, and Sariska \u2014 from Ritumbhara.";

export const metadata = {
  title: journalTitle,
  description: journalDescription,
  alternates: { canonical: "/journal" },
  ...socialMetadata("/journal", journalTitle + " | Ritumbhara", journalDescription),
};

export default function JournalIndexPage() {
  const posts = [...journalPosts]
    .sort(function (a, b) { return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(); })
    .map(function (p) {
      return {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        heroImage: p.heroImage,
        destinationTag: p.destinationTag,
        publishedAt: p.publishedAt,
        readingMinutes: p.readingMinutes,
        relatedDestinationSlugs: p.relatedDestinationSlugs,
      };
    });
  // Filter chips only for destinations that have at least one guide.
  const filters = destinations
    .filter(function (d) { return posts.some(function (p) { return p.relatedDestinationSlugs.indexOf(d.slug) !== -1; }); })
    .map(function (d) { return { slug: d.slug, name: d.name }; });

  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-10 pt-32 lg:pt-40 pb-24">
      <p className="flex items-center gap-3 text-sm font-medium text-sage mb-3">
        <span aria-hidden="true" className="h-px w-8 bg-burgundy" />
        Journal
      </p>
      <h1 className="text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-6 max-w-3xl">Travel Notes on Jaipur, Alwar &amp; Sariska</h1>
      <p className="text-lg text-charcoal-soft leading-relaxed max-w-2xl mb-10 pb-10 border-b border-line">
        Practical guides for planning a trip around our destinations {"\u2014"} when to go, how to get between them, and where to stay.
      </p>
      <JournalExplorer posts={posts} filters={filters} />
    </main>
  );
}

import { destinations } from "@/config/destinations.config";
import { properties } from "@/config/properties.config";
import { journalPosts } from "@/lib/journal-posts";

export default function sitemap() {
  const base = "https://ritumbhara.com";
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: base + "/about", lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: base + "/contact", lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: base + "/experiences", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: base + "/destinations", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: base + "/journal", lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...destinations.map(function (d) {
      return { url: base + "/destinations/" + d.slug, lastModified: now, changeFrequency: "weekly", priority: 0.8 };
    }),
    ...properties.map(function (p) {
      return { url: base + "/properties/" + p.slug, lastModified: now, changeFrequency: "weekly", priority: 0.85 };
    }),
    ...journalPosts.map(function (p) {
      return { url: base + "/journal/" + p.slug, lastModified: p.publishedAt, changeFrequency: "monthly", priority: 0.6 };
    }),
  ];
}

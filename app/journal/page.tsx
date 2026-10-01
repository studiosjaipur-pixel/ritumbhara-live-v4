import React from "react";
import Link from "next/link";
import Image from "next/image";
import { journalPosts } from "@/lib/journal-posts";
import { socialMetadata } from "@/lib/seo";

const journalTitle = "Journal: Jaipur, Alwar & Sariska Travel Guides";
const journalDescription = "Travel guides for Jaipur, Alwar, and Sariska \u2014 from Ritumbhara.";

export const metadata = {
  title: journalTitle,
  description: journalDescription,
  alternates: { canonical: "/journal" },
  ...socialMetadata("/journal", journalTitle + " | Ritumbhara", journalDescription),
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

export default function JournalIndexPage() {
  const posts = [...journalPosts].sort(function (a, b) {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return React.createElement(
    "main",
    { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 lg:pt-40 pb-24" },
    React.createElement("p", { className: "flex items-center gap-3 text-sm font-medium text-sage mb-3" }, React.createElement("span", { "aria-hidden": true, className: "h-px w-8 bg-burgundy" }), "Journal"),
    React.createElement("h1", { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-6 max-w-3xl" }, "Travel Notes on Jaipur, Alwar & Sariska"),
    React.createElement(
      "p",
      { className: "text-lg text-charcoal-soft leading-relaxed max-w-2xl mb-14 pb-10 border-b border-line" },
      "Practical guides for planning a trip around our destinations — when to go, how to get between them, and where to stay."
    ),
    React.createElement(
      "div",
      { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12" },
      posts.map(function (post) {
        return React.createElement(
          Link,
          {
            key: post.slug,
            href: "/journal/" + post.slug,
            className: "group flex flex-col",
          },
          post.heroImage
            ? React.createElement(
                "div",
                { className: "relative w-full aspect-[3/2] overflow-hidden rounded-sm bg-sand" },
                React.createElement(Image, {
                  src: post.heroImage,
                  alt: post.title,
                  fill: true,
                  sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
                  quality: 70,
                  className: "object-cover transition-transform duration-700 ease-snap group-hover-fine:scale-[1.04]",
                })
              )
            : React.createElement("div", { className: "w-full aspect-[3/2] rounded-sm rb-jaali-light", "aria-hidden": true }),
          React.createElement(
            "div",
            { className: "pt-4 flex flex-col flex-1" },
            React.createElement(
              "p",
              { className: "text-xs font-medium text-sage mb-1.5" },
              post.destinationTag
            ),
            React.createElement("h2", { className: "text-[1.7rem] leading-tight text-charcoal mb-2 group-hover-fine:text-burgundy transition-colors" }, post.title),
            React.createElement("p", { className: "text-sm text-charcoal-soft leading-relaxed mb-5" }, post.excerpt),
            React.createElement(
              "p",
              { className: "mt-auto pt-2 pb-3 border-b border-line text-xs text-charcoal-muted" },
              formatDate(post.publishedAt) + " · " + post.readingMinutes + " min read"
            )
          )
        );
      })
    )
  );
}

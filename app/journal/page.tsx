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
    React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "Journal"),
    React.createElement("h1", { className: "text-4xl lg:text-5xl font-semibold text-[#1A1A1A] mb-6 max-w-3xl" }, "Travel Notes on Jaipur, Alwar & Sariska"),
    React.createElement(
      "p",
      { className: "text-lg text-[#4A4A4A] leading-relaxed max-w-2xl mb-14 pb-10 border-b border-[#EDE7DD]" },
      "Practical guides for planning a trip around our destinations — when to go, how to get between them, and where to stay."
    ),
    React.createElement(
      "div",
      { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-8" },
      posts.map(function (post) {
        return React.createElement(
          Link,
          {
            key: post.slug,
            href: "/journal/" + post.slug,
            className: "group border border-[#EDE7DD] rounded-md overflow-hidden bg-white flex flex-col hover-fine:-translate-y-1 hover-fine:shadow-[0_14px_32px_rgba(26,26,26,0.08)] active:scale-[0.98] active:duration-100 transition-[transform,box-shadow] duration-300 ease-snap",
          },
          post.heroImage
            ? React.createElement(
                "div",
                { className: "relative w-full aspect-[16/10] overflow-hidden bg-[#EDE7DD]" },
                React.createElement(Image, {
                  src: post.heroImage,
                  alt: post.title,
                  fill: true,
                  sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
                  quality: 70,
                  className: "object-cover transition-transform duration-500 ease-snap group-hover-fine:scale-[1.04]",
                })
              )
            : React.createElement("div", { className: "w-full aspect-[16/10] rb-jaali-light", "aria-hidden": true }),
          React.createElement(
            "div",
            { className: "p-6 flex flex-col flex-1" },
            React.createElement(
              "p",
              { className: "uppercase tracking-[0.15em] text-[11px] text-[#97183C] font-semibold mb-2" },
              post.destinationTag
            ),
            React.createElement("h2", { className: "text-lg font-semibold text-[#1A1A1A] mb-2 leading-snug group-hover-fine:text-[#97183C] transition-colors" }, post.title),
            React.createElement("p", { className: "text-sm text-[#4A4A4A] leading-relaxed mb-5" }, post.excerpt),
            React.createElement(
              "p",
              { className: "mt-auto text-xs text-[#8A8A8A]" },
              formatDate(post.publishedAt) + " · " + post.readingMinutes + " min read"
            )
          )
        );
      })
    )
  );
}

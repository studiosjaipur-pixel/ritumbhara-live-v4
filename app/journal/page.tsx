import React from "react";
import Link from "next/link";
import Image from "next/image";
import { journalPosts } from "@/lib/journal-posts";

export const metadata = {
  title: "Journal",
  description: "Travel guides for Jaipur, Alwar, and Sariska — from Ritumbhara.",
  alternates: { canonical: "/journal" },
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
    { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-24" },
    React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "Journal"),
    React.createElement("h1", { className: "text-4xl font-semibold text-[#1A1A1A] mb-6" }, "Travel Notes on Jaipur, Alwar & Sariska"),
    React.createElement(
      "p",
      { className: "text-lg text-[#4A4A4A] max-w-2xl mb-14" },
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
            className: "border border-[#EDE7DD] rounded-md overflow-hidden block bg-white hover:shadow-lg transition-shadow flex flex-col",
          },
          post.heroImage
            ? React.createElement(
                "div",
                { className: "relative w-full h-44" },
                React.createElement(Image, {
                  src: post.heroImage,
                  alt: post.title,
                  fill: true,
                  sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
                  quality: 70,
                  className: "object-cover",
                })
              )
            : React.createElement("div", { className: "w-full h-44 bg-[#F5F1EA]" }),
          React.createElement(
            "div",
            { className: "p-6" },
            React.createElement(
              "p",
              { className: "uppercase tracking-[0.15em] text-[11px] text-[#97183C] font-semibold mb-2" },
              post.destinationTag
            ),
            React.createElement("h2", { className: "font-semibold text-[#1A1A1A] mb-2 leading-snug" }, post.title),
            React.createElement("p", { className: "text-sm text-[#4A4A4A] mb-4" }, post.excerpt),
            React.createElement(
              "p",
              { className: "text-xs text-[#8A8A8A]" },
              formatDate(post.publishedAt) + " · " + post.readingMinutes + " min read"
            )
          )
        );
      })
    )
  );
}

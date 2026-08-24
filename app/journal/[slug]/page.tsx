import React from "react";
import Link from "next/link";
import Image from "next/image";
import { journalPosts, JournalBlock } from "@/lib/journal-posts";
import { destinations } from "@/config/destinations.config";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return journalPosts.map(function (p) {
    return { slug: p.slug };
  });
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = journalPosts.find(function (p) {
    return p.slug === params.slug;
  });
  if (!post) return {};
  return {
    title: post.title,
    description: post.metaDescription,
    alternates: { canonical: "/journal/" + post.slug },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.metaDescription,
      url: "/journal/" + post.slug,
      images: post.heroImage ? [{ url: post.heroImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.metaDescription,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

function renderBlock(block: JournalBlock, i: number) {
  if (block.type === "heading") {
    return React.createElement("h2", { key: i, className: "text-2xl font-semibold text-[#1A1A1A] mt-10 mb-4" }, block.text);
  }
  if (block.type === "list") {
    return React.createElement(
      "ul",
      { key: i, className: "space-y-2 text-[#4A4A4A] mb-4 list-disc pl-5" },
      block.items.map(function (item, j) {
        return React.createElement("li", { key: j }, item);
      })
    );
  }
  return React.createElement("p", { key: i, className: "text-[#4A4A4A] leading-relaxed mb-4" }, block.text);
}

export default function JournalPostPage({ params }: { params: { slug: string } }) {
  const post = journalPosts.find(function (p) {
    return p.slug === params.slug;
  });
  if (!post) return notFound();

  const relatedDestinations = destinations.filter(function (d) {
    return post.relatedDestinationSlugs.indexOf(d.slug) !== -1;
  });
  const primaryDestinationSlug = post.relatedDestinationSlugs[0];

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: "Ritumbhara" },
    publisher: { "@type": "Organization", name: "Ritumbhara" },
    mainEntityOfPage: "https://ritumbhara.com/journal/" + post.slug,
    image: post.heroImage || undefined,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://ritumbhara.com" },
      { "@type": "ListItem", position: 2, name: "Journal", item: "https://ritumbhara.com/journal" },
      { "@type": "ListItem", position: 3, name: post.title, item: "https://ritumbhara.com/journal/" + post.slug },
    ],
  };

  return React.createElement(
    "main",
    { className: "max-w-3xl mx-auto px-6 pt-32 pb-24" },
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(articleSchema) } }),
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
    React.createElement(
      "nav",
      { className: "text-xs text-[#8A8A8A] mb-8" },
      React.createElement(Link, { href: "/journal", className: "hover:underline" }, "Journal"),
      " / ",
      React.createElement("span", null, post.destinationTag)
    ),
    React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, post.destinationTag),
    React.createElement("h1", { className: "text-4xl md:text-5xl font-semibold text-[#1A1A1A] mb-6" }, post.title),
    React.createElement(
      "p",
      { className: "text-sm text-[#8A8A8A] mb-10" },
      formatDate(post.publishedAt) + " · " + post.readingMinutes + " min read"
    ),
    post.heroImage
      ? React.createElement(
          "div",
          { className: "relative w-full h-72 rounded-md overflow-hidden mb-10" },
          React.createElement(Image, {
            src: post.heroImage,
            alt: post.title,
            fill: true,
            sizes: "(max-width: 768px) 100vw, 768px",
            priority: true,
            quality: 70,
            className: "object-cover",
          })
        )
      : null,
    React.createElement("div", null, post.body.map(renderBlock)),

    relatedDestinations.length > 0 &&
      React.createElement(
        "div",
        { className: "border border-[#EDE7DD] bg-[#F5F1EA] rounded-md p-6 my-12" },
        React.createElement("p", { className: "font-semibold text-[#1A1A1A] mb-3" }, "Planning this trip?"),
        React.createElement(
          "div",
          { className: "flex flex-col gap-2" },
          relatedDestinations.map(function (d) {
            return React.createElement(
              Link,
              {
                key: d.slug,
                href: "/destinations/" + d.slug,
                className: "text-[#97183C] font-medium hover:underline",
              },
              "See stays and things to do in " + d.name + " →"
            );
          }),
          post.relatedLinks.map(function (link) {
            return React.createElement(
              Link,
              { key: link.href, href: link.href, className: "text-[#97183C] font-medium hover:underline" },
              link.label + " →"
            );
          })
        )
      ),

    React.createElement(
      "div",
      { className: "border-t border-[#EDE7DD] pt-12 mt-4" },
      React.createElement("h2", { className: "text-2xl font-semibold text-[#1A1A1A] mb-6 text-center" }, "Check Availability"),
      React.createElement(
        "div",
        { className: "flex justify-center" },
        primaryDestinationSlug
          ? React.createElement(LeadCaptureForm, {
              title: "Plan your stay",
              subtitle: "We'll get back to you directly — no OTA fees, real-time human answers.",
              defaultDestination: primaryDestinationSlug,
            })
          : React.createElement(CheckAvailabilityWidget, { variant: "inline" })
      )
    )
  );
}

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
      siteName: "Ritumbhara",
      locale: "en_IN",
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
    return React.createElement("h2", { key: i, className: "text-3xl lg:text-[2.1rem] text-charcoal leading-tight mt-12 mb-4" }, block.text);
  }
  if (block.type === "list") {
    return React.createElement(
      "ul",
      { key: i, className: "space-y-2.5 text-[17px] text-charcoal/90 leading-[1.75] mb-6 list-disc pl-5 marker:text-sage" },
      block.items.map(function (item, j) {
        return React.createElement("li", { key: j }, item);
      })
    );
  }
  return React.createElement("p", { key: i, className: "text-[17px] text-charcoal/90 leading-[1.8] mb-6" }, block.text);
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
    mainEntityOfPage: "https://www.ritumbhara.com/journal/" + post.slug,
    image: post.heroImage || undefined,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.ritumbhara.com" },
      { "@type": "ListItem", position: 2, name: "Journal", item: "https://www.ritumbhara.com/journal" },
      { "@type": "ListItem", position: 3, name: post.title, item: "https://www.ritumbhara.com/journal/" + post.slug },
    ],
  };

  return React.createElement(
    "main",
    { className: "max-w-3xl mx-auto px-6 pt-32 lg:pt-40 pb-24" },
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(articleSchema) } }),
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
    React.createElement(
      "nav",
      { className: "flex flex-wrap items-center gap-x-1 text-xs text-charcoal-muted mb-8" },
      React.createElement(Link, { href: "/journal", className: "inline-flex items-center min-h-[44px] hover:underline hover:text-burgundy" }, "Journal"),
      " / ",
      React.createElement("span", null, post.destinationTag)
    ),
    React.createElement("p", { className: "flex items-center gap-3 text-sm font-medium text-sage mb-3" }, React.createElement("span", { "aria-hidden": true, className: "h-px w-8 bg-burgundy" }), post.destinationTag),
    React.createElement("h1", { className: "text-[2.5rem] md:text-[3.25rem] text-charcoal leading-[1.06] mb-6" }, post.title),
    React.createElement(
      "p",
      { className: "text-sm text-charcoal-muted mb-10 pb-8 border-b border-line" },
      formatDate(post.publishedAt) + " · " + post.readingMinutes + " min read"
    ),
    post.heroImage
      ? React.createElement(
          "div",
          { className: "relative w-full aspect-[16/9] rounded-sm overflow-hidden mb-12 bg-sand" },
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
        { className: "border-t-2 border-burgundy bg-sand/70 rounded-sm p-6 sm:p-7 my-12" },
        React.createElement("p", { className: "font-display text-[1.75rem] leading-tight text-charcoal mb-2" }, "Planning this trip?"),
        React.createElement(
          "div",
          { className: "flex flex-col" },
          relatedDestinations.map(function (d) {
            return React.createElement(
              Link,
              {
                key: d.slug,
                href: "/destinations/" + d.slug,
                className: "inline-flex items-center min-h-[40px] text-burgundy font-medium hover:underline",
              },
              "See stays and things to do in " + d.name + " →"
            );
          }),
          post.relatedLinks.map(function (link) {
            return React.createElement(
              Link,
              { key: link.href, href: link.href, className: "inline-flex items-center min-h-[40px] text-burgundy font-medium hover:underline" },
              link.label + " →"
            );
          })
        )
      ),

    React.createElement(
      "div",
      { className: "border-t border-line pt-12 mt-4" },
      React.createElement("h2", { className: "text-3xl text-charcoal mb-6 text-center" }, "Check Availability"),
      React.createElement(
        "div",
        { className: "flex justify-center" },
        primaryDestinationSlug
          ? React.createElement(LeadCaptureForm, {
              title: "Plan your stay",
              subtitle: "We'll get back to you directly — real-time human answers.",
              defaultDestination: primaryDestinationSlug,
            })
          : React.createElement(CheckAvailabilityWidget, { variant: "inline" })
      )
    )
  );
}

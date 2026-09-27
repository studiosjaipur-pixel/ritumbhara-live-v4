import React from "react";
import Link from "next/link";
import Image from "next/image";
import { destinations } from "@/config/destinations.config";
import { properties } from "@/config/properties.config";
import { testimonials } from "@/config/testimonials.config";
import PropertyCard from "@/components/PropertyCard";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { notFound } from "next/navigation";
import { journalPosts } from "@/lib/journal-posts";
import { socialMetadata } from "@/lib/seo";

// Existing standalone landing pages that already carry travel directions and FAQs
// for each destination (Week 3: UX-005, UX-012). Linked, not duplicated.
const travelGuides: Record<string, string> = {
  jaipur: "/serviced-apartments-jaipur",
  alwar: "/studios-in-alwar",
  sariska: "/stays-in-sariska",
};

export function generateStaticParams() {
  return destinations.map(function (d) { return { slug: d.slug }; });
}

// Property types actually listed for a destination in config, e.g. "studios and serviced apartments".
function propertyTypePhrase(slug: string) {
  const types: string[] = [];
  properties.forEach(function (p) {
    if (p.destinationSlug !== slug) return;
    const plural = p.propertyType === "Serviced Apartment" ? "serviced apartments" : p.propertyType.toLowerCase() + "s";
    if (types.indexOf(plural) === -1) types.push(plural);
  });
  if (types.length <= 1) return types.join("");
  return types.slice(0, -1).join(", ") + " and " + types[types.length - 1];
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const destination = destinations.find(function (d) { return d.slug === params.slug; });
  if (!destination) return {};
  const isOpen = destination.status === "operational";
  const types = propertyTypePhrase(destination.slug);
  const title = isOpen
    ? "Stays in " + destination.name + ", " + destination.state
    : destination.name + ", " + destination.state + ": Coming Soon";
  const description = isOpen && types
    ? destination.shortStory + " Browse " + types + " managed by Ritumbhara and book direct."
    : destination.shortStory + (destination.status === "coming-soon" ? " Register your interest to hear when stays open." : "");
  return {
    title: title,
    description: description,
    alternates: { canonical: "/destinations/" + destination.slug },
    ...socialMetadata("/destinations/" + destination.slug, title + " | Ritumbhara", description, destination.heroImage || undefined),
  };
}

export default function DestinationPage({ params }: { params: { slug: string } }) {
  const destination = destinations.find(function (d) { return d.slug === params.slug; });
  if (!destination) return notFound();
  const destinationProperties = properties.filter(function (p) { return p.destinationSlug === destination.slug; });
  const matchingTestimonial = testimonials.find(function (t) { return t.location.toLowerCase() === destination.name.toLowerCase(); });
  const guideHref = travelGuides[destination.slug];
  // Existing journal posts that reference this destination (internal linking: destination -> journal).
  const relatedPosts = journalPosts.filter(function (post) { return post.relatedDestinationSlugs.indexOf(destination.slug) !== -1; });

  const placeSchema = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: destination.name,
    description: destination.shortStory,
    address: { "@type": "PostalAddress", addressLocality: destination.name, addressRegion: destination.state, addressCountry: "IN" },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.ritumbhara.com" },
      { "@type": "ListItem", position: 2, name: "Destinations", item: "https://www.ritumbhara.com/destinations" },
      { "@type": "ListItem", position: 3, name: destination.name, item: "https://www.ritumbhara.com/destinations/" + destination.slug },
    ],
  };

  const card = "bg-white border border-[#EDE7DD] rounded-md";

  return React.createElement(React.Fragment, null,
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(placeSchema) } }),
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
    React.createElement("section", { className: "relative overflow-hidden pt-28 lg:pt-32 pb-10 lg:pb-12 " + (destination.heroImage ? "bg-[#1A1A1A]" : "rb-jaali") },
      destination.heroImage && React.createElement(Image, { src: destination.heroImage, alt: destination.name, fill: true, priority: true, quality: 70, sizes: "100vw", className: "object-cover opacity-60" }),
      React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/40", "aria-hidden": true }),
      React.createElement("div", { className: "relative max-w-7xl mx-auto px-6 lg:px-10" },
        React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "Destination"),
        React.createElement("h1", { className: "text-4xl lg:text-5xl font-semibold text-white mb-2" }, destination.name),
        React.createElement("p", { className: "flex items-center gap-1.5 text-white/85 text-sm font-medium mb-3" },
          React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true },
            React.createElement("path", { d: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" }),
            React.createElement("circle", { cx: 12, cy: 9.5, r: 2.5 })
          ),
          destination.state + ", India"
        ),
        React.createElement("p", { className: "text-base lg:text-lg text-white/90 leading-relaxed max-w-2xl mb-6" }, destination.shortStory),
        React.createElement("div", { className: "flex flex-wrap gap-3" },
          destinationProperties.length > 0 && React.createElement("a", { href: "#stays", className: "inline-flex items-center justify-center min-h-[48px] px-6 bg-[#97183C] text-white font-semibold rounded-md hover-fine:bg-[#7E1433] active:scale-[0.98] active:duration-100 transition-[background-color,transform] duration-200 ease-snap" }, "View stays in " + destination.name),
          guideHref && React.createElement(Link, { href: guideHref, className: "inline-flex items-center justify-center min-h-[48px] px-6 border border-white/70 text-white font-semibold rounded-md hover-fine:bg-white hover-fine:text-[#1A1A1A] active:scale-[0.98] active:duration-100 transition-[background-color,color,transform] duration-200 ease-snap" }, "Travel guide & FAQs")
        )
      )
    ),
    React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-10 lg:pt-12 pb-24" },
    destination.status === "coming-soon" && React.createElement("div", { className: "border border-[#EDE7DD] bg-[#F5F1EA] rounded-md p-6 mb-10 max-w-xl" },
      React.createElement("p", { className: "text-sm font-semibold text-[#97183C] mb-2" }, "Coming Soon"),
      React.createElement("p", { className: "text-sm text-[#4A4A4A]" },
        "We're preparing managed stays in " + destination.name + ". ",
        React.createElement(Link, { href: "/contact", className: "underline font-medium text-[#97183C]" }, "Get in touch"),
        " to be notified when we launch."
      )
    ),
    destination.status === "coming-soon" && React.createElement("div", { className: "mb-16" },
      React.createElement(LeadCaptureForm, {
        title: "Be the first to know",
        subtitle: "We'll email you the moment " + destination.name + " opens for booking.",
        defaultDestination: destination.slug,
      })
    ),
    destinationProperties.length > 0 && React.createElement("section", { id: "stays", className: "mb-16" },
      React.createElement("h2", { className: "text-2xl lg:text-3xl font-semibold text-[#1A1A1A] mb-8" }, "Stays in " + destination.name),
      React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-10" },
        destinationProperties.map(function (p) {
          return React.createElement(PropertyCard, { key: p.slug, property: p });
        })
      ),
      React.createElement("div", { className: "overflow-x-auto rounded-md border border-[#EDE7DD] bg-white" },
        React.createElement("table", { className: "w-full min-w-[480px] text-sm" },
          React.createElement("thead", null,
            React.createElement("tr", { className: "bg-[#F5F1EA] text-left" },
              React.createElement("th", { className: "p-3 sm:p-4 font-semibold text-[#1A1A1A]" }, "Property"),
              React.createElement("th", { className: "p-3 sm:p-4 font-semibold text-[#1A1A1A]" }, "Type"),
              React.createElement("th", { className: "p-3 sm:p-4 font-semibold text-[#1A1A1A]" }, "Amenities Listed")
            )
          ),
          React.createElement("tbody", null,
            destinationProperties.map(function (p) {
              return React.createElement("tr", { key: p.slug, className: "border-t border-[#EDE7DD]" },
                React.createElement("td", { className: "p-3 sm:p-4" },
                  React.createElement(Link, { href: "/properties/" + p.slug, className: "inline-flex items-center min-h-[44px] text-[#97183C] font-medium hover:underline" }, p.name)
                ),
                React.createElement("td", { className: "p-3 sm:p-4 text-[#4A4A4A]" }, p.propertyType),
                React.createElement("td", { className: "p-3 sm:p-4 text-[#4A4A4A]" }, p.amenities.length > 0 ? p.amenities.length + " listed" : "Available on request")
              );
            })
          )
        )
      )
    ),
    destination.status === "operational" && React.createElement("div", { className: "mb-16 grid lg:grid-cols-[1fr_1.4fr] gap-8 items-start" },
      React.createElement("div", null,
        React.createElement("h2", { className: "text-2xl font-semibold text-[#1A1A1A] mb-3" }, "Prefer to ask us first?"),
        React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed" }, "Send your dates and we'll reply on WhatsApp.")
      ),
      React.createElement(CheckAvailabilityWidget, { variant: "inline" })
    ),
    matchingTestimonial && React.createElement("div", { className: card + " p-7 mb-16 max-w-2xl border-l-[3px] border-l-[#C8A96A]" },
      React.createElement("blockquote", { className: "text-[#1A1A1A] text-[17px] leading-relaxed mb-3" }, "\u201C" + matchingTestimonial.quote + "\u201D"),
      React.createElement("p", { className: "text-sm text-[#97183C] font-semibold" }, matchingTestimonial.guestLabel + " \u2014 " + matchingTestimonial.location)
    ),
    destination.thingsToDo.length > 0 && React.createElement("div", null,
      React.createElement("h2", { className: "text-2xl lg:text-3xl font-semibold text-[#1A1A1A] mb-8" }, "Things To Do"),
      React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16" },
        destination.thingsToDo.map(function (t) {
          return React.createElement("div", { key: t.title, className: card + " p-6 border-l-[3px] border-l-[#C8A96A]" },
            React.createElement("p", { className: "font-semibold text-[#1A1A1A] mb-1.5" }, t.title),
            React.createElement("p", { className: "text-sm text-[#4A4A4A] leading-relaxed" }, t.description)
          );
        })
      )
    ),
    relatedPosts.length > 0 && React.createElement("section", { className: "mb-16" },
      React.createElement("h2", { className: "text-2xl lg:text-3xl font-semibold text-[#1A1A1A] mb-6" }, "Travel Guides for " + destination.name),
      React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-5" },
        relatedPosts.map(function (post) {
          return React.createElement(Link, { key: post.slug, href: "/journal/" + post.slug, className: "group " + card + " p-5 flex flex-col hover-fine:border-[#D9CDB8] hover-fine:shadow-[0_12px_28px_rgba(26,26,26,0.06)] transition-[border-color,box-shadow] duration-200" },
            React.createElement("p", { className: "text-[11px] font-semibold uppercase tracking-wide text-[#97183C] mb-2" }, post.destinationTag),
            React.createElement("h3", { className: "font-semibold text-[#1A1A1A] leading-snug mb-3 group-hover-fine:text-[#97183C] transition-colors" }, post.title),
            React.createElement("p", { className: "mt-auto text-xs text-[#8A8A8A]" }, post.readingMinutes + " min read")
          );
        })
      )
    ),
    (destination.transportation || guideHref) && React.createElement("div", { className: "bg-[#F5F1EA] rounded-md p-6 sm:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center" },
      React.createElement("div", null,
        React.createElement("h2", { className: "text-2xl font-semibold text-[#1A1A1A] mb-3" }, "Getting Around"),
        React.createElement("p", { className: "text-sm font-medium text-[#97183C] mb-2" }, destination.name + ", " + destination.state),
        destination.transportation && React.createElement("p", { className: "text-[15px] text-[#4A4A4A] leading-relaxed" }, destination.transportation)
      ),
      guideHref && React.createElement(Link, { href: guideHref, className: "inline-flex items-center justify-center min-h-[48px] px-6 border border-[#97183C] text-[#97183C] font-semibold rounded-md hover-fine:bg-[#97183C] hover-fine:text-white transition-colors duration-200" }, "Travel guide & FAQs")
    )
    )
  );
}

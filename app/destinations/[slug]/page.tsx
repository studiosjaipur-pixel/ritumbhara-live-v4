import React from "react";
import { destinations } from "@/config/destinations.config";
import { properties } from "@/config/properties.config";
import PropertyCard from "@/components/PropertyCard";
import { notFound } from "next/navigation";

export function generateStaticParams() {
    return destinations.map(function (d) { return { slug: d.slug }; });
}

export function generateMetadata({ params }: { params: { slug: string } }) {
    const destination = destinations.find(function (d) { return d.slug === params.slug; });
    if (!destination) return {};
    const title = destination.name + ", " + destination.state;
    const description = destination.shortStory;
    return {
          title: title,
          description: description,
          alternates: { canonical: "/destinations/" + destination.slug },
          openGraph: {
                  title: title,
                  description: description,
                  url: "/destinations/" + destination.slug,
                  images: destination.heroImage ? [{ url: destination.heroImage }] : undefined,
          },
          twitter: {
                  card: "summary_large_image",
                  title: title,
                  description: description,
          },
    };
}

export default function DestinationPage({ params }: { params: { slug: string } }) {
    const destination = destinations.find(function (d) { return d.slug === params.slug; });
    if (!destination) return notFound();
    const destinationProperties = properties.filter(function (p) { return p.destinationSlug === destination.slug; });

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
          { "@type": "ListItem", position: 1, name: "Home", item: "https://ritumbhara.com" },
          { "@type": "ListItem", position: 2, name: "Destinations", item: "https://ritumbhara.com/destinations" },
          { "@type": "ListItem", position: 3, name: destination.name, item: "https://ritumbhara.com/destinations/" + destination.slug },
              ],
  };

  return React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-24" },
                                 React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(placeSchema) } }),
                                 React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
                                 React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "Destination"),
                                 React.createElement("h1", { className: "text-5xl font-semibold text-[#1A1A1A] mb-6" }, destination.name),
                                 React.createElement("p", { className: "text-lg text-[#4A4A4A] max-w-2xl mb-14" }, destination.shortStory),
                                 destinationProperties.length > 0 && React.createElement("div", null,
                                                                                               React.createElement("h2", { className: "text-2xl font-semibold text-[#1A1A1A] mb-8" }, "Stays in " + destination.name),
                                                                                               React.createElement("div", { className: "grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16" },
                                                                                                                           destinationProperties.map(function (p) {
                                                                                                                                       return React.createElement(PropertyCard, { key: p.slug, property: p });
                                                                                                                             })
                                                                                                                         )
                                                                                             ),
                                 destination.thingsToDo.length > 0 && React.createElement("div", null,
                                                                                                React.createElement("h2", { className: "text-2xl font-semibold text-[#1A1A1A] mb-8" }, "Things To Do"),
                                                                                                React.createElement("div", { className: "grid sm:grid-cols-2 gap-6 mb-16" },
                                                                                                                            destination.thingsToDo.map(function (t) {
                                                                                                                                        return React.createElement("div", { key: t.title, className: "border border-[#EDE7DD] rounded-md p-5" },
                                                                                                                                                                               React.createElement("p", { className: "font-semibold text-[#1A1A1A] mb-1" }, t.title),
                                                                                                                                                                               React.createElement("p", { className: "text-sm text-[#4A4A4A]" }, t.description)
                                                                                                                                                                             );
                                                                                                                              })
                                                                                                                          )
                                                                                              ),
                                 destination.transportation && React.createElement("div", null,
                                                                                         React.createElement("h2", { className: "text-2xl font-semibold text-[#1A1A1A] mb-4" }, "Getting Around"),
                                                                                         React.createElement("p", { className: "text-sm text-[#4A4A4A]" }, destination.transportation)
                                                                                       )
                               );
}

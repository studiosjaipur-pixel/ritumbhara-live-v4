import React from "react";
import Image from "next/image";
import { properties } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return properties.map(function (p) { return { slug: p.slug }; });
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const property = properties.find(function (p) { return p.slug === params.slug; });
  if (!property) return {};
  const title = property.name;
  return {
    title: title,
    description: property.description,
    alternates: { canonical: "/properties/" + property.slug },
    openGraph: {
      title: title,
      description: property.description,
      url: "/properties/" + property.slug,
      images: [{ url: property.heroImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: property.description,
      images: [property.heroImage],
    },
  };
}

export default function PropertyPage({ params }: { params: { slug: string } }) {
  const property = properties.find(function (p) { return p.slug === params.slug; });
  if (!property) return notFound();
  const destination = destinations.find(function (d) { return d.slug === property.destinationSlug; });

  const lodgingSchema = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: property.description,
    image: property.heroImage,
    telephone: property.contact.phone,
    email: property.contact.email,
    url: "https://ritumbhara.com/properties/" + property.slug,
    address: destination ? { "@type": "PostalAddress", addressLocality: destination.name, addressRegion: destination.state, addressCountry: "IN" } : undefined,
    amenityFeature: property.amenities.map(function (a) {
      return { "@type": "LocationFeatureSpecification", name: a, value: true };
    }),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://ritumbhara.com" },
      { "@type": "ListItem", position: 2, name: "Destinations", item: "https://ritumbhara.com/destinations" },
      destination ? { "@type": "ListItem", position: 3, name: destination.name, item: "https://ritumbhara.com/destinations/" + destination.slug } : null,
      { "@type": "ListItem", position: 4, name: property.name, item: "https://ritumbhara.com/properties/" + property.slug },
    ].filter(Boolean),
  };

  return React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-28 lg:pb-24" },
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(lodgingSchema) } }),
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
    React.createElement("div", { className: "relative h-[420px] w-full rounded-md overflow-hidden mb-10" },
      React.createElement(Image, { src: property.heroImage, alt: property.name, fill: true, sizes: "100vw", priority: true, className: "object-cover" })
    ),
    React.createElement("div", { className: "grid lg:grid-cols-3 gap-16" },
      React.createElement("div", { className: "lg:col-span-2" },
        React.createElement("h1", { className: "text-4xl font-semibold mb-6" }, property.name),
        React.createElement("p", { className: "text-lg text-[#4A4A4A] mb-10" }, property.description),
        property.amenities.length > 0
          ? React.createElement(React.Fragment, null,
              React.createElement("h2", { className: "text-2xl font-semibold mb-6" }, "Amenities"),
              React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-3 gap-4" },
                property.amenities.map(function (a) {
                  return React.createElement("div", { key: a, className: "text-sm" }, "\u2022 " + a);
                })
              )
            )
          : React.createElement("p", { className: "text-sm text-[#4A4A4A] italic" }, "Full amenity details for this property are available on request \u2014 contact us using the details alongside.")
      ),
      React.createElement("aside", { className: "border border-[#EDE7DD] rounded-md p-7 h-fit lg:sticky lg:top-32" },
        React.createElement("div", { className: "flex items-center gap-2 mb-5 text-xs font-semibold text-[#97183C] bg-[#F5F1EA] rounded-md px-3 py-2 w-fit" },
          React.createElement("span", null, "\u2605 Airbnb Superhost")
        ),
        React.createElement("p", { className: "mb-1" }, property.contact.phone),
        React.createElement("p", { className: "mb-6" }, property.contact.email),
        React.createElement("a", { href: property.hotelSpiderBookingUrl, target: "_blank", rel: "noopener", className: "block text-center bg-[#97183C] text-white font-medium py-3.5 rounded-md mb-3" }, "Check Availability & Book"),
        React.createElement("a", { href: "https://wa.me/919503002629?text=" + encodeURIComponent("Hi, I'd like to check availability for " + property.name), target: "_blank", rel: "noopener", className: "flex items-center justify-center gap-2 border border-[#97183C] text-[#97183C] font-medium py-3 rounded-md mb-5" }, "WhatsApp Us"),
        React.createElement("p", { className: "text-xs text-center text-[#8A8A8A]" }, "Book direct with Ritumbhara \u2014 no OTA booking fees")
      )
    ),
    React.createElement("div", { className: "fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-[#EDE7DD] p-3 flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" },
      React.createElement("a", { href: "https://wa.me/919503002629?text=" + encodeURIComponent("Hi, I'd like to check availability for " + property.name), target: "_blank", rel: "noopener", className: "flex-1 text-center border border-[#97183C] text-[#97183C] font-medium py-3 rounded-md text-sm" }, "WhatsApp"),
      React.createElement("a", { href: property.hotelSpiderBookingUrl, target: "_blank", rel: "noopener", className: "flex-1 text-center bg-[#97183C] text-white font-medium py-3 rounded-md text-sm" }, "Check Availability")
    )
  );
}

import React from "react";
import Image from "next/image";
import { properties } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";
import { testimonials } from "@/config/testimonials.config";
import { notFound } from "next/navigation";
import Link from "next/link";

// Existing standalone landing pages with directions and FAQs for each destination (Week 3: UX-005, UX-012).
const travelGuides: Record<string, string> = {
  jaipur: "/serviced-apartments-jaipur",
  alwar: "/studios-in-alwar",
  sariska: "/stays-in-sariska",
};

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
      type: "website",
      locale: "en_IN",
      siteName: "Ritumbhara",
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
  const matchingTestimonial = destination ? testimonials.find(function (t) { return t.location.toLowerCase() === destination.name.toLowerCase(); }) : undefined;

  const lodgingSchema = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: property.description,
    image: property.heroImage,
    telephone: property.contact.phone,
    email: property.contact.email,
    url: "https://www.ritumbhara.com/properties/" + property.slug,
    address: destination ? { "@type": "PostalAddress", addressLocality: destination.name, addressRegion: destination.state, addressCountry: "IN" } : undefined,
    amenityFeature: property.amenities.map(function (a) {
      return { "@type": "LocationFeatureSpecification", name: a, value: true };
    }),
    // Verified facts only: the managing company and the property's existing Hotel Spider booking page.
    parentOrganization: { "@type": "Organization", name: "Ritumbhara", url: "https://www.ritumbhara.com" },
    potentialAction: { "@type": "ReserveAction", target: property.hotelSpiderBookingUrl },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.ritumbhara.com" },
      { "@type": "ListItem", position: 2, name: "Destinations", item: "https://www.ritumbhara.com/destinations" },
      destination ? { "@type": "ListItem", position: 3, name: destination.name, item: "https://www.ritumbhara.com/destinations/" + destination.slug } : null,
      { "@type": "ListItem", position: 4, name: property.name, item: "https://www.ritumbhara.com/properties/" + property.slug },
    ].filter(Boolean),
  };

  const guideHref = destination ? travelGuides[destination.slug] : undefined;
  const whatsappHref = "https://wa.me/919503002629?text=" + encodeURIComponent("Hi, I'd like to check availability for " + property.name);

  return React.createElement(React.Fragment, null,
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(lodgingSchema) } }),
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
    React.createElement("div", { className: "relative h-[62vh] min-h-[420px] max-h-[680px] w-full overflow-hidden bg-[#1A1A1A]" },
      React.createElement(Image, { src: property.heroImage, alt: property.name, fill: true, sizes: "100vw", quality: 70, priority: true, className: "object-cover" }),
      React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/45" }),
      React.createElement("div", { className: "absolute top-24 left-0 right-0 px-6 lg:px-10" },
        React.createElement("nav", { "aria-label": "Breadcrumb", className: "max-w-7xl mx-auto text-xs text-white/80 flex flex-wrap items-center gap-x-2" },
          React.createElement("a", { href: "/", className: "inline-flex items-center min-h-[32px] hover:text-white" }, "Home"),
          React.createElement("span", { "aria-hidden": true }, "/"),
          destination && React.createElement(React.Fragment, null,
            React.createElement("a", { href: "/destinations/" + destination.slug, className: "inline-flex items-center min-h-[32px] hover:text-white" }, destination.name),
            React.createElement("span", { "aria-hidden": true }, "/")
          ),
          React.createElement("span", { className: "text-white" }, property.name)
        )
      ),
      React.createElement("div", { className: "absolute bottom-0 left-0 right-0 px-6 lg:px-10 pb-8 lg:pb-12" },
        React.createElement("div", { className: "max-w-7xl mx-auto" },
          React.createElement("span", { className: "inline-block text-xs font-semibold uppercase tracking-wide bg-white/95 text-[#1A1A1A] px-3 py-1.5 rounded-full mb-4" }, property.propertyType),
          React.createElement("h1", { className: "text-4xl lg:text-6xl font-semibold text-white drop-shadow-sm leading-[1.05]" }, property.name),
          destination && React.createElement("p", { className: "flex items-center gap-1.5 text-white/90 text-sm font-medium mt-3" },
            React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true },
              React.createElement("path", { d: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" }),
              React.createElement("circle", { cx: 12, cy: 9.5, r: 2.5 })
            ),
            destination.name + ", " + destination.state
          )
        )
      )
    ),
    React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-10 lg:pt-14 pb-28 lg:pb-24" },
    React.createElement("div", { className: "grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16 items-start" },
      React.createElement("div", { className: "min-w-0" },
        React.createElement("p", { className: "text-lg lg:text-xl text-[#2B2B2B] leading-relaxed mb-10 max-w-2xl" }, property.description),
        property.amenities.length > 0
          ? React.createElement("section", { className: "mb-10" },
              React.createElement("h2", { className: "text-2xl font-semibold mb-5" }, "Amenities"),
              React.createElement("ul", { className: "flex flex-wrap gap-2.5" },
                property.amenities.map(function (a) {
                  return React.createElement("li", { key: a, className: "inline-flex items-center gap-2 text-sm text-[#1A1A1A] bg-white border border-[#EDE7DD] rounded-full px-3.5 py-2" },
                    React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "#97183C", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
                      React.createElement("path", { d: "M5 12.5l4.5 4.5L19 7.5" })
                    ),
                    a
                  );
                })
              )
            )
          : React.createElement("p", { className: "text-sm text-[#4A4A4A] italic bg-[#F5F1EA] rounded-md px-4 py-3 mb-10" }, "Full amenity details for this property are available on request \u2014 contact us using the details alongside."),
        destination && React.createElement("section", { className: "bg-[#F5F1EA] rounded-md p-6 mb-10" },
          React.createElement("h2", { className: "text-lg font-semibold text-[#1A1A1A] mb-1" }, "Location"),
          React.createElement("p", { className: "text-[#4A4A4A] mb-4" }, destination.name + ", " + destination.state),
          React.createElement("div", { className: "flex flex-wrap gap-x-6 gap-y-1" },
            React.createElement(Link, { href: "/destinations/" + destination.slug, className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-[#97183C] underline decoration-[#97183C]/30 underline-offset-4 hover-fine:decoration-[#97183C]" }, "Explore " + destination.name),
            guideHref && React.createElement(Link, { href: guideHref, className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-[#97183C] underline decoration-[#97183C]/30 underline-offset-4 hover-fine:decoration-[#97183C]" }, "Travel guide & FAQs")
          )
        ),
        matchingTestimonial && React.createElement("div", { className: "bg-white border border-[#EDE7DD] border-l-[3px] border-l-[#C8A96A] rounded-md p-6" },
          React.createElement("blockquote", { className: "text-[#1A1A1A] text-[17px] leading-relaxed mb-3" }, "\u201C" + matchingTestimonial.quote + "\u201D"),
          React.createElement("p", { className: "text-sm text-[#8A8A8A] font-medium" }, matchingTestimonial.guestLabel + " \u2014 a guest in " + matchingTestimonial.location)
        )
      ),
      React.createElement("aside", { className: "bg-white border border-[#EDE7DD] rounded-md p-6 lg:p-7 h-fit lg:sticky lg:top-28 shadow-[0_12px_32px_rgba(26,26,26,0.06)]" },
        React.createElement("div", { className: "flex items-center gap-2 mb-5 text-xs font-semibold text-[#97183C] bg-[#F5F1EA] rounded-md px-3 py-2 w-fit" },
          React.createElement("span", null, "\u2605 Airbnb Superhost")
        ),
        React.createElement("a", { href: property.hotelSpiderBookingUrl, target: "_blank", rel: "noopener", className: "flex items-center justify-center min-h-[52px] text-center bg-[#97183C] text-white font-semibold rounded-md mb-3 hover-fine:bg-[#7E1433] active:scale-[0.98] active:duration-100 transition-[background-color,transform] duration-200 ease-snap" }, "Check Availability & Book"),
        React.createElement("a", { href: whatsappHref, target: "_blank", rel: "noopener", className: "flex items-center justify-center gap-2 min-h-[48px] border border-[#97183C] text-[#97183C] font-semibold rounded-md mb-4 hover-fine:bg-[#97183C] hover-fine:text-white active:scale-[0.98] active:duration-100 transition-[background-color,color,transform] duration-200 ease-snap" }, "WhatsApp Us"),
        React.createElement("p", { className: "text-xs text-center text-[#8A8A8A] mb-6" }, "Book direct with Ritumbhara \u2014 no OTA booking fees"),
        React.createElement("div", { className: "border-t border-[#EDE7DD] pt-5 text-sm" },
          React.createElement("p", { className: "text-[#4A4A4A] mb-3" }, "Questions before you book? Message us on WhatsApp or get in touch:"),
          React.createElement("a", { href: "tel:" + property.contact.phone.replace(/\s+/g, ""), className: "flex items-center min-h-[44px] font-medium text-[#1A1A1A] hover-fine:text-[#97183C]" }, property.contact.phone),
          React.createElement("a", { href: "mailto:" + property.contact.email, className: "flex items-center min-h-[44px] font-medium text-[#1A1A1A] hover-fine:text-[#97183C] break-all" }, property.contact.email)
        )
      )
    ),
    React.createElement("div", { className: "fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white border-t border-[#EDE7DD] p-3 flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" },
      React.createElement("a", { href: whatsappHref, target: "_blank", rel: "noopener", className: "flex-1 flex items-center justify-center min-h-[48px] text-center border border-[#97183C] text-[#97183C] font-semibold rounded-md text-sm" }, "WhatsApp"),
      React.createElement("a", { href: property.hotelSpiderBookingUrl, target: "_blank", rel: "noopener", className: "flex-1 flex items-center justify-center min-h-[48px] text-center bg-[#97183C] text-white font-semibold rounded-md text-sm" }, "Check Availability")
    )
    )
  );
}

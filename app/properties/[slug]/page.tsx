import React from "react";
import Image from "next/image";
import { properties } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";
import { testimonials } from "@/config/testimonials.config";
import { getLocationDetails, cityLocations } from "@/config/locations.config";
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
  const location = destination ? getLocationDetails(property.slug, destination.slug) : undefined;
  const heroAlt = property.name + (destination ? " \u2014 " + property.propertyType.toLowerCase() + " in " + destination.name + ", " + destination.state : "");
  const gallery = property.gallery || [];
  const cityInfo = !location && destination ? cityLocations[destination.slug] : undefined;
  const nearby: string[] = location ? location.nearby : cityInfo ? cityInfo.nearby : destination ? destination.thingsToDo.map(function (t) { return t.title; }) : [];
  const gettingThereList: string[] = location ? location.gettingThere : cityInfo ? cityInfo.gettingThere : destination && destination.transportation ? [destination.transportation] : [];

  // Common guest questions (UX-007, UX-010). Answers use only verified site data; anything not yet
  // published (check-in/out times, cancellation terms, house rules) is a WhatsApp prompt, not an answer.
  const faqItems: { q: string; a: string }[] = [];
  if (destination) {
    faqItems.push({
      q: "Where is " + property.name + " located?",
      a: location
        ? location.area + ". " + location.summary + "."
        : "In " + destination.name + ", " + destination.state + ". Message us on WhatsApp for directions.",
    });
    const gettingThere = gettingThereList.join(". ");
    if (gettingThere) faqItems.push({ q: "How do I get there?", a: gettingThere + (/[.]$/.test(gettingThere) ? "" : ".") });
  }
  faqItems.push({
    q: "What amenities are included?",
    a: property.amenities.length > 0
      ? "Listed amenities for " + property.name + ": " + property.amenities.join(", ") + "."
      : "Amenity details for " + property.name + " haven't been listed here yet. Message us on WhatsApp and we'll confirm what's included before you book.",
  });
  faqItems.push({
    q: "What are the check-in and check-out times, cancellation terms and house rules?",
    a: "Message us on WhatsApp and we'll confirm the check-in and check-out times, cancellation terms and house rules for your dates before you book.",
  });
  faqItems.push({
    q: "Can I book directly instead of through an OTA?",
    a: "Yes \u2014 booking directly with Ritumbhara gets you the same or better rates than Airbnb or other platforms, with no platform fees and direct WhatsApp support.",
  });

  return React.createElement(React.Fragment, null,
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(lodgingSchema) } }),
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
    React.createElement("div", { className: "relative h-[62vh] min-h-[420px] max-h-[680px] w-full overflow-hidden bg-charcoal" },
      React.createElement(Image, { src: property.heroImage, alt: heroAlt, fill: true, sizes: "100vw", quality: 70, priority: true, className: "object-cover" }),
      React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/45" }),
      React.createElement("div", { className: "absolute top-24 left-0 right-0 px-6 lg:px-10" },
        React.createElement("nav", { "aria-label": "Breadcrumb", className: "max-w-7xl mx-auto text-xs text-ivory/80 flex flex-wrap items-center gap-x-2" },
          React.createElement("a", { href: "/", className: "inline-flex items-center min-h-[44px] hover:text-ivory" }, "Home"),
          React.createElement("span", { "aria-hidden": true }, "/"),
          destination && React.createElement(React.Fragment, null,
            React.createElement("a", { href: "/destinations/" + destination.slug, className: "inline-flex items-center min-h-[44px] hover:text-ivory" }, destination.name),
            React.createElement("span", { "aria-hidden": true }, "/")
          ),
          React.createElement("span", { className: "text-ivory" }, property.name)
        )
      ),
      React.createElement("div", { className: "absolute bottom-0 left-0 right-0 px-6 lg:px-10 pb-8 lg:pb-12" },
        React.createElement("div", { className: "max-w-7xl mx-auto" },
          React.createElement("span", { className: "inline-block text-xs font-semibold tracking-wide bg-ivory/95 text-charcoal px-3 py-1.5 rounded-sm mb-4" }, property.propertyType),
          React.createElement("h1", { className: "text-[2.75rem] lg:text-[4rem] text-ivory leading-[1.02]" }, property.name),
          destination && React.createElement("p", { className: "flex items-center gap-1.5 text-ivory/90 text-sm font-medium mt-3" },
            React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true },
              React.createElement("path", { d: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" }),
              React.createElement("circle", { cx: 12, cy: 9.5, r: 2.5 })
            ),
            (location ? location.area : destination.name) + ", " + destination.state
          )
        )
      )
    ),
    React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-10 lg:pt-14 pb-28 lg:pb-24" },
    React.createElement("div", { className: "grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16 items-start" },
      React.createElement("div", { className: "min-w-0" },
        React.createElement("p", { className: "text-lg lg:text-xl text-charcoal leading-relaxed mb-10 max-w-2xl" }, property.description),
        gallery.length > 0 && React.createElement("section", { className: "mb-10", "aria-label": property.name + " photos" },
          React.createElement("h2", { className: "text-3xl mb-5" }, "Photos"),
          React.createElement("ul", { className: "grid grid-cols-2 gap-3 sm:gap-4" },
            gallery.map(function (img, i) {
              return React.createElement("li", { key: img.src, className: "relative overflow-hidden rounded-sm bg-sand " + (i === 0 && gallery.length % 2 === 1 ? "col-span-2 aspect-[16/9]" : "aspect-[4/3]") },
                React.createElement(Image, { src: img.src, alt: img.alt, fill: true, quality: 70, sizes: i === 0 && gallery.length % 2 === 1 ? "(max-width: 1024px) 100vw, 800px" : "(max-width: 1024px) 50vw, 400px", className: "object-cover" })
              );
            })
          )
        ),
        React.createElement("section", { className: "mb-10" },
          React.createElement("h2", { className: "text-3xl mb-5" }, "Amenities"),
          property.amenities.length > 0
            ? React.createElement("ul", { className: "grid grid-cols-2 sm:grid-cols-3 gap-x-6 border-t border-line" },
                property.amenities.map(function (a) {
                  return React.createElement("li", { key: a, className: "flex items-center gap-2.5 text-[15px] text-charcoal border-b border-line py-3" },
                    React.createElement("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "#5C6952", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
                      React.createElement("path", { d: "M5 12.5l4.5 4.5L19 7.5" })
                    ),
                    a
                  );
                })
              )
            : React.createElement("p", { className: "text-[15px] text-charcoal-soft border-y border-line py-4" }, "Amenity details for this property haven't been listed here yet. Message us on WhatsApp and we'll confirm what's included before you book.")
        ),
        destination && React.createElement("section", { className: "border-t border-line pt-6 mb-10" },
          React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-1" }, "Location"),
          React.createElement("address", { className: "not-italic text-lg text-charcoal mb-1" }, (location ? location.area : destination.name) + ", " + destination.state),
          React.createElement("p", { className: "text-[15px] text-charcoal-soft mb-5" }, location ? location.summary : cityInfo ? cityInfo.note : "Exact location details on request \u2014 message us on WhatsApp for directions."),
          React.createElement("div", { className: "grid sm:grid-cols-2 gap-x-8 gap-y-5 mb-4" },
            gettingThereList.length > 0 && React.createElement("div", null,
              React.createElement("h3", { className: "text-sm font-semibold text-sage mb-2" }, "Getting there"),
              React.createElement("ul", { className: "text-[15px] text-charcoal-soft leading-relaxed space-y-1.5" },
                gettingThereList.map(function (pt) {
                  return React.createElement("li", { key: pt, className: "flex gap-2.5" },
                    React.createElement("span", { "aria-hidden": true, className: "mt-[0.6em] w-1.5 h-1.5 shrink-0 rounded-full bg-sage" }),
                    pt
                  );
                })
              )
            ),
            nearby.length > 0 && React.createElement("div", null,
              React.createElement("h3", { className: "text-sm font-semibold text-sage mb-2" }, location ? "Nearby" : "In and around " + destination.name + " city"),
              React.createElement("ul", { className: "text-[15px] text-charcoal-soft leading-relaxed space-y-1.5" },
                nearby.map(function (pt) {
                  return React.createElement("li", { key: pt, className: "flex gap-2.5" },
                    React.createElement("span", { "aria-hidden": true, className: "mt-[0.6em] w-1.5 h-1.5 shrink-0 rounded-full bg-sage" }),
                    pt
                  );
                })
              )
            )
          ),
          React.createElement("div", { className: "flex flex-wrap gap-x-6 gap-y-1" },
            React.createElement(Link, { href: "/destinations/" + destination.slug, className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Explore " + destination.name),
            guideHref && React.createElement(Link, { href: guideHref, className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Travel guide & FAQs"),
            location && location.mapsQuery && React.createElement("a", { href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location.mapsQuery), target: "_blank", rel: "noopener", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "View the area on Google Maps")
          )
        ),
        React.createElement("section", { id: "before-you-book", className: "border-t border-line pt-6 mb-10 scroll-mt-28" },
          React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-4" }, "Before You Book"),
          React.createElement("div", { className: "divide-y divide-line border-y border-line" },
            faqItems.map(function (item) {
              return React.createElement("details", { key: item.q, className: "group" },
                React.createElement("summary", { className: "flex items-center justify-between gap-4 min-h-[52px] py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold text-[16px] text-charcoal hover-fine:text-burgundy" },
                  item.q,
                  React.createElement("span", { "aria-hidden": true, className: "shrink-0 text-xl leading-none text-burgundy transition-transform duration-200 group-open:rotate-45" }, "+")
                ),
                React.createElement("p", { className: "pb-4 text-charcoal-soft leading-relaxed" }, item.a)
              );
            })
          )
        ),
        matchingTestimonial && React.createElement("figure", { className: "border-t border-charcoal/20 pt-6" },
          React.createElement("blockquote", { className: "font-display text-[1.6rem] leading-snug text-charcoal mb-3" }, "\u201C" + matchingTestimonial.quote + "\u201D"),
          React.createElement("figcaption", { className: "text-sm text-charcoal-soft font-medium" }, matchingTestimonial.guestLabel + " \u2014 a guest in " + matchingTestimonial.location)
        )
      ),
      React.createElement("aside", { className: "bg-sand/70 border-t-2 border-burgundy rounded-sm p-6 lg:p-7 h-fit lg:sticky lg:top-28" },
        React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-1" }, "Book Your Stay"),
        React.createElement("div", { className: "flex items-center gap-2 mb-5 text-xs font-semibold text-burgundy" },
          React.createElement("span", null, "\u2605 Airbnb Superhost")
        ),
        // One set of booking actions (UX-003): a fixed bar at the bottom of the screen on mobile, and part of
        // this sticky booking panel on desktop. Same links as before; rendered once instead of twice.
        React.createElement("div", { className: "fixed bottom-0 inset-x-0 z-40 bg-ivory/95 backdrop-blur border-t border-line p-3 flex flex-row-reverse gap-2 lg:static lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:p-0 lg:flex-col lg:gap-3 lg:mb-4" },
          React.createElement("a", { href: property.hotelSpiderBookingUrl, target: "_blank", rel: "noopener", className: "flex-1 flex items-center justify-center min-h-[48px] lg:min-h-[52px] text-center bg-burgundy text-ivory text-sm lg:text-base font-semibold rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] active:duration-100 transition-[background-color,transform] duration-200 ease-snap" },
            "Check Availability", React.createElement("span", { className: "hidden lg:inline" }, "\u00A0& Book")
          ),
          React.createElement("a", { href: whatsappHref, target: "_blank", rel: "noopener", className: "flex-1 flex items-center justify-center min-h-[48px] text-center border border-burgundy text-burgundy text-sm lg:text-base font-semibold rounded-sm hover-fine:bg-burgundy hover-fine:text-ivory active:scale-[0.98] active:duration-100 transition-[background-color,color,transform] duration-200 ease-snap" },
            "WhatsApp", React.createElement("span", { className: "hidden lg:inline" }, "\u00A0Us")
          )
        ),
        React.createElement("p", { className: "text-xs text-center text-charcoal-muted mb-2" }, "Book direct with Ritumbhara \u2014 no OTA booking fees"),
        React.createElement("a", { href: "#before-you-book", className: "flex items-center justify-center min-h-[44px] text-xs font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy mb-4" }, "Check-in, cancellation & house rules"),
        React.createElement("div", { className: "border-t border-line pt-5 text-sm" },
          React.createElement("p", { className: "text-charcoal-soft mb-3" }, "Questions before you book? Message us on WhatsApp or get in touch:"),
          React.createElement("a", { href: "tel:" + property.contact.phone.replace(/\s+/g, ""), className: "flex items-center min-h-[44px] font-medium text-charcoal hover-fine:text-burgundy" }, property.contact.phone),
          React.createElement("a", { href: "mailto:" + property.contact.email, className: "flex items-center min-h-[44px] font-medium text-charcoal hover-fine:text-burgundy break-all" }, property.contact.email)
        )
      )
    ),
    )
  );
}

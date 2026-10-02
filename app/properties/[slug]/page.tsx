import React from "react";
import Image from "next/image";
import { properties } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";
import { testimonials } from "@/config/testimonials.config";
import { getLocationDetails, isPlacementVerified } from "@/config/locations.config";
import { bookingEngine } from "@/config/booking.config";
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
  // Hotel-Spider does not confirm where the "Alwar"-named rooms are, so their pages make no city claim:
  // no destination name, area, distances, destination links or destination-matched testimonial.
  const placementVerified = !!destination && isPlacementVerified(destination.slug);
  const placeDestination = placementVerified ? destination : undefined;
  const matchingTestimonial = placeDestination ? testimonials.find(function (t) { return t.location.toLowerCase() === placeDestination.name.toLowerCase(); }) : undefined;

  const lodgingSchema = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: property.description,
    image: property.heroImage,
    telephone: property.contact.phone,
    email: property.contact.email,
    url: "https://www.ritumbhara.com/properties/" + property.slug,
    address: placeDestination
      ? { "@type": "PostalAddress", addressLocality: placeDestination.name, addressRegion: placeDestination.state, addressCountry: "IN" }
      : property.bookingEngineListed
        ? { "@type": "PostalAddress", postalCode: "302022", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN" }
        : undefined,
    amenityFeature: property.amenities.map(function (a) {
      return { "@type": "LocationFeatureSpecification", name: a, value: true };
    }),
    // Verified facts only: the managing company and the property's existing Hotel Spider booking page.
    parentOrganization: { "@type": "Organization", name: "Ritumbhara", url: "https://www.ritumbhara.com" },
    potentialAction: property.hotelSpiderBookingUrl ? { "@type": "ReserveAction", target: property.hotelSpiderBookingUrl } : undefined,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.ritumbhara.com" },
      { "@type": "ListItem", position: 2, name: "Destinations", item: "https://www.ritumbhara.com/destinations" },
      placeDestination ? { "@type": "ListItem", position: 3, name: placeDestination.name, item: "https://www.ritumbhara.com/destinations/" + placeDestination.slug } : null,
      { "@type": "ListItem", position: placeDestination ? 4 : 3, name: property.name, item: "https://www.ritumbhara.com/properties/" + property.slug },
    ].filter(Boolean),
  };

  const guideHref = placeDestination ? travelGuides[placeDestination.slug] : undefined;
  const whatsappHref = "https://wa.me/919503002629?text=" + encodeURIComponent("Hi, I'd like to check availability for " + property.name);
  const location = placeDestination ? getLocationDetails(property.slug, placeDestination.slug) : undefined;
  // Hero alt text uses the most precise verified place (e.g. "Alwar district, near Sariska Tiger Reserve" for the villa).
  const heroAlt = property.name + " \u2014 " + property.propertyType.toLowerCase() + (location ? " in " + location.area : placeDestination ? " in " + placeDestination.name + ", " + placeDestination.state : "");
  const gallery = property.gallery || [];
  const galleryShown = gallery.length > 4 ? gallery.slice(0, 4) : gallery;
  const galleryMore = gallery.length > 4 ? gallery.slice(4) : [];
  const nearby: string[] = location ? location.nearby : placeDestination ? placeDestination.thingsToDo.map(function (t) { return t.title; }) : [];
  const gettingThereList: string[] = location ? location.gettingThere : placeDestination && placeDestination.transportation ? [placeDestination.transportation] : [];
  // Where the place line and Location section point: verified area, verified city, the booking engine's
  // listed address, or nothing beyond the state.
  const placeLine = location
    ? location.area + ", " + (placeDestination ? placeDestination.state : "")
    : placeDestination
      ? placeDestination.name + ", " + placeDestination.state
      : property.bookingEngineListed ? bookingEngine.address : "Rajasthan, India";
  const hasRoomLink = !!property.hotelSpiderBookingUrl;

  // Common guest questions (UX-007, UX-010). Answers use only verified site data; anything not yet
  // published (check-in/out times, cancellation terms, house rules) is a WhatsApp prompt, not an answer.
  // Stay terms verified on the Hotel-Spider booking engine; shown only for rooms listed there (UX-002/UX-007 data).
  const stayTerms: { label: string; value: string; wide?: boolean }[] = property.bookingEngineListed
    ? [
        ...(property.maxGuests ? [{ label: "Guests", value: "Up to " + property.maxGuests + " guests" }] : []),
        { label: "Check-in", value: bookingEngine.checkIn },
        { label: "Check-out", value: "By " + bookingEngine.checkOut },
        { label: "Payment", value: bookingEngine.payment },
        { label: "Cancellation", value: bookingEngine.cancellation, wide: true },
        { label: "Nightly rate", value: "Shown in \u20B9 (" + bookingEngine.currency + ") on our booking page for your dates and number of guests \u2014 rates vary with dates and availability.", wide: true },
      ]
    : [];
  const faqItems: { q: string; a: string }[] = [];
  if (destination) {
    faqItems.push({
      q: "Where is " + property.name + " located?",
      a: location
        ? location.area + ". " + location.summary + "."
        : placeDestination
          ? "In " + placeDestination.name + ", " + placeDestination.state + ". Message us on WhatsApp for directions."
          : property.bookingEngineListed
            ? "Our booking engine lists the address as " + bookingEngine.address + ". Message us on WhatsApp for the exact location and directions."
            : "Message us on WhatsApp for the exact location and directions.",
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
    a: property.bookingEngineListed
      ? "Check-in is " + bookingEngine.checkIn + " and check-out is by " + bookingEngine.checkOut + ". " + bookingEngine.cancellation + " For house rules, message us on WhatsApp."
      : "Message us on WhatsApp and we'll confirm the check-in and check-out times, cancellation terms and house rules for your dates before you book.",
  });
  faqItems.push({
    q: "Can I book directly instead of through an OTA?",
    // No price comparison with Airbnb or other platforms: there is no verified rate data to support one.
    a: property.bookingEngineListed
      ? "Yes \u2014 you can book directly with Ritumbhara. Check current availability and see the rate for your dates on our online booking engine before you pay, with direct WhatsApp support."
      : "Yes \u2014 you can book directly with Ritumbhara on WhatsApp. Send us your dates and we\u2019ll confirm current availability and the rate before you book, with direct WhatsApp support.",
  });

  return React.createElement(React.Fragment, null,
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(lodgingSchema) } }),
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(breadcrumbSchema) } }),
    React.createElement("div", { className: "relative h-[52vh] min-h-[380px] sm:h-[62vh] sm:min-h-[420px] max-h-[680px] w-full overflow-hidden bg-charcoal" },
      React.createElement(Image, { src: property.heroImage, alt: heroAlt, fill: true, sizes: "100vw", quality: 70, priority: true, className: "object-cover" }),
      React.createElement("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/45" }),
      React.createElement("div", { className: "absolute top-24 left-0 right-0 px-6 lg:px-10" },
        React.createElement("nav", { "aria-label": "Breadcrumb", className: "max-w-7xl mx-auto text-xs text-ivory/80 flex flex-wrap items-center gap-x-2" },
          React.createElement("a", { href: "/", className: "inline-flex items-center min-h-[44px] hover:text-ivory" }, "Home"),
          React.createElement("span", { "aria-hidden": true }, "/"),
          React.createElement(React.Fragment, null,
            React.createElement("a", { href: placeDestination ? "/destinations/" + placeDestination.slug : "/destinations", className: "inline-flex items-center min-h-[44px] hover:text-ivory" }, placeDestination ? placeDestination.name : "Destinations"),
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
            location || placeDestination ? placeLine : "Rajasthan, India"
          )
        )
      )
    ),
    React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-8 lg:pt-14 pb-12 lg:pb-24" },
    React.createElement("div", { className: "grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-16 items-start" },
      React.createElement("div", { className: "min-w-0" },
        React.createElement("p", { className: "text-lg lg:text-xl text-charcoal leading-relaxed mb-10 max-w-2xl" }, property.description),
        // Verified Hotel-Spider gallery (UX-005). The first 4 photos show straight away; the rest sit in a
        // native <details> toggle, so their lazy images are not downloaded until the visitor opens it.
        gallery.length > 0 && React.createElement("section", { className: "mb-10", "aria-label": property.name + " photos" },
          React.createElement("h2", { className: "text-3xl mb-5" }, "Photos"),
          React.createElement("ul", { className: "grid grid-cols-2 gap-3 sm:gap-4" },
            galleryShown.map(function (img, i) {
              const wide = i === 0 && galleryShown.length % 2 === 1;
              return React.createElement("li", { key: img.src, className: "relative overflow-hidden rounded-sm bg-sand " + (wide ? "col-span-2 aspect-[16/9]" : "aspect-[4/3]") },
                React.createElement("a", { href: img.src, target: "_blank", rel: "noopener", "aria-label": img.alt + " \u2014 open full size (new tab)", className: "absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy" },
                  React.createElement(Image, { src: img.src, alt: img.alt, fill: true, quality: 70, sizes: wide ? "(max-width: 1024px) 100vw, 800px" : "(max-width: 1024px) 50vw, 400px", className: "object-cover" })
                )
              );
            })
          ),
          galleryMore.length > 0 && React.createElement("details", { className: "group mt-3 sm:mt-4" },
            React.createElement("summary", { className: "inline-flex items-center min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" },
              React.createElement("span", { className: "group-open:hidden" }, "Show all " + (gallery.length + 1) + " photos"),
              React.createElement("span", { className: "hidden group-open:inline" }, "Show fewer photos")
            ),
            React.createElement("ul", { className: "grid grid-cols-2 gap-3 sm:gap-4 mt-3" },
              galleryMore.map(function (img) {
                return React.createElement("li", { key: img.src, className: "relative overflow-hidden rounded-sm bg-sand aspect-[4/3]" },
                  React.createElement("a", { href: img.src, target: "_blank", rel: "noopener", "aria-label": img.alt + " \u2014 open full size (new tab)", className: "absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy" },
                    React.createElement(Image, { src: img.src, alt: img.alt, fill: true, quality: 70, sizes: "(max-width: 1024px) 50vw, 400px", className: "object-cover" })
                  )
                );
              })
            )
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
            : React.createElement("p", { className: "text-[15px] text-charcoal-soft border-y border-line py-4" }, "Specific amenities for " + property.name + " haven't been listed here yet. Message us on WhatsApp and we'll confirm what's included before you book.")
        ),
        destination && React.createElement("section", { className: "border-t border-line pt-6 mb-10" },
          React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-1" }, "Location"),
          React.createElement("address", { className: "not-italic text-lg text-charcoal mb-1" }, placeLine),
          React.createElement("p", { className: "text-[15px] text-charcoal-soft mb-5" }, location
            ? location.summary
            : placeDestination
              ? "Exact location details on request \u2014 message us on WhatsApp for directions."
              : property.bookingEngineListed
                ? "The address our booking engine lists for this room. Message us on WhatsApp for the exact location and directions."
                : "Message us on WhatsApp for the exact location and directions."),
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
              React.createElement("h3", { className: "text-sm font-semibold text-sage mb-2" }, location ? "Nearby" : "In and around " + (placeDestination ? placeDestination.name : "")),
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
            placeDestination && React.createElement(Link, { href: "/destinations/" + placeDestination.slug, className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Explore " + placeDestination.name),
            guideHref && React.createElement(Link, { href: guideHref, className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Travel guide & FAQs"),
            location && location.mapsQuery && React.createElement("a", { href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location.mapsQuery), target: "_blank", rel: "noopener", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "View " + (location.mapsLabel || "the area") + " on Google Maps")
          ),
          // Map of the verified area or landmark (UX-003), with a note saying exactly what it shows. It sits in a
          // native <details> toggle so Google Maps only loads when a visitor asks for it, keeping page loads light.
          location && location.mapsQuery && React.createElement("details", { className: "group mt-2" },
            React.createElement("summary", { className: "inline-flex items-center gap-2 min-h-[44px] cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" },
              React.createElement("span", { className: "group-open:hidden" }, "Show map"),
              React.createElement("span", { className: "hidden group-open:inline" }, "Hide map")
            ),
            React.createElement("figure", { className: "mt-2" },
              React.createElement("div", { className: "relative aspect-[4/3] sm:aspect-[16/9] w-full overflow-hidden rounded-sm bg-sand" },
                React.createElement("iframe", { src: "https://www.google.com/maps?q=" + encodeURIComponent(location.mapsQuery) + "&output=embed", title: "Map of " + (location.mapsLabel || location.mapsQuery), loading: "lazy", referrerPolicy: "no-referrer-when-downgrade", className: "absolute inset-0 w-full h-full border-0" })
              ),
              location.mapsNote && React.createElement("figcaption", { className: "text-xs text-charcoal-muted mt-2" }, location.mapsNote)
            )
          )
        ),
        React.createElement("section", { id: "before-you-book", className: "border-t border-line pt-6 mb-10 scroll-mt-28" },
          React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-4" }, "Before You Book"),
          stayTerms.length > 0 && React.createElement("dl", { className: "grid sm:grid-cols-2 gap-x-8 border-t border-line mb-6" },
            stayTerms.map(function (t) {
              return React.createElement("div", { key: t.label, className: "py-3 border-b border-line" + (t.wide ? " sm:col-span-2" : "") },
                React.createElement("dt", { className: "text-xs font-semibold text-sage mb-0.5" }, t.label),
                React.createElement("dd", { className: "text-[15px] text-charcoal" }, t.value)
              );
            })
          ),
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
      // On phones the booking panel comes straight after the photo, so the price explanation sits above the fold
      // (UX-003); on desktop it stays the sticky right-hand column.
      React.createElement("aside", { id: "book", "aria-labelledby": "book-heading", className: "order-first lg:order-none scroll-mt-28 bg-sand/70 border-t-2 border-burgundy rounded-sm p-5 sm:p-6 lg:p-7 h-fit lg:sticky lg:top-28" },
        React.createElement("h2", { id: "book-heading", className: "text-[1.6rem] leading-tight text-charcoal mb-4" }, "Book Your Stay"),
        // How pricing works (UX-002). Hotel-Spider prices depend on dates, guests and availability, so the
        // panel explains where the live price is shown instead of displaying a stale number.
        // No nightly amount is shown: there is no approved starting rate or pricing API, and test-date prices
        // from the engine would be wrong for other dates.
        React.createElement("dl", { className: "bg-ivory/80 border-l-2 border-burgundy rounded-sm px-4 py-3 mb-4 lg:mb-5" },
          React.createElement("dt", { className: "text-xs font-semibold text-sage mb-1" }, "Price per night (\u20B9 " + bookingEngine.currency + ")"),
          React.createElement("dd", { className: "font-display text-[1.45rem] leading-tight text-charcoal mb-1" }, hasRoomLink ? "Live price for your dates" : "Price on request"),
          React.createElement("dd", { className: "text-sm text-charcoal-soft leading-snug" }, hasRoomLink
            ? "Book Now opens our booking page with the exact nightly rate and total in \u20B9 for your dates and guests, before you pay."
            : "This stay isn\u2019t on our online booking engine \u2014 message us on WhatsApp with your dates and we\u2019ll send the price.")
        ),
        // One set of booking actions (UX-003): a fixed bar at the bottom of the screen on mobile, and part of
        // this sticky booking panel on desktop. Same links as before; rendered once instead of twice.
        React.createElement("div", { "data-booking-bar": "", className: "fixed bottom-0 inset-x-0 z-40 bg-ivory/95 backdrop-blur border-t border-line px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-row-reverse flex-wrap gap-2 shadow-[0_-4px_16px_rgba(38,34,31,0.08)] lg:shadow-none lg:pb-0 lg:pt-0 lg:px-0 lg:flex-nowrap lg:static lg:z-auto lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:p-0 lg:flex-col lg:gap-3 lg:mb-4" },
          React.createElement("p", { className: "lg:hidden order-first basis-full text-center text-xs text-charcoal-soft" }, hasRoomLink ? "Book Now shows the live \u20B9 price for your dates" : "Nightly price on request via WhatsApp"),
          // Room-specific booking link only when the room is verified on the engine; otherwise a WhatsApp
          // enquiry plus the engine's general page, never a broken room link.
          ...(hasRoomLink ? [
          React.createElement("a", { href: property.hotelSpiderBookingUrl, target: "_blank", rel: "noopener", className: "flex-[1.6] lg:flex-1 flex items-center justify-center min-h-[48px] lg:min-h-[52px] text-center bg-burgundy text-ivory text-sm lg:text-base font-semibold rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] active:duration-100 transition-[background-color,transform] duration-200 ease-snap" },
            "Book Now"
          ),
          React.createElement("a", { href: whatsappHref, target: "_blank", rel: "noopener", className: "flex-1 flex items-center justify-center min-h-[48px] text-center border border-burgundy text-burgundy text-sm lg:text-base font-semibold rounded-sm hover-fine:bg-burgundy hover-fine:text-ivory active:scale-[0.98] active:duration-100 transition-[background-color,color,transform] duration-200 ease-snap" },
            "WhatsApp", React.createElement("span", { className: "hidden lg:inline" }, "\u00A0Us")
          )
          ] : [
          React.createElement("a", { href: whatsappHref, target: "_blank", rel: "noopener", className: "flex-[1.6] lg:flex-1 flex items-center justify-center min-h-[48px] lg:min-h-[52px] text-center bg-burgundy text-ivory text-sm lg:text-base font-semibold rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] active:duration-100 transition-[background-color,transform] duration-200 ease-snap" },
            "Book on WhatsApp"
          ),
          React.createElement("a", { href: bookingEngine.generalUrl, target: "_blank", rel: "noopener", className: "flex-1 flex items-center justify-center min-h-[48px] text-center border border-burgundy text-burgundy text-sm lg:text-base font-semibold rounded-sm hover-fine:bg-burgundy hover-fine:text-ivory active:scale-[0.98] active:duration-100 transition-[background-color,color,transform] duration-200 ease-snap" },
            React.createElement("span", { className: "lg:hidden" }, "Bookable Rooms"),
            React.createElement("span", { className: "hidden lg:inline" }, "Browse Bookable Rooms")
          )
          ])
        ),
        React.createElement("p", { className: "text-xs text-center text-charcoal-muted mb-2" }, "Book direct with Ritumbhara"),
        React.createElement("a", { href: "#before-you-book", className: "flex items-center justify-center min-h-[44px] text-xs font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy mb-4" }, property.bookingEngineListed ? "Check-in times & cancellation terms" : "Check-in, cancellation & house rules"),
      )
    ),
    )
  );
}

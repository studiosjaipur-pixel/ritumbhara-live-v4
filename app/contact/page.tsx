import React from "react";
import Link from "next/link";
import { destinations } from "@/config/destinations.config";
import { bookingEngine } from "@/config/booking.config";
import { socialMetadata } from "@/lib/seo";
import { Metadata } from "next";

const contactTitle = "Contact: Reservations & Partner Enquiries";
const contactDescription = "Contact Ritumbhara by phone, WhatsApp or email for reservation support, property-owner partnerships, or general enquiries.";

export const metadata: Metadata = {
      title: contactTitle,
      description: contactDescription,
      alternates: { canonical: "/contact" },
      ...socialMetadata("/contact", contactTitle + " | Ritumbhara", contactDescription),
};

const cardClass = "group border-t border-line py-5 flex flex-col transition-colors duration-200";
const labelClass = "text-xs font-semibold text-sage mb-1";
const valueClass = "font-display text-[1.75rem] leading-tight text-charcoal group-hover-fine:text-burgundy transition-colors break-words";

// Contact-page FAQ (UX-011). Answers use only verified project data: the Hotel-Spider booking engine terms
// (config/booking.config.ts), the contact details and partner links shown on this page, and the booking flow
// on property pages. The same text feeds the visible list and the FAQPage structured data.
const contactFaqs = [
  {
    q: "How do I book a stay?",
    a: "Open the property's page on this site. Rooms on our online booking engine have a Book Now button that opens our Hotel-Spider booking page, where you see current availability and the rate for your dates before you pay. For stays that aren't on the booking engine, message us on WhatsApp with your dates.",
  },
  {
    q: "How can I ask about availability for my dates?",
    a: "Message us on WhatsApp at +91 95030 02629 with your destination, dates and number of guests, or use Book Now on a property page to check availability on our booking engine.",
  },
  {
    q: "What are the check-in and check-out times?",
    a: "For rooms booked on our online booking engine, check-in is " + bookingEngine.checkIn + " and check-out is by " + bookingEngine.checkOut + ". For stays arranged on WhatsApp, we confirm the times with you before you book.",
  },
  {
    q: "What is the cancellation policy?",
    a: "For rooms booked on our online booking engine: " + bookingEngine.cancellation + " For stays arranged on WhatsApp, we confirm the cancellation terms with you before you book.",
  },
  {
    q: "I own a property. How do I partner with Ritumbhara?",
    a: "Read about our FOCO model on the Our Story page, or start with Partner With Us under Property owners on this page. You can also reach us by phone, WhatsApp or email.",
  },
];

const contactFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: contactFaqs.map(function (f) {
    return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
  }),
};

export default function ContactPage() {
      return React.createElement(React.Fragment, null, React.createElement(
              "main",
          { className: "min-h-[100svh] flex flex-col pt-32 lg:pt-36 pb-16 lg:pb-20 px-6 lg:px-10 max-w-7xl mx-auto w-full" },
              React.createElement(
                        "div",
                  { className: "grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-start" },
                        React.createElement(
                                    "div",
                                    null,
                                    React.createElement(
                                              "h1",
                                        { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-4 pb-6 border-b border-line" },
                                              "Contact Us"
                                            ),
                                    React.createElement(
                                              "p",
                                        { className: "text-charcoal-soft leading-relaxed max-w-md" },
                                              "For reservations, please book directly through each property's page. For partnerships, press, or general questions, reach us below."
                                            ),
                                    React.createElement(
                                              "div",
                                        { className: "mt-6 pt-5 border-t border-line max-w-md" },
                                              React.createElement("p", { className: "text-sm font-semibold text-charcoal mb-1" }, "Property owners"),
                                              React.createElement(
                                                          "div",
                                                          { className: "flex flex-wrap gap-x-6" },
                                                          React.createElement(Link, { href: "/about#foco", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Our FOCO model"),
                                                          React.createElement("a", { href: "/partner-onboarding.html", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy" }, "Partner With Us")
                                                        )
                                            )
                                  ),
                        React.createElement(
                                    "div",
                                    { className: "grid sm:grid-cols-2 gap-x-8 border-b border-line" },
                                    React.createElement(
                                                "a",
                                                { href: "tel:+919503002629", className: cardClass },
                                                React.createElement("p", { className: labelClass }, "Phone"),
                                                React.createElement("span", { className: valueClass }, "+91 95030 02629")
                                              ),
                                    React.createElement(
                                                "a",
                                                { href: "https://wa.me/919503002629", target: "_blank", rel: "noopener", className: cardClass },
                                                React.createElement("p", { className: labelClass }, "WhatsApp"),
                                                React.createElement("span", { className: valueClass }, "+91 95030 02629")
                                              ),
                                    React.createElement(
                                                "a",
                                                { href: "mailto:studios.jaipur@gmail.com", className: cardClass + " sm:col-span-2" },
                                                React.createElement("p", { className: labelClass }, "Email"),
                                                React.createElement("span", { className: valueClass }, "studios.jaipur@gmail.com")
                                              ),
                                    // Business location as listed on the Hotel-Spider booking engine (UX-004). It has no street
                                    // line, so the map link searches the listed postcode area only. Property locations stay on
                                    // each property page and are not replaced by this address.
                                    React.createElement(
                                                "a",
                                                { href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(bookingEngine.address), target: "_blank", rel: "noopener", className: cardClass + " sm:col-span-2" },
                                                React.createElement("p", { className: labelClass }, "Business address"),
                                                React.createElement("address", { className: "not-italic " + valueClass }, "Ritumbhara, " + bookingEngine.address),
                                                React.createElement("span", { className: "mt-1 text-sm font-semibold text-burgundy underline decoration-burgundy/30 underline-offset-4" }, "View on Google Maps")
                                              )
                                  )
                      ),
              // Frequently asked questions (UX-011): native <details>/<summary>, so every question and answer is in the
              // server-rendered HTML and works without JavaScript.
              React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(contactFaqSchema) } }),
              React.createElement(
                        "section",
                  { id: "faq", "aria-labelledby": "contact-faq-heading", className: "scroll-mt-28 mt-12 lg:mt-16 grid lg:grid-cols-[0.9fr_1.1fr] gap-6 lg:gap-16" },
                        React.createElement("h2", { id: "contact-faq-heading", className: "text-[1.75rem] lg:text-[2.25rem] leading-tight text-charcoal" }, "Frequently Asked Questions"),
                        React.createElement(
                                    "div",
                                    { className: "divide-y divide-line border-y border-line" },
                                    contactFaqs.map(function (f) {
                                      return React.createElement("details", { key: f.q, className: "group" },
                                        React.createElement("summary", { className: "flex items-center justify-between gap-4 min-h-[52px] py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold text-[16px] text-charcoal hover-fine:text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy" },
                                          f.q,
                                          React.createElement("span", { "aria-hidden": true, className: "shrink-0 text-xl leading-none text-burgundy transition-transform duration-200 group-open:rotate-45" }, "+")
                                        ),
                                        React.createElement("p", { className: "pb-4 text-[15px] text-charcoal-soft leading-relaxed" }, f.a)
                                      );
                                    })
                                  )
                      ),
              React.createElement(
                        "div",
                  { className: "mt-12 lg:mt-auto lg:pt-12" },
                        React.createElement(
                                    "div",
                                    { className: "relative overflow-hidden bg-sand/70 rounded-sm p-6 sm:p-8" },
                                    React.createElement("div", { className: "absolute inset-y-0 right-0 w-1/3 rb-jaali-light hidden md:block", "aria-hidden": true }),
                                    React.createElement(
                                                "div",
                                                { className: "relative" },
                                                // Where Ritumbhara operates, from destinations.config (UX-010). No office address is
                                                // published, so the operating areas are shown instead of an invented one.
                                                React.createElement("h2", { className: "text-[1.75rem] leading-tight text-charcoal mb-4" }, "Where we host"),
                                                React.createElement(
                                                              "ul",
                                                    { className: "grid grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-1 md:w-2/3 md:pr-6" },
                                                              destinations.map(function (d) {
                                                                return React.createElement("li", { key: d.slug },
                                                                  React.createElement(Link, { href: "/destinations/" + d.slug, className: "group flex flex-col justify-center min-h-[52px] py-1" },
                                                                    React.createElement("span", { className: "font-display text-[1.45rem] leading-tight text-charcoal group-hover-fine:text-burgundy transition-colors" }, d.name),
                                                                    React.createElement("span", { className: "text-xs text-charcoal-muted" }, d.state + (d.status === "operational" ? "" : " \u00B7 Coming soon"))
                                                                  )
                                                                );
                                                              })
                                                            )
                                              )
                                  )
                      )
            ),
      // One persistent contact action on phones and tablets (UX-005): a fixed bar with the site's WhatsApp
      // number. It replaces the floating WhatsApp button on this page below the lg breakpoint (see
      // FloatingWhatsApp), so there is never more than one floating contact control.
      React.createElement("div", { "data-mobile-action-bar": "", role: "group", "aria-label": "Contact actions", className: "lg:hidden fixed bottom-0 inset-x-0 z-40 bg-ivory/95 backdrop-blur border-t border-line px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(38,34,31,0.08)]" },
        React.createElement("a", { href: "https://wa.me/919503002629", target: "_blank", rel: "noopener", "aria-label": "WhatsApp Us on +91 95030 02629 (opens WhatsApp)", className: "flex items-center justify-center gap-2 min-h-[48px] w-full bg-burgundy text-ivory text-[15px] font-semibold rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] active:duration-100 transition-[background-color,transform] duration-200 ease-snap" },
          React.createElement("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true },
            React.createElement("path", { d: "M3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 8 19.3z" }),
            React.createElement("path", { d: "M9 9.5c0 2.8 2.7 5.5 5.5 5.5l1.2-1.3-1.9-1-1 .8c-.9-.4-1.9-1.4-2.3-2.3l.8-1-1-1.9z", fill: "currentColor", stroke: "none" })
          ),
          "WhatsApp Us"
        )
      )
    );
}

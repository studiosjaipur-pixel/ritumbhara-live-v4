import React from "react";
import Link from "next/link";
import Testimonials from "@/components/Testimonials";
import { destinations } from "@/config/destinations.config";
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
                                              )
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
      // Real guest reviews from testimonials.config (UX-003).
      React.createElement(Testimonials, null)
    );
}

import React from "react";
import Link from "next/link";
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

const cardClass = "group bg-white border border-[#EDE7DD] rounded-md p-5 flex flex-col hover-fine:border-[#C8A96A] hover-fine:shadow-[0_12px_28px_rgba(26,26,26,0.06)] transition-[border-color,box-shadow] duration-200";
const labelClass = "text-xs uppercase tracking-wide text-neutral-500 mb-1.5";
const valueClass = "text-lg text-neutral-900 group-hover-fine:text-[#97183C] transition-colors break-words";

export default function ContactPage() {
      return React.createElement(
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
                                        { className: "text-4xl lg:text-5xl font-semibold text-neutral-900 mb-4 pb-6 border-b border-[#EDE7DD]" },
                                              "Contact Us"
                                            ),
                                    React.createElement(
                                              "p",
                                        { className: "text-neutral-600 leading-relaxed max-w-md" },
                                              "For reservations, please book directly through each property's page. For partnerships, press, or general questions, reach us below."
                                            ),
                                    React.createElement(
                                              "div",
                                        { className: "mt-6 pt-5 border-t border-[#EDE7DD] max-w-md" },
                                              React.createElement("p", { className: "text-sm font-semibold text-neutral-900 mb-1" }, "Property owners"),
                                              React.createElement(
                                                          "div",
                                                          { className: "flex flex-wrap gap-x-6" },
                                                          React.createElement(Link, { href: "/about#foco", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-[#97183C] underline decoration-[#97183C]/30 underline-offset-4 hover-fine:decoration-[#97183C]" }, "Our FOCO model"),
                                                          React.createElement("a", { href: "/partner-onboarding.html", className: "inline-flex items-center min-h-[44px] text-sm font-semibold text-[#97183C] underline decoration-[#97183C]/30 underline-offset-4 hover-fine:decoration-[#97183C]" }, "Partner With Us")
                                                        )
                                            )
                                  ),
                        React.createElement(
                                    "div",
                                    { className: "grid sm:grid-cols-2 gap-4" },
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
                                    { className: "relative overflow-hidden bg-[#F5F1EA] rounded-md p-6 sm:p-8" },
                                    React.createElement("div", { className: "absolute inset-y-0 right-0 w-1/3 rb-jaali-light hidden md:block", "aria-hidden": true }),
                                    React.createElement(
                                                "div",
                                                { className: "relative" },
                                                React.createElement("p", { className: labelClass }, "Destinations"),
                                                React.createElement(
                                                              "p",
                                                    { className: "text-lg text-neutral-900" },
                                                              "Jaipur, Alwar, Sariska, and Agra (coming soon)"
                                                            )
                                              )
                                  )
                      )
            );
}

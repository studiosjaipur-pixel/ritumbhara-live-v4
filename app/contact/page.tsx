import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
      title: "Contact",
      description: "Get in touch with Ritumbhara for reservations support, partnerships, or general enquiries.",
      alternates: { canonical: "/contact" },
};

export default function ContactPage() {
      return React.createElement(
              "main",
          { className: "pt-32 pb-24 px-6 md:px-16 max-w-3xl mx-auto" },
              React.createElement(
                        "h1",
                  { className: "text-4xl md:text-5xl font-semibold text-neutral-900 mb-6" },
                        "Contact Us"
                      ),
              React.createElement(
                        "p",
                  { className: "text-neutral-600 text-lg mb-12" },
                        "For reservations, please book directly through each property's page. For partnerships, press, or general questions, reach us below."
                      ),
              React.createElement(
                        "div",
                  { className: "space-y-8" },
                        React.createElement(
                                    "div",
                                    null,
                                    React.createElement("p", { className: "text-sm uppercase tracking-wide text-neutral-400 mb-1" }, "Phone"),
                                    React.createElement(
                                                  "a",
                                        { href: "tel:+919503002629", className: "text-xl text-neutral-900 hover:text-[#97183C]" },
                                                  "+91 95030 02629"
                                                )
                                  ),
                        React.createElement(
                                    "div",
                                    null,
                                    React.createElement("p", { className: "text-sm uppercase tracking-wide text-neutral-400 mb-1" }, "Email"),
                                    React.createElement(
                                                  "a",
                                        { href: "mailto:studios.jaipur@gmail.com", className: "text-xl text-neutral-900 hover:text-[#97183C]" },
                                                  "studios.jaipur@gmail.com"
                                                )
                                  ),
                        React.createElement(
                                    "div",
                                    null,
                                    React.createElement("p", { className: "text-sm uppercase tracking-wide text-neutral-400 mb-1" }, "Destinations"),
                                    React.createElement(
                                                  "p",
                                        { className: "text-xl text-neutral-900" },
                                                  "Jaipur, Alwar, Sariska, and Agra (coming soon)"
                                                )
                                  )
                      )
            );
}

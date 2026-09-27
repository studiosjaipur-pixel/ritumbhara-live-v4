import { Metadata } from "next";
import React from "react";
import Link from "next/link";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";
import LeadCaptureForm from "@/components/LeadCaptureForm";
import { socialMetadata } from "@/lib/seo";

const pageTitle = "Boutique Stays Near Sariska | Ritumbhara";
const pageDescription = "Villas and farm stays near Sariska Tiger Reserve, Alwar district, Rajasthan. Close to Neelkanth Mahadev Temple, Pandupol, and Kankwari Fort. Airbnb Superhost.";

export const metadata: Metadata = {
    title: { absolute: pageTitle },
    description: pageDescription,
    alternates: { canonical: "/stays-in-sariska" },
    ...socialMetadata("/stays-in-sariska", pageTitle, pageDescription),
};

const faqs = [
  {
        q: "How far is the villa from Alwar city?",
        a: "The property is a straightforward 12 km (about 30 minutes) drive from Alwar city. Free, ample parking is available on the premises for multiple vehicles.",
  },
  {
        q: "How do I get there from Delhi?",
        a: "Approximately 160 km via NH48 and NH248A, around 3 to 3.5 hours — a comfortable weekend road trip.",
  },
  {
        q: "How do I get there from Jaipur?",
        a: "Approximately 150 km via NH48, around 2.5 to 3 hours by road.",
  },
  {
        q: "Can I reach the villa by train?",
        a: "Alwar Railway Station is 15 km away and well-connected to Delhi, Jaipur, and other major cities. From the station, you can hire a local cab to reach the property — our co-host is also happy to help with reliable local taxi recommendations for arrival or sightseeing.",
  },
  {
        q: "What's the final stretch of the drive like?",
        a: "The last stretch leading to the property passes through a beautiful, rustic rural area. Standard cars access it daily, but an SUV or high-clearance vehicle is recommended for maximum comfort, especially during the monsoon season.",
  },
  {
        q: "Is there anything to see besides the villa itself?",
        a: "Sariska Tiger Reserve, with its Neelkanth Mahadev Temple, Pandupol Hanuman Temple, and Kankwari Fort, is nearby, and Alwar city adds Bala Quila Fort and Siliserh Lake for a day trip.",
  },
  {
        q: "Can I book directly instead of through an OTA?",
        a: "Yes — booking directly with Ritumbhara gets you the same or better rates than Airbnb or other platforms, with no platform fees and direct WhatsApp support.",
  },
  ];

// FAQPage structured data generated from the same FAQs shown on this page.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(function (f) {
    return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } };
  }),
};

export default function SariskaStaysPage() {
    return React.createElement(
          "main",
      { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-28 lg:pt-32 pb-24" },
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(faqSchema) } }),
          React.createElement(
                  "section",
            { className: "pt-6 pb-10 md:pb-12 border-b border-line" },
                  React.createElement("p", { className: "flex items-center gap-3 text-sm font-medium text-sage mb-3" }, React.createElement("span", { "aria-hidden": true, className: "h-px w-8 bg-burgundy" }), "Sariska"),
                  React.createElement("h1", { className: "text-[2.6rem] md:text-[3.25rem] lg:text-[3.75rem] text-charcoal leading-[1.04] mb-6" }, "Boutique Stays Near Sariska"),
                  React.createElement("p", { className: "text-lg text-charcoal-soft max-w-2xl mb-8" }, "Villas and farm stays close to Sariska Tiger Reserve, set in the Aravalli hills of Alwar district. A quieter alternative to Jaipur's city hotels."),
                  React.createElement(
                            "div",
                    { className: "flex" },
                            React.createElement(CheckAvailabilityWidget, { variant: "inline" })
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "About Sariska"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-4" }, "This villa sits in a scenic, rural stretch of the Alwar district, just 12 km from Alwar city and within easy reach of Sariska Tiger Reserve — home to the 6th-century Neelkanth Mahadev Temple, the Pandupol Hanuman Temple, and Kankwari Fort, all set in the Aravalli hills."),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed" }, "Staying here puts you close to jeep safaris and the reserve's temples, while Alwar city's Bala Quila Fort and Siliserh Lake are a short drive away for a day trip.")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "Getting There"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-6" }, "Getting around is easy with a private vehicle, which is highly recommended given the scenic, rural location."),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "By Car / Self-Drive"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-charcoal-soft mb-6" },
                            React.createElement("li", null, "From Alwar city: 12 km, about 30 minutes. Free, ample on-site parking for multiple vehicles."),
                            React.createElement("li", null, "From Delhi: approximately 160 km via NH48 and NH248A, around 3 to 3.5 hours."),
                            React.createElement("li", null, "From Jaipur: approximately 150 km via NH48, around 2.5 to 3 hours.")
                          ),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "By Train & Taxi"),
                  React.createElement("p", { className: "text-charcoal-soft leading-relaxed mb-6" }, "Alwar Railway Station is 15 km away and well-connected to Delhi, Jaipur, and other major cities. From the station, hire a local cab to reach the property — our co-host is also happy to help with reliable local taxi recommendations for arrival or sightseeing."),
                  React.createElement("h3", { className: "text-sm font-semibold text-sage mt-2 mb-2" }, "Nearby Essentials"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-charcoal-soft mb-6" },
                            React.createElement("li", null, "Petrol station: ~8 km"),
                            React.createElement("li", null, "Grocery & local market: ~10 km"),
                            React.createElement("li", null, "ATM & pharmacy: ~10–12 km (in Alwar city)")
                          ),
                  React.createElement("p", { className: "text-sm text-charcoal-muted italic" }, "Please note: the final stretch leading to the property passes through a beautiful, rustic rural area. While standard cars access it daily, an SUV or high-clearance vehicle is recommended for maximum comfort, especially during the monsoon season.")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 border-t border-line" },
                  React.createElement(
                            "div",
                    { className: "max-w-3xl" },
                            React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-5" }, "Why Book Direct"),
                            React.createElement(
                                        "ul",
                              { className: "space-y-3 text-charcoal-soft" },
                                        React.createElement("li", null, "• Same or better rates than Airbnb and other OTAs — no platform markup"),
                                        React.createElement("li", null, "• Direct WhatsApp support before, during, and after your stay"),
                                        React.createElement("li", null, "• Airbnb Superhost track record, verified guest reviews")
                                      )
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 max-w-3xl" },
                  React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-6" }, "Frequently Asked Questions"),
                  React.createElement(
                            "div",
                    { className: "divide-y divide-line border-y border-line" },
                            faqs.map((item, i) =>
                                        React.createElement(
                                                      "div",
                                          { key: i, className: "py-5" },
                                                      React.createElement("h3", { className: "font-semibold text-[17px] text-charcoal mb-1.5" }, item.q),
                                                      React.createElement("p", { className: "text-charcoal-soft leading-relaxed" }, item.a)
                                                    )
                                             )
                          )
                ),
          React.createElement(
                  "section",
            { className: "pb-12 max-w-3xl" },
                  React.createElement(Link, { href: "/destinations/sariska", className: "inline-flex items-center min-h-[44px] text-burgundy font-semibold underline decoration-burgundy/30 underline-offset-4 hover:decoration-burgundy" }, "See the full Sariska destination guide →")
                ),
          React.createElement(
                  "section",
            { className: "py-10 md:py-12 border-t border-line" },
                  React.createElement(
                            "div",
                    { className: "max-w-xl mx-auto text-center" },
                            React.createElement("h2", { className: "text-3xl md:text-[2.5rem] text-charcoal mb-6" }, "Check Availability Near Sariska"),
                            React.createElement(
                                        "div",
                              { className: "flex justify-center" },
                                        React.createElement(LeadCaptureForm, {
                                                      title: "Check Availability Near Sariska",
                                                      subtitle: "We'll get back to you directly — no OTA fees, real-time human answers.",
                                                      defaultDestination: "sariska",
                                        })
                                      )
                          )
                )
        );
}

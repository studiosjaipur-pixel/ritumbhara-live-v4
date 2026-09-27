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
      { className: "max-w-5xl mx-auto px-6 pt-28 lg:pt-32 pb-24" },
    React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(faqSchema) } }),
          React.createElement(
                  "section",
            { className: "relative overflow-hidden rounded-md bg-[#F5F1EA] px-5 py-10 md:py-14 text-center" },
                  React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "Sariska"),
                  React.createElement("h1", { className: "text-4xl md:text-5xl lg:text-6xl font-semibold text-[#1A1A1A] leading-[1.08] mb-6" }, "Boutique Stays Near Sariska"),
                  React.createElement("p", { className: "text-lg text-[#4A4A4A] max-w-2xl mx-auto mb-8" }, "Villas and farm stays close to Sariska Tiger Reserve, set in the Aravalli hills of Alwar district. A quieter alternative to Jaipur's city hotels."),
                  React.createElement(
                            "div",
                    { className: "flex justify-center" },
                            React.createElement(CheckAvailabilityWidget, { variant: "inline" })
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-12 max-w-3xl mx-auto" },
                  React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-5" }, "About Sariska"),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed mb-4" }, "This villa sits in a scenic, rural stretch of the Alwar district, just 12 km from Alwar city and within easy reach of Sariska Tiger Reserve — home to the 6th-century Neelkanth Mahadev Temple, the Pandupol Hanuman Temple, and Kankwari Fort, all set in the Aravalli hills."),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed" }, "Staying here puts you close to jeep safaris and the reserve's temples, while Alwar city's Bala Quila Fort and Siliserh Lake are a short drive away for a day trip.")
                ),
          React.createElement(
                  "section",
            { className: "py-12 max-w-3xl mx-auto" },
                  React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-5" }, "Getting There"),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed mb-6" }, "Getting around is easy with a private vehicle, which is highly recommended given the scenic, rural location."),
                  React.createElement("h3", { className: "font-semibold text-[#97183C] mt-2 mb-2" }, "By Car / Self-Drive"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-[#4A4A4A] mb-6" },
                            React.createElement("li", null, "From Alwar city: 12 km, about 30 minutes. Free, ample on-site parking for multiple vehicles."),
                            React.createElement("li", null, "From Delhi: approximately 160 km via NH48 and NH248A, around 3 to 3.5 hours."),
                            React.createElement("li", null, "From Jaipur: approximately 150 km via NH48, around 2.5 to 3 hours.")
                          ),
                  React.createElement("h3", { className: "font-semibold text-[#97183C] mt-2 mb-2" }, "By Train & Taxi"),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed mb-6" }, "Alwar Railway Station is 15 km away and well-connected to Delhi, Jaipur, and other major cities. From the station, hire a local cab to reach the property — our co-host is also happy to help with reliable local taxi recommendations for arrival or sightseeing."),
                  React.createElement("h3", { className: "font-semibold text-[#97183C] mt-2 mb-2" }, "Nearby Essentials"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-[#4A4A4A] mb-6" },
                            React.createElement("li", null, "Petrol station: ~8 km"),
                            React.createElement("li", null, "Grocery & local market: ~10 km"),
                            React.createElement("li", null, "ATM & pharmacy: ~10–12 km (in Alwar city)")
                          ),
                  React.createElement("p", { className: "text-sm text-[#8A8A8A] italic" }, "Please note: the final stretch leading to the property passes through a beautiful, rustic rural area. While standard cars access it daily, an SUV or high-clearance vehicle is recommended for maximum comfort, especially during the monsoon season.")
                ),
          React.createElement(
                  "section",
            { className: "py-12 border-t border-[#EDE7DD]" },
                  React.createElement(
                            "div",
                    { className: "max-w-3xl mx-auto" },
                            React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-5" }, "Why Book Direct"),
                            React.createElement(
                                        "ul",
                              { className: "space-y-3 text-[#4A4A4A]" },
                                        React.createElement("li", null, "• Same or better rates than Airbnb and other OTAs — no platform markup"),
                                        React.createElement("li", null, "• Direct WhatsApp support before, during, and after your stay"),
                                        React.createElement("li", null, "• Airbnb Superhost track record, verified guest reviews")
                                      )
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-12 max-w-3xl mx-auto" },
                  React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-6" }, "Frequently Asked Questions"),
                  React.createElement(
                            "div",
                    { className: "divide-y divide-[#EDE7DD] border-y border-[#EDE7DD]" },
                            faqs.map((item, i) =>
                                        React.createElement(
                                                      "div",
                                          { key: i, className: "py-5" },
                                                      React.createElement("h3", { className: "font-semibold text-lg text-[#1A1A1A] mb-1.5" }, item.q),
                                                      React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed" }, item.a)
                                                    )
                                             )
                          )
                ),
          React.createElement(
                  "section",
            { className: "pb-12 max-w-3xl mx-auto text-center" },
                  React.createElement(Link, { href: "/destinations/sariska", className: "inline-flex items-center min-h-[44px] text-[#97183C] font-medium underline underline-offset-4 hover:text-[#7E1433]" }, "See the full Sariska destination guide →")
                ),
          React.createElement(
                  "section",
            { className: "py-12 border-t border-[#EDE7DD]" },
                  React.createElement(
                            "div",
                    { className: "max-w-xl mx-auto text-center" },
                            React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-6" }, "Check Availability Near Sariska"),
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

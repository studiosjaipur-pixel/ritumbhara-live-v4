import { Metadata } from "next";
import React from "react";
import Link from "next/link";
import CheckAvailabilityWidget from "@/components/CheckAvailabilityWidget";
import LeadCaptureForm from "@/components/LeadCaptureForm";

export const metadata: Metadata = {
    title: "Serviced Apartments in Jaipur | Ritumbhara",
    description: "Fully serviced apartments in Jaipur, close to the city's forts and old-city landmarks. Airbnb Superhost, book direct with Ritumbhara.",
};

const faqs = [
  { q: "Where exactly are the apartments located?", a: "In Karolan Ka Barh, Jeerota village — about 19 km from central Jaipur, close to both local life and city amenities." },
  { q: "How far is the airport?", a: "Jaipur International Airport (JAI, Sanganer) is around 15 km away, about a 26-minute drive." },
  { q: "Is the property well connected by train?", a: "Yes — Getor Jagatpura Railway Station is about 7–8 km away (7–10 minutes), Gandhinagar Jaipur Station is 10–12 km (14–15 minutes), Durgapura Railway Station is a 15–20 minute drive, and the Main Jaipur Railway Station is 18–20.7 km." },
  { q: "What's nearby for sightseeing?", a: "Chokhi Dhani is about 6 minutes by car, the Jaipur Exhibition & Convention Centre about 7 minutes, World Trade Park about 12 minutes, and Hawa Mahal and City Palace are each about 20 minutes away." },
  { q: "How do guests get around?", a: "Uber and Ola operate throughout Jaipur and reach the property easily. For the tourist circuit, booking a self-drive car or hiring a cab for the day is the most comfortable option — we're also happy to help with route details, transport bookings, or maps for local sightseeing." },
  { q: "Are these suitable for longer stays?", a: "Yes — the apartment format with kitchen and living space tends to work better than a hotel room for stays of a week or more." },
  { q: "Can I book directly instead of through an OTA?", a: "Yes — booking directly with Ritumbhara gets you the same or better rates than Airbnb or other platforms, with no platform fees and direct WhatsApp support." },
  ];

export default function JaipurServicedApartmentsPage() {
    return React.createElement(
          "main",
      { className: "max-w-5xl mx-auto px-6 pt-32 pb-24" },
          React.createElement(
                  "section",
            { className: "py-8 md:py-12 text-center" },
                  React.createElement("p", { className: "uppercase tracking-[0.2em] text-xs text-[#C8A96A] font-semibold mb-3" }, "Jaipur"),
                  React.createElement("h1", { className: "text-4xl md:text-5xl font-semibold text-[#1A1A1A] mb-6" }, "Serviced Apartments in Jaipur"),
                  React.createElement("p", { className: "text-lg text-[#4A4A4A] max-w-2xl mx-auto mb-8" }, "Comfortable, fully serviced apartments in Jaipur — a practical base for exploring the Pink City's forts, palaces, and bazaars."),
                  React.createElement(
                            "div",
                    { className: "flex justify-center" },
                            React.createElement(CheckAvailabilityWidget, { variant: "inline" })
                          )
                ),
          React.createElement(
                  "section",
            { className: "py-12 max-w-3xl mx-auto" },
                  React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-4" }, "About Jaipur"),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed mb-4" }, "These serviced apartments sit in Karolan Ka Barh, Jeerota village — about 19 km from central Jaipur, close to both local life and city amenities. Central Jaipur's landmarks — Hawa Mahal, City Palace, and Jantar Mantar — along with the hilltop Amber Fort and Nahargarh Fort, are all a manageable drive away."),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed" }, "A serviced apartment gives more space and flexibility than a hotel room — useful for longer stays, families, or anyone who wants a kitchen and living area rather than just a room.")
                ),
          React.createElement(
                  "section",
            { className: "py-12 max-w-3xl mx-auto" },
                  React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-4" }, "Getting Around"),
                  React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-2" }, "By Air"),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed mb-6" }, "Jaipur International Airport (JAI, Sanganer) is around 15 km away, about a 26-minute drive by car or taxi."),
                  React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-2" }, "By Train"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-[#4A4A4A] mb-6" },
                            React.createElement("li", null, "Getor Jagatpura Railway Station: ~7–8 km (approx. 7–10 minutes)"),
                            React.createElement("li", null, "Gandhinagar Jaipur Station: ~10–12 km (approx. 14–15 minutes)"),
                            React.createElement("li", null, "Durgapura Railway Station: 15–20 minute drive"),
                            React.createElement("li", null, "Main Jaipur Railway Station: 18–20.7 km")
                          ),
                  React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-2" }, "Popular Local Spots Nearby (~5 km radius)"),
                  React.createElement(
                            "ul",
                    { className: "space-y-2 text-[#4A4A4A] mb-6" },
                            React.createElement("li", null, "Chokhi Dhani: ~6 minutes by car"),
                            React.createElement("li", null, "Jaipur Exhibition & Convention Center: ~7 minutes"),
                            React.createElement("li", null, "World Trade Park: ~12 minutes"),
                            React.createElement("li", null, "Hawa Mahal & City Palace: ~20 minutes each")
                          ),
                  React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-2" }, "Car & Cab Travel"),
                  React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed" }, "Ride-hailing services like Uber and Ola operate throughout Jaipur and reach the property easily. To explore Jaipur's tourist circuit, booking a self-drive car or hiring a cab for the day is the most comfortable option — we're also happy to help with route details, transport bookings, or maps for local sightseeing if you'd like a more local experience.")
                ),
          React.createElement(
                  "section",
            { className: "py-12 border-t border-[#EDE7DD]" },
                  React.createElement(
                            "div",
                    { className: "max-w-3xl mx-auto" },
                            React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-4" }, "Why Book Direct"),
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
                    { className: "space-y-6" },
                            faqs.map((item, i) =>
                                        React.createElement(
                                                      "div",
                                          { key: i },
                                                      React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-1" }, item.q),
                                                      React.createElement("p", { className: "text-[#4A4A4A] leading-relaxed" }, item.a)
                                                    )
                                             )
                          )
                ),
          React.createElement(
                  "section",
            { className: "pb-12 max-w-3xl mx-auto text-center" },
                  React.createElement(Link, { href: "/destinations/jaipur", className: "text-[#97183C] font-medium underline hover:text-[#7E1433]" }, "See the full Jaipur destination guide →")
                ),
          React.createElement(
                  "section",
            { className: "py-12 border-t border-[#EDE7DD]" },
                  React.createElement(
                            "div",
                    { className: "max-w-xl mx-auto text-center" },
                            React.createElement("h2", { className: "text-2xl md:text-3xl font-semibold text-[#1A1A1A] mb-6" }, "Check Availability in Jaipur"),
                            React.createElement(
                                        "div",
                              { className: "flex justify-center" },
                                        React.createElement(LeadCaptureForm, {
                                                      title: "Check Availability in Jaipur",
                                                      subtitle: "We'll get back to you directly — no OTA fees, real-time human answers.",
                                                      defaultDestination: "jaipur",
                                        })
                                      )
                          )
                )
        );
}

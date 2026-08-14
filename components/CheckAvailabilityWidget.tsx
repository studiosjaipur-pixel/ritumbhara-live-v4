"use client";
import { useState } from "react";
import React from "react";
import { destinations } from "@/config/destinations.config";

export default function CheckAvailabilityWidget({ variant }: { variant?: "hero" | "inline" }) {
  const operationalDestinations = destinations.filter(function (d) { return d.status === "operational"; });
  const [destinationSlug, setDestinationSlug] = useState(operationalDestinations[0] ? operationalDestinations[0].slug : "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");

  function buildWhatsAppLink() {
    const destination = destinations.find(function (d) { return d.slug === destinationSlug; });
    const destName = destination ? destination.name : "a Ritumbhara stay";
    let message = "Hi, I'd like to check availability in " + destName;
    if (checkIn && checkOut) {
      message += " from " + checkIn + " to " + checkOut;
    } else if (checkIn) {
      message += " from " + checkIn;
    }
    message += " for " + guests + " guest" + (guests === "1" ? "" : "s") + ".";
    return "https://wa.me/919503002629?text=" + encodeURIComponent(message);
  }

  const isHero = variant !== "inline";

  return React.createElement("div", {
    className: (isHero
      ? "bg-white rounded-md p-5 lg:p-6 shadow-xl max-w-2xl"
      : "bg-[#F5F1EA] border border-[#EDE7DD] rounded-md p-6 max-w-2xl")
  },
    React.createElement("div", { className: "grid sm:grid-cols-4 gap-3 mb-4" },
      React.createElement("div", { className: "sm:col-span-1 flex flex-col" },
        React.createElement("label", { className: "text-xs font-medium text-[#4A4A4A] mb-1" }, "Destination"),
        React.createElement("select", {
          value: destinationSlug,
          onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { setDestinationSlug(e.target.value); },
          className: "border border-[#EDE7DD] rounded-md px-2 py-2 text-sm text-[#1A1A1A] bg-white",
        },
          operationalDestinations.map(function (d) {
            return React.createElement("option", { key: d.slug, value: d.slug }, d.name);
          })
        )
      ),
      React.createElement("div", { className: "sm:col-span-1 flex flex-col" },
        React.createElement("label", { className: "text-xs font-medium text-[#4A4A4A] mb-1" }, "Check-in"),
        React.createElement("input", {
          type: "date",
          value: checkIn,
          onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setCheckIn(e.target.value); },
          className: "border border-[#EDE7DD] rounded-md px-2 py-2 text-sm text-[#1A1A1A] bg-white",
        })
      ),
      React.createElement("div", { className: "sm:col-span-1 flex flex-col" },
        React.createElement("label", { className: "text-xs font-medium text-[#4A4A4A] mb-1" }, "Check-out"),
        React.createElement("input", {
          type: "date",
          value: checkOut,
          onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setCheckOut(e.target.value); },
          className: "border border-[#EDE7DD] rounded-md px-2 py-2 text-sm text-[#1A1A1A] bg-white",
        })
      ),
      React.createElement("div", { className: "sm:col-span-1 flex flex-col" },
        React.createElement("label", { className: "text-xs font-medium text-[#4A4A4A] mb-1" }, "Guests"),
        React.createElement("select", {
          value: guests,
          onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { setGuests(e.target.value); },
          className: "border border-[#EDE7DD] rounded-md px-2 py-2 text-sm text-[#1A1A1A] bg-white",
        },
          ["1", "2", "3", "4", "5", "6+"].map(function (g) {
            return React.createElement("option", { key: g, value: g }, g);
          })
        )
      )
    ),
    React.createElement("a", {
      href: buildWhatsAppLink(),
      target: "_blank",
      rel: "noopener",
      className: "block text-center bg-[#97183C] text-white font-medium py-3 rounded-md hover:bg-[#7E1433] transition-colors",
    }, "Check Availability via WhatsApp"),
    React.createElement("p", { className: "text-xs text-center text-[#8A8A8A] mt-3" }, "We reply directly \u2014 no OTA fees, real-time human answers")
  );
}

"use client";
import { useState, useId } from "react";
import React from "react";
import { destinations } from "@/config/destinations.config";

export default function CheckAvailabilityWidget({ variant }: { variant?: "hero" | "inline" }) {
  const operationalDestinations = destinations.filter(function (d) { return d.status === "operational"; });
  const [destinationSlug, setDestinationSlug] = useState(operationalDestinations[0] ? operationalDestinations[0].slug : "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const uid = useId();

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
      ? "bg-white rounded-md p-5 lg:p-6 shadow-[0_24px_48px_rgba(0,0,0,0.22)] max-w-2xl"
      : "bg-white border border-[#EDE7DD] rounded-md p-5 sm:p-6 max-w-2xl shadow-[0_8px_24px_rgba(26,26,26,0.05)]")
  },
    React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" },
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-dest", className: "text-xs font-semibold text-[#4A4A4A] mb-1.5" }, "Destination"),
        React.createElement("select", {
          id: uid + "-dest",
          value: destinationSlug,
          onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { setDestinationSlug(e.target.value); },
          className: "w-full min-h-[44px] border border-[#DDD3C2] rounded-md px-3 py-2 text-sm text-[#1A1A1A] bg-white hover-fine:border-[#C8A96A] focus:border-[#97183C] transition-colors",
        },
          operationalDestinations.map(function (d) {
            return React.createElement("option", { key: d.slug, value: d.slug }, d.name);
          })
        )
      ),
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-in", className: "text-xs font-semibold text-[#4A4A4A] mb-1.5" }, "Check-in"),
        React.createElement("input", {
          type: "date",
          id: uid + "-in",
          value: checkIn,
          onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setCheckIn(e.target.value); },
          className: "w-full min-h-[44px] border border-[#DDD3C2] rounded-md px-3 py-2 text-sm text-[#1A1A1A] bg-white hover-fine:border-[#C8A96A] focus:border-[#97183C] transition-colors",
        })
      ),
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-out", className: "text-xs font-semibold text-[#4A4A4A] mb-1.5" }, "Check-out"),
        React.createElement("input", {
          type: "date",
          id: uid + "-out",
          value: checkOut,
          onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setCheckOut(e.target.value); },
          className: "w-full min-h-[44px] border border-[#DDD3C2] rounded-md px-3 py-2 text-sm text-[#1A1A1A] bg-white hover-fine:border-[#C8A96A] focus:border-[#97183C] transition-colors",
        })
      ),
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-guests", className: "text-xs font-semibold text-[#4A4A4A] mb-1.5" }, "Guests"),
        React.createElement("select", {
          id: uid + "-guests",
          value: guests,
          onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { setGuests(e.target.value); },
          className: "w-full min-h-[44px] border border-[#DDD3C2] rounded-md px-3 py-2 text-sm text-[#1A1A1A] bg-white hover-fine:border-[#C8A96A] focus:border-[#97183C] transition-colors",
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
      className: "flex items-center justify-center min-h-[48px] text-center bg-[#97183C] text-white font-semibold py-3 rounded-md hover-fine:bg-[#7E1433] active:scale-[0.98] active:duration-100 active:ease-out transition-[background-color,transform] duration-200 ease-snap",
    }, "Check Availability via WhatsApp"),
    React.createElement("p", { className: "text-xs text-center text-[#8A8A8A] mt-3" }, "We reply directly \u2014 no OTA fees, real-time human answers")
  );
}

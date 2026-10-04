"use client";
import { useState, useId } from "react";
import React from "react";
import { usePathname } from "next/navigation";
import { destinations } from "@/config/destinations.config";
import { buildWhatsAppUrl, makeWhatsAppRef, pageRefFromPath } from "@/lib/whatsapp";

export default function CheckAvailabilityWidget({ variant }: { variant?: "hero" | "inline" }) {
  const operationalDestinations = destinations.filter(function (d) { return d.status === "operational"; });
  const [destinationSlug, setDestinationSlug] = useState(operationalDestinations[0] ? operationalDestinations[0].slug : "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const uid = useId();
  // Reference code from the page this widget is on, e.g. W-HOME-AVAILABILITY or W-DEST-jaipur-AVAILABILITY.
  const waRef = makeWhatsAppRef(pageRefFromPath(usePathname() || "/"), "AVAILABILITY");

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
    return buildWhatsAppUrl(message, waRef);
  }

  const isHero = variant !== "inline";

  return React.createElement("div", {
    className: (isHero
      ? "bg-sand/70 border-t-2 border-burgundy rounded-sm p-5 lg:p-6 max-w-xl"
      : "bg-sand/70 border-t-2 border-burgundy rounded-sm p-5 sm:p-6 max-w-2xl")
  },
    React.createElement("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" + (isHero ? " lg:grid-cols-2 xl:grid-cols-4" : "") },
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-dest", className: "text-xs font-semibold text-charcoal-soft mb-1.5" }, "Destination"),
        React.createElement("select", {
          id: uid + "-dest",
          value: destinationSlug,
          onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { setDestinationSlug(e.target.value); },
          className: "w-full min-h-[44px] border border-line rounded-sm px-3 py-2 text-sm text-charcoal bg-ivory hover-fine:border-charcoal-muted focus:border-burgundy transition-colors",
        },
          operationalDestinations.map(function (d) {
            return React.createElement("option", { key: d.slug, value: d.slug }, d.name);
          })
        )
      ),
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-in", className: "text-xs font-semibold text-charcoal-soft mb-1.5" }, "Check-in"),
        React.createElement("input", {
          type: "date",
          id: uid + "-in",
          value: checkIn,
          onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setCheckIn(e.target.value); },
          className: "w-full min-h-[44px] border border-line rounded-sm px-3 py-2 text-sm text-charcoal bg-ivory hover-fine:border-charcoal-muted focus:border-burgundy transition-colors",
        })
      ),
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-out", className: "text-xs font-semibold text-charcoal-soft mb-1.5" }, "Check-out"),
        React.createElement("input", {
          type: "date",
          id: uid + "-out",
          value: checkOut,
          onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setCheckOut(e.target.value); },
          className: "w-full min-h-[44px] border border-line rounded-sm px-3 py-2 text-sm text-charcoal bg-ivory hover-fine:border-charcoal-muted focus:border-burgundy transition-colors",
        })
      ),
      React.createElement("div", { className: "col-span-1 flex flex-col min-w-0" },
        React.createElement("label", { htmlFor: uid + "-guests", className: "text-xs font-semibold text-charcoal-soft mb-1.5" }, "Guests"),
        React.createElement("select", {
          id: uid + "-guests",
          value: guests,
          onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { setGuests(e.target.value); },
          className: "w-full min-h-[44px] border border-line rounded-sm px-3 py-2 text-sm text-charcoal bg-ivory hover-fine:border-charcoal-muted focus:border-burgundy transition-colors",
        },
          ["1", "2", "3", "4", "5", "6+"].map(function (g) {
            return React.createElement("option", { key: g, value: g }, g);
          })
        )
      )
    ),
    React.createElement("a", {
      href: buildWhatsAppLink(),
      // Context for click tracking (components/WhatsAppClickTracker.tsx). Booking details only, no personal data.
      "data-wa-ref": waRef,
      "data-wa-cta": "availability",
      "data-wa-destination": destinationSlug,
      "data-wa-check-in": checkIn,
      "data-wa-check-out": checkOut,
      "data-wa-guests": guests,
      target: "_blank",
      rel: "noopener",
      className: "flex items-center justify-center min-h-[48px] text-center bg-burgundy text-ivory font-semibold py-3 rounded-sm hover-fine:bg-burgundy-deep active:scale-[0.98] active:duration-100 active:ease-out transition-[background-color,transform] duration-200 ease-snap",
    }, "Check Availability via WhatsApp"),
    React.createElement("p", { className: "text-xs text-center text-charcoal-muted mt-3" }, "We reply directly \u2014 no OTA fees, real-time human answers")
  );
}

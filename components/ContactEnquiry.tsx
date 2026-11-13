"use client";
import { useEffect, useId, useState } from "react";
import { destinations } from "@/config/destinations.config";
import { useTrip } from "@/lib/useTrip";
import { formatLong, nightsBetween, plural, todayISO, validateDates } from "@/lib/trip";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import DateGuestFields, { fieldClass, labelClass } from "@/components/DateGuestFields";

const REF = "W-CONTACT-ENQUIRY";

// A short reservation enquiry. It builds one clear WhatsApp message (or an email, if the visitor prefers) from
// the details entered, so the team has everything needed to answer in one go. Nothing is stored or sent from
// this page itself; the visitor sends the message from WhatsApp or their email app.
export default function ContactEnquiry() {
  const operational = destinations.filter(function (d) { return d.status === "operational"; });
  const [trip, update] = useTrip();
  const [today, setToday] = useState("");
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const uid = useId();

  useEffect(function () { setToday(todayISO()); }, []);
  useEffect(function () {
    if (!destination && trip.destination) setDestination(trip.destination);
  }, [trip.destination, destination]);

  const nameError = touched && name.trim().length < 2 ? "Please tell us your name." : "";
  const dateError = validateDates(trip.checkIn, trip.checkOut, today);
  const valid = name.trim().length >= 2 && !dateError;

  const destName = (destinations.find(function (d) { return d.slug === destination; }) || { name: "" }).name;
  const hasRange = !!(trip.checkIn && trip.checkOut && trip.checkOut > trip.checkIn);

  const lines: string[] = [];
  lines.push("Hi, I'm " + name.trim() + ". I'd like to enquire about a stay" + (destName ? " in " + destName : "") + ".");
  if (hasRange) lines.push("Dates: " + formatLong(trip.checkIn) + " to " + formatLong(trip.checkOut) + " (" + plural(nightsBetween(trip.checkIn, trip.checkOut), "night") + ")");
  lines.push("Guests: " + trip.guests);
  if (note.trim()) lines.push("Notes: " + note.trim());
  const message = lines.join("\n");

  const waHref = buildWhatsAppUrl(message, REF);
  const mailHref = "mailto:studios.jaipur@gmail.com?subject=" + encodeURIComponent("Stay enquiry" + (destName ? " – " + destName : "")) + "&body=" + encodeURIComponent(message);

  const primary = "flex items-center justify-center min-h-[48px] w-full text-center font-semibold py-3 px-4 rounded-sm active:scale-[0.98] transition-[background-color,transform] duration-200 ease-snap";

  return (
    <form
      onSubmit={function (e) { e.preventDefault(); setTouched(true); }}
      noValidate
      aria-labelledby={uid + "-title"}
      className="bg-sand/70 border-t-2 border-burgundy rounded-sm p-5 sm:p-7"
    >
      <h2 id={uid + "-title"} className="text-[1.75rem] leading-tight text-charcoal mb-1">Plan your stay</h2>
      <p className="text-sm text-charcoal-soft mb-5">Share a few details and we&rsquo;ll check availability for you. It takes under a minute.</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="flex flex-col min-w-0">
          <label htmlFor={uid + "-name"} className={labelClass}>Your name</label>
          <input
            id={uid + "-name"}
            type="text"
            autoComplete="name"
            value={name}
            onChange={function (e) { setName(e.target.value); }}
            onBlur={function () { setTouched(true); }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? uid + "-name-err" : undefined}
            className={fieldClass + (nameError ? " !border-burgundy" : "")}
          />
          {nameError && <p id={uid + "-name-err"} role="alert" className="text-xs text-burgundy font-medium mt-1.5">{nameError}</p>}
        </div>
        <div className="flex flex-col min-w-0">
          <label htmlFor={uid + "-dest"} className={labelClass}>Destination</label>
          <select
            id={uid + "-dest"}
            value={destination}
            onChange={function (e) { setDestination(e.target.value); update({ destination: e.target.value, property: "" }); }}
            className={fieldClass}
          >
            <option value="">Not sure yet</option>
            {operational.map(function (d) { return <option key={d.slug} value={d.slug}>{d.name}</option>; })}
          </select>
        </div>
      </div>

      <DateGuestFields trip={trip} update={update} today={today} />
      <div className="min-h-[1.25rem] mt-2 text-sm" aria-live="polite">
        {dateError && <p role="alert" className="text-burgundy font-medium">{dateError}</p>}
      </div>

      <div className="flex flex-col mt-3 mb-5">
        <label htmlFor={uid + "-note"} className={labelClass}>Anything we should know? (optional)</label>
        <textarea
          id={uid + "-note"}
          rows={3}
          value={note}
          maxLength={400}
          onChange={function (e) { setNote(e.target.value); }}
          placeholder="Celebration, early check-in, pets, long stay…"
          className={fieldClass}
        />
      </div>

      {valid ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <a
            href={waHref}
            target="_blank"
            rel="noopener"
            data-wa-ref={REF}
            data-wa-cta="contact-enquiry"
            data-wa-destination={destination}
            data-wa-check-in={trip.checkIn}
            data-wa-check-out={trip.checkOut}
            data-wa-guests={String(trip.guests)}
            className={primary + " bg-burgundy text-ivory hover-fine:bg-burgundy-deep"}
          >
            Send on WhatsApp
          </a>
          <a href={mailHref} className={primary + " border border-burgundy text-burgundy hover-fine:bg-burgundy hover-fine:text-ivory"}>
            Send by email instead
          </a>
        </div>
      ) : (
        <button type="submit" className={primary + " bg-burgundy text-ivory hover-fine:bg-burgundy-deep"}>
          Continue
        </button>
      )}
      <p className="text-xs text-center text-charcoal-muted mt-3">We reply directly {"—"} no OTA fees, real-time human answers</p>
    </form>
  );
}

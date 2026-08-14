"use client";
import { useState } from "react";
import React from "react";
import { destinations } from "@/config/destinations.config";
import { LEAD_CAPTURE_ENDPOINT } from "@/config/leadCapture.config";

type Status = "idle" | "submitting" | "success" | "error";

export default function LeadCaptureForm({ title, subtitle, defaultDestination }: { title?: string; subtitle?: string; defaultDestination?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [destinationSlug, setDestinationSlug] = useState(defaultDestination || "");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  if (!LEAD_CAPTURE_ENDPOINT) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    setStatus("submitting");
    try {
      const destination = destinations.find(function (d) { return d.slug === destinationSlug; });
      const res = await fetch(LEAD_CAPTURE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          name: name,
          email: email,
          destination: destination ? destination.name : "",
          message: message,
          source: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });
      if (res.ok) {
        setStatus("success");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
    }
  }

  if (status === "success") {
    return React.createElement("div", { className: "border border-[#EDE7DD] bg-[#F5F1EA] rounded-md p-6 text-center" },
      React.createElement("p", { className: "font-semibold text-[#1A1A1A] mb-1" }, "Thanks \u2014 you're on the list."),
      React.createElement("p", { className: "text-sm text-[#4A4A4A]" }, "We'll reach out as soon as there's news to share.")
    );
  }

  return React.createElement("form", { onSubmit: handleSubmit, className: "border border-[#EDE7DD] rounded-md p-6 max-w-xl" },
    title && React.createElement("h3", { className: "font-semibold text-[#1A1A1A] mb-1" }, title),
    subtitle && React.createElement("p", { className: "text-sm text-[#4A4A4A] mb-5" }, subtitle),
    React.createElement("div", { className: "grid sm:grid-cols-2 gap-3 mb-3" },
      React.createElement("input", {
        type: "text",
        placeholder: "Your name",
        value: name,
        required: true,
        onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setName(e.target.value); },
        className: "border border-[#EDE7DD] rounded-md px-3 py-2.5 text-sm",
      }),
      React.createElement("input", {
        type: "email",
        placeholder: "Email address",
        value: email,
        required: true,
        onChange: function (e: React.ChangeEvent<HTMLInputElement>) { setEmail(e.target.value); },
        className: "border border-[#EDE7DD] rounded-md px-3 py-2.5 text-sm",
      })
    ),
    React.createElement("select", {
      value: destinationSlug,
      onChange: function (e: React.ChangeEvent<HTMLSelectElement>) { setDestinationSlug(e.target.value); },
      className: "border border-[#EDE7DD] rounded-md px-3 py-2.5 text-sm w-full mb-3 bg-white",
    },
      React.createElement("option", { value: "" }, "Which destination interests you?"),
      destinations.map(function (d) {
        return React.createElement("option", { key: d.slug, value: d.slug }, d.name + (d.status === "coming-soon" ? " (Coming Soon)" : ""));
      })
    ),
    React.createElement("textarea", {
      placeholder: "Anything else we should know? (optional)",
      value: message,
      onChange: function (e: React.ChangeEvent<HTMLTextAreaElement>) { setMessage(e.target.value); },
      rows: 3,
      className: "border border-[#EDE7DD] rounded-md px-3 py-2.5 text-sm w-full mb-4",
    }),
    React.createElement("button", {
      type: "submit",
      disabled: status === "submitting",
      className: "w-full bg-[#97183C] text-white font-medium py-3 rounded-md disabled:opacity-60",
    }, status === "submitting" ? "Sending..." : "Notify Me"),
    status === "error" && React.createElement("p", { className: "text-xs text-center text-red-600 mt-3" }, "Something went wrong \u2014 please try WhatsApp or email instead.")
  );
}

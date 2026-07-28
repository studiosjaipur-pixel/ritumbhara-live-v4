"use client";

import React, { useState } from "react";

const CONTACT_EMAIL = "studios.jaipur@gmail.com";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!name.trim() || !email.trim() || !message.trim()) {
    setError("Please fill in your name, email, and message.");
    return;
  }
  setError("");
  const subject = "Website enquiry from " + name;
  const bodyLines = [
    "Name: " + name,
    "Email: " + email,
    "Phone: " + (phone || "Not provided"),
    "",
    message,
    ];
  const mailtoUrl =
    "mailto:" + CONTACT_EMAIL +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(bodyLines.join("\n"));
  window.location.href = mailtoUrl;
}

const inputClass = "w-full border border-[#EDE7DD] rounded-sm px-4 py-3 text-[#1A1A1A] focus:outline-none focus:border-[#97183C] transition-colors";

return React.createElement(
  "form",
  { onSubmit: handleSubmit, className: "space-y-5" },
  React.createElement(
    "div",
    null,
    React.createElement("label", { className: "block text-sm font-medium text-[#1A1A1A] mb-1.5" }, "Name"),
    React.createElement("input", {
      type: "text",
      value: name,
      onChange: function (e) { setName(e.target.value); },
      className: inputClass,
      placeholder: "Your full name",
    })
    ),
  React.createElement(
    "div",
    { className: "grid sm:grid-cols-2 gap-5" },
    React.createElement(
      "div",
      null,
      React.createElement("label", { className: "block text-sm font-medium text-[#1A1A1A] mb-1.5" }, "Email"),
      React.createElement("input", {
        type: "email",
        value: email,
        onChange: function (e) { setEmail(e.target.value); },
        className: inputClass,
        placeholder: "you@example.com",
      })
      ),
    React.createElement(
      "div",
      null,
      React.createElement("label", { className: "block text-sm font-medium text-[#1A1A1A] mb-1.5" }, "Phone (optional)"),
      React.createElement("input", {
        type: "tel",
        value: phone,
        onChange: function (e) { setPhone(e.target.value); },
        className: inputClass,
        placeholder: "+91 00000 00000",
      })
      )
    ),
  React.createElement(
    "div",
    null,
    React.createElement("label", { className: "block text-sm font-medium text-[#1A1A1A] mb-1.5" }, "Message"),
    React.createElement("textarea", {
      value: message,
      onChange: function (e) { setMessage(e.target.value); },
      className: inputClass,
      rows: 5,
      placeholder: "How can we help?",
    })
    ),
  error && React.createElement("p", { className: "text-sm text-red-600" }, error),
  React.createElement(
    "button",
    { type: "submit", className: "bg-[#97183C] text-white font-medium px-8 py-3.5 rounded-sm hover:bg-[#7E1433] transition-colors" },
    "Send Message"
    ),
  React.createElement(
    "p",
    { className: "text-xs text-neutral-400" },
    "Submitting opens your email app with this message pre-filled to " + CONTACT_EMAIL + "."
    )
  );
}

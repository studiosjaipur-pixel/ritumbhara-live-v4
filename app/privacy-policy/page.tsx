import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { socialMetadata } from "@/lib/seo";
import { bookingEngine } from "@/config/booking.config";
import { WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";

// Public page: no login, no middleware gate. Linked from the footer and listed in the sitemap.
// Content reflects what the site and the WhatsApp assistant actually do today. If a provider or a
// retention period changes, update this file and LAST_UPDATED.

const LAST_UPDATED = "31 October 2026";
const EMAIL_PRIMARY = "reservations@ritumbhara.com";
const EMAIL_SECONDARY = "studios.jaipur@gmail.com";
const PHONE_DISPLAY = "+91 95030 02629";
const PHONE_TEL = "tel:+919503002629";

const policyTitle = "Privacy Policy";
const policyDescription = "How Ritumbhara collects, uses and protects personal information on its website and WhatsApp channel, and how to ask for access, correction or deletion.";

export const metadata: Metadata = {
  title: policyTitle,
  description: policyDescription,
  alternates: { canonical: "/privacy-policy" },
  robots: { index: true, follow: true },
  ...socialMetadata("/privacy-policy", policyTitle + " | Ritumbhara", policyDescription),
};

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "contact" };

type Section = { id: string; heading: string; blocks: Block[] };

const intro =
  "This policy explains how Ritumbhara collects, uses and protects personal information when you visit ritumbhara.com, contact us, or message us on WhatsApp. Ritumbhara is a brand of LilacMosaic Technologies Private Limited (\"Ritumbhara\", \"we\", \"us\").";

const sections: Section[] = [
  {
    id: "information-we-collect",
    heading: "Information we collect",
    blocks: [
      {
        type: "ul",
        items: [
          "Details you give us: your name, email address, phone or WhatsApp number, the destination or property you are interested in, travel dates, number of guests, special requirements, and anything you write in a message.",
          "WhatsApp messages: the messages you send to our WhatsApp number, your WhatsApp number and profile name, and when messages were sent and delivered.",
          "Booking details: if you stay with us, our property management system gives us your name, contact details, booking dates, room and booking status. This website does not take payments or store card details.",
          "Website activity: when you tap a WhatsApp button on our site, we record the page, the button, any campaign tags in the link (such as utm_source) and the page you came from. A tap does not tell us your name or number.",
          "Partner enquiries: property owners who contact us about working with Ritumbhara share business and contact details and information about their property.",
        ],
      },
    ],
  },
  {
    id: "how-we-use-information",
    heading: "How we use information",
    blocks: [
      {
        type: "ul",
        items: [
          "To reply to enquiries and help you plan a stay.",
          "To confirm the details you give us on WhatsApp and pass them to our team.",
          "To manage bookings and answer questions before, during and after a stay.",
          "To send a follow-up about an enquiry you made, where the rules of the platform and the law allow it.",
          "To understand which pages and campaigns lead to enquiries.",
          "To keep our website and systems secure and prevent misuse.",
          "To meet legal, tax and accounting obligations.",
        ],
      },
    ],
  },
  {
    id: "whatsapp",
    heading: "WhatsApp messaging",
    blocks: [
      {
        type: "p",
        text: "We use the WhatsApp Business Platform, including Meta's WhatsApp Cloud API, to send and receive messages on our business number, " + WHATSAPP_DISPLAY_NUMBER + ". We may connect to it through a messaging provider such as Twilio.",
      },
      {
        type: "p",
        text: "When you message us, WhatsApp (Meta) and our provider process the message so it can be delivered. WhatsApp's own Privacy Policy and terms apply to that processing, in addition to this policy. Messages you send to a business account can be seen by us, our team and the providers that help us run WhatsApp messaging.",
      },
      {
        type: "p",
        text: "We message you on WhatsApp only if you contacted us first or have agreed to hear from us. Outside WhatsApp's 24-hour reply window, we use message templates approved by WhatsApp.",
      },
      {
        type: "p",
        text: "Reply STOP at any time to stop receiving messages from us. Reply HUMAN to reach a team member.",
      },
    ],
  },
  {
    id: "automated-assistant",
    heading: "Our automated assistant",
    blocks: [
      {
        type: "p",
        text: "Our WhatsApp assistant is automated. It asks for your travel dates, number of guests and requirements, then hands them to our team. It cannot check availability, take payment or confirm a booking.",
      },
      {
        type: "p",
        text: "We may use an AI language service to read details such as dates and guest numbers from your message. Message text may be sent to that service for this purpose only. It does not make decisions about you.",
      },
    ],
  },
  {
    id: "sharing",
    heading: "Who we share information with",
    blocks: [
      { type: "p", text: "We do not sell your personal information. We share it only with those who help us run the service:" },
      {
        type: "ul",
        items: [
          "Meta (WhatsApp) and Twilio, to send and receive WhatsApp messages.",
          "Google, whose Sheets, Apps Script and email tools we use to record enquiries and notify our team.",
          "Formspree, which receives the details you submit through our website enquiry form.",
          "Upstash, which holds short-lived WhatsApp conversation data for the assistant.",
          "An AI language service, to read dates and guest numbers from messages (see above).",
          "Hotel Spider, our booking engine, which handles reservations under its own privacy policy.",
          "Intellistay, our property management system, for guest bookings.",
          "Vercel, which hosts this website.",
          "Authorities or professional advisers, where the law requires it or to protect our rights.",
        ],
      },
    ],
  },
  {
    id: "retention",
    heading: "How long we keep information",
    blocks: [
      {
        type: "p",
        text: "The assistant's WhatsApp conversation data is deleted automatically after 7 days without a message, or 30 days after we hand you to our team.",
      },
      {
        type: "p",
        text: "Enquiry and booking records are kept for as long as needed to deal with your enquiry, run your stay and meet legal and accounting duties. After that we delete or anonymise them. Messages also stay on your own phone until you delete them.",
      },
    ],
  },
  {
    id: "security",
    heading: "Security",
    blocks: [
      {
        type: "p",
        text: "We use encrypted (HTTPS) connections, keep access keys on the server only, and limit who can see enquiry records. No system is perfectly secure, so we cannot promise absolute security.",
      },
    ],
  },
  {
    id: "cookies",
    heading: "Cookies and similar technology",
    blocks: [
      {
        type: "p",
        text: "We do not use advertising cookies or tracking pixels on this site. We keep campaign tags from a link in your browser's session storage until you close the tab, so we can tell which campaign led to an enquiry. Our booking engine and other sites we link to may use their own cookies under their own policies.",
      },
    ],
  },
  {
    id: "your-rights",
    heading: "Your choices and rights",
    blocks: [
      {
        type: "p",
        text: "You can ask us to tell you what we hold about you, correct it, delete it, stop using it for something you agreed to, or give you a copy. You can withdraw consent at any time by replying STOP on WhatsApp or by contacting us.",
      },
      {
        type: "p",
        text: "If you are in India, these rights come from the Digital Personal Data Protection Act, 2023. If you are elsewhere, your local law may give you similar rights. We may need to keep some records where the law requires.",
      },
    ],
  },
  {
    id: "data-deletion",
    heading: "How to request deletion of your data",
    blocks: [
      {
        type: "ol",
        items: [
          "Email " + EMAIL_PRIMARY + " with the subject \"Delete my data\".",
          "Include the phone number (with country code) or email address you used with us, so we can find your records.",
          "We will confirm by reply once your data has been deleted. Records we must keep by law may be kept for the period the law requires.",
        ],
      },
      {
        type: "p",
        text: "You can also call us or message our team on WhatsApp and ask for your data to be deleted.",
      },
    ],
  },
  {
    id: "children",
    heading: "Children",
    blocks: [
      {
        type: "p",
        text: "Our services are for adults. We do not knowingly collect information from anyone under 18 without a parent or guardian. If you think a child has sent us information, contact us and we will delete it.",
      },
    ],
  },
  {
    id: "transfers",
    heading: "Where information is processed",
    blocks: [
      {
        type: "p",
        text: "Some of our providers process information on servers outside India. Where they do, we rely on their security and contractual commitments to protect it.",
      },
    ],
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    blocks: [
      {
        type: "p",
        text: "We may update this policy from time to time. The date at the top shows the latest version. Changes take effect when posted on this page.",
      },
    ],
  },
  {
    id: "contact",
    heading: "Contact us",
    blocks: [
      { type: "p", text: "For questions about this policy, or to use any of your rights, contact:" },
      { type: "contact" },
    ],
  },
];

const bodyClass = "text-[15px] text-charcoal-soft leading-relaxed";
const linkClass = "text-burgundy underline decoration-burgundy/30 underline-offset-4 hover-fine:decoration-burgundy";

function renderBlock(block: Block, index: number) {
  if (block.type === "p") {
    return React.createElement("p", { key: index, className: bodyClass + " mb-3 last:mb-0" }, block.text);
  }
  if (block.type === "ul" || block.type === "ol") {
    return React.createElement(
      block.type,
      { key: index, className: bodyClass + " pl-5 space-y-2 mb-3 last:mb-0 " + (block.type === "ul" ? "list-disc" : "list-decimal") },
      block.items.map(function (item, i) {
        return React.createElement("li", { key: i }, item);
      })
    );
  }
  return React.createElement(
    "address",
    { key: index, className: bodyClass + " not-italic border-l-2 border-burgundy pl-4 space-y-1" },
    React.createElement("p", { className: "font-semibold text-charcoal" }, "Ritumbhara, a brand of LilacMosaic Technologies Private Limited"),
    React.createElement("p", null, bookingEngine.address),
    React.createElement("p", null,
      "Email: ",
      React.createElement("a", { href: "mailto:" + EMAIL_PRIMARY, className: linkClass }, EMAIL_PRIMARY),
      " or ",
      React.createElement("a", { href: "mailto:" + EMAIL_SECONDARY, className: linkClass }, EMAIL_SECONDARY)
    ),
    React.createElement("p", null,
      "Phone: ",
      React.createElement("a", { href: PHONE_TEL, className: linkClass }, PHONE_DISPLAY)
    ),
    React.createElement("p", null, "WhatsApp: " + WHATSAPP_DISPLAY_NUMBER)
  );
}

export default function PrivacyPolicyPage() {
  return React.createElement("main", { className: "max-w-7xl mx-auto px-6 lg:px-10 pt-32 lg:pt-36 pb-20" },
    React.createElement("div", { className: "max-w-3xl" },
      React.createElement("header", { className: "pb-8 mb-10 border-b border-line" },
        React.createElement("h1", { className: "text-[2.6rem] lg:text-[3.5rem] text-charcoal mb-3" }, policyTitle),
        React.createElement("p", { className: "text-sm font-semibold text-sage mb-4" }, "Last updated: " + LAST_UPDATED),
        React.createElement("p", { className: "text-lg text-charcoal leading-relaxed" }, intro)
      ),
      React.createElement("div", { className: "space-y-10" },
        sections.map(function (s) {
          return React.createElement("section", { key: s.id, id: s.id },
            React.createElement("h2", { className: "text-[1.6rem] leading-tight text-charcoal mb-3" }, s.heading),
            s.blocks.map(renderBlock)
          );
        })
      ),
      React.createElement("p", { className: "mt-12 pt-6 border-t border-line text-sm text-charcoal-soft" },
        "See also our ",
        React.createElement(Link, { href: "/contact", className: linkClass }, "contact page"),
        " or return to the ",
        React.createElement(Link, { href: "/", className: linkClass }, "home page"),
        "."
      )
    )
  );
}

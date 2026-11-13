import React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import WhatsAppClickTracker from "@/components/WhatsAppClickTracker";
import AvailabilityDialog from "@/components/AvailabilityDialog";
import PageEnhancer from "@/components/PageEnhancer";
import SearchPalette, { SearchItem } from "@/components/SearchPalette";
import ShortlistDrawer, { ShortlistStay } from "@/components/ShortlistDrawer";
import { properties } from "@/config/properties.config";
import { destinations } from "@/config/destinations.config";
import { isPlacementVerified } from "@/config/locations.config";
import { journalPosts } from "@/lib/journal-posts";
import "./globals.css";

// Cormorant Garamond for display headings, Manrope for body and UI text.
// Self-hosted from app/fonts (latin subset, SIL Open Font License; licences alongside the files), so the
// build no longer has to download them from Google Fonts. Same families and weights as before; next/font
// still preloads them and generates size-matched fallbacks to avoid layout shift.
const display = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});
const sans = localFont({
  src: [
    { path: "./fonts/manrope-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/manrope-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/manrope-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  adjustFontFallback: "Arial",
});

const siteUrl = "https://www.ritumbhara.com";
const siteTitle = "Ritumbhara | India, Thoughtfully Hosted";
const siteDescription = "Hotels, villas, serviced apartments and boutique stays across India, each one managed to the same exacting standard.";

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    title: {
      default: siteTitle,
          template: "%s | Ritumbhara",
    },
    description: siteDescription,
    keywords: ["Ritumbhara", "hospitality management India", "boutique stays Jaipur", "serviced apartments Alwar", "villas Sariska", "hotels Rajasthan", "managed properties India"],
    applicationName: "Ritumbhara",
    authors: [{ name: "Ritumbhara" }],
    creator: "Ritumbhara",
    publisher: "Ritumbhara",
    alternates: { canonical: "/" },
    openGraph: {
          type: "website",
          locale: "en_IN",
          url: siteUrl,
          siteName: "Ritumbhara",
          title: siteTitle,
          description: siteDescription,
    },
    twitter: {
          card: "summary_large_image",
          title: siteTitle,
          description: siteDescription,
    },
    robots: {
          index: true,
          follow: true,
          googleBot: {
                  index: true,
                  follow: true,
                  "max-image-preview": "large",
                  "max-snippet": -1,
                  "max-video-preview": -1,
          },
    },
};

const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Ritumbhara",
    url: siteUrl,
    logo: siteUrl + "/brand/ritumbhara-logo-square.png",
    description: "Ritumbhara is a hospitality management company operating hotels, studios, villas and serviced apartments across India under one consistent standard of guest experience.",
    areaServed: { "@type": "Country", name: "India" },
    // Business address exactly as listed on the Hotel-Spider booking engine and shown on the Contact page (no street line published).
    address: { "@type": "PostalAddress", postalCode: "302022", addressLocality: "Jaipur", addressRegion: "Rajasthan", addressCountry: "IN" },
    contactPoint: [
      { "@type": "ContactPoint", telephone: "+91-9503002629", email: "studios.jaipur@gmail.com", contactType: "customer service" },
        ],
};

const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Ritumbhara",
    url: siteUrl,
};

// Slim, server-built indexes for the quick search and the shortlist, so the browser never downloads the full
// property data (photo lists, amenities) just for these. Only facts already on the site.
function placeLabel(destSlug: string): string {
  const d = destinations.find(function (x) { return x.slug === destSlug; });
  if (!d) return "";
  return isPlacementVerified(d.slug) ? d.name + ", " + d.state : d.state;
}
const shortlistStays: ShortlistStay[] = properties.map(function (p) {
  return { slug: p.slug, name: p.name, type: p.propertyType, location: placeLabel(p.destinationSlug), maxGuests: p.maxGuests };
});
const searchItems: SearchItem[] = [
  ...properties.map(function (p): SearchItem { return { href: "/properties/" + p.slug, title: p.name, hint: p.propertyType + " · " + placeLabel(p.destinationSlug), group: "Stays", keywords: p.destinationSlug }; }),
  ...destinations.map(function (d): SearchItem { return { href: "/destinations/" + d.slug, title: d.name, hint: d.status === "operational" ? d.state : "Coming soon", group: "Destinations", keywords: d.state }; }),
  { href: "/destinations#all-stays", title: "Browse all stays", hint: "Filter by place and group size", group: "Pages", keywords: "find stay filter" },
  { href: "/experiences", title: "Experiences", hint: "Things to do", group: "Pages" },
  { href: "/about", title: "Our Story", hint: "About Ritumbhara", group: "Pages", keywords: "about" },
  { href: "/contact", title: "Contact", hint: "Reach the team", group: "Pages", keywords: "phone email whatsapp enquiry" },
  { href: "/journal", title: "Journal", hint: "Travel guides", group: "Pages" },
  { href: "/ai", title: "Ritumbhara AI", hint: "For property operators", group: "Pages" },
  ...journalPosts.map(function (j): SearchItem { return { href: "/journal/" + j.slug, title: j.title, hint: "Guide", group: "Guides" }; }),
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return React.createElement("html", { lang: "en" },
                                   React.createElement("body", { className: display.variable + " " + sans.variable + " font-sans bg-ivory text-charcoal" },
                                                             React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(organizationSchema) } }),
                                                             React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(websiteSchema) } }),
                                                             React.createElement(Navbar, null),
                                                             children,
                                                             React.createElement(Footer, null),
                                                             React.createElement(FloatingWhatsApp, null),
                                                             React.createElement(WhatsAppClickTracker, null),
                                                             React.createElement(AvailabilityDialog, null),
                                                             React.createElement(ShortlistDrawer, { stays: shortlistStays }),
                                                             React.createElement(SearchPalette, { items: searchItems }),
                                                             React.createElement(PageEnhancer, null)
                                                           )
                                 );
}

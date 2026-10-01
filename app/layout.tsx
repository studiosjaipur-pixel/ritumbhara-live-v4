import React from "react";
import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import "./globals.css";

// Cormorant Garamond for display headings, Manrope for body and UI text.
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-display", display: "swap" });
const sans = Manrope({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });

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
    description: "Ritumbhara is a hospitality management company operating hotels, studios, villas and serviced apartments across India under one consistent standard of guest experience.",
    areaServed: { "@type": "Country", name: "India" },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return React.createElement("html", { lang: "en" },
                                   React.createElement("body", { className: display.variable + " " + sans.variable + " font-sans bg-ivory text-charcoal" },
                                                             React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(organizationSchema) } }),
                                                             React.createElement("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(websiteSchema) } }),
                                                             React.createElement(Navbar, null),
                                                             children,
                                                             React.createElement(Footer, null),
                                                             React.createElement(FloatingWhatsApp, null)
                                                           )
                                 );
}

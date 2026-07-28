# Ritumbhara

Official corporate website for Ritumbhara, a hospitality management company operating hotels, studios, villas and serviced apartments across India.

Built with Next.js 14 (App Router), TypeScript, and TailwindCSS. All bookings redirect to Hotel Spider via each property's hotelSpiderBookingUrl. This app never handles reservations, payments, or inventory directly.

## Getting started

npm install
npm run dev

Open http://localhost:3000 to view the site.

## Adding a new destination or property

Edit config/destinations.config.ts or config/properties.config.ts. No component or page code changes are required.

## Project structure

config/ holds all destination and property data.
app/ holds pages and routes (App Router).
components/ holds shared UI components like Navbar, Footer, and PropertyCard.

## Deployment

This project is set up to deploy on Vercel. Import this repository into a new Vercel project, and point your custom domain to it from the Vercel dashboard's Domains settings.

## Notes on data

Amenity lists are intentionally left empty for properties where they could not be verified against the live Hotel Spider listing. Contact details are shared across properties because that is what the current Hotel Spider account exposes; this should be revisited as more granular contact data becomes available per property.

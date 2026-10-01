// Verified location details shown on property pages.
// Only information already published on this site, or confirmed by the owner, belongs here.
// Do not add street addresses, coordinates or distances that have not been verified.
//
// Sources:
// - Jaipur: the /serviced-apartments-jaipur guide. Owner confirmed (Oct 2026) that the
//   Karolan Ka Barh location applies to all Jaipur studios.
// - Villa 65 Sariska: the /stays-in-sariska guide (Sariska has a single property).
// - Alwar: property-level locations are not yet confirmed, so Alwar stays show city level only
//   (from destinations.config). Add entries per property slug once confirmed.

export interface LocationDetails {
  area: string;
  summary: string;
  gettingThere: string[];
  nearby: string[];
  // Google Maps search for the named area only (not an exact address). Omit when there is no named area.
  mapsQuery?: string;
}

// Applies to every property in the destination.
export const destinationLocations: Record<string, LocationDetails> = {
  jaipur: {
    area: "Karolan Ka Barh, Jeerota village, Jaipur",
    summary: "About 19 km from central Jaipur",
    gettingThere: [
      "Jaipur International Airport (JAI, Sanganer): around 15 km, about a 26-minute drive",
      "Getor Jagatpura Railway Station: about 7–8 km (approx. 7–10 minutes)",
      "Gandhinagar Jaipur Station: about 10–12 km (approx. 14–15 minutes)",
    ],
    nearby: [
      "Chokhi Dhani: about 6 minutes by car",
      "Jaipur Exhibition & Convention Center: about 7 minutes",
      "World Trade Park: about 12 minutes",
      "Hawa Mahal and City Palace: about 20 minutes each by car",
    ],
    mapsQuery: "Karolan Ka Barh, Jeerota, Jaipur, Rajasthan",
  },
};

// Applies to a single property, and takes priority over destinationLocations.
export const propertyLocations: Record<string, LocationDetails> = {
  "villa-65-sariska": {
    area: "Alwar district, near Sariska Tiger Reserve",
    summary: "12 km (about 30 minutes) by road from Alwar city",
    gettingThere: [
      "Alwar Railway Station: 15 km",
      "From Delhi: approximately 160 km, around 3 to 3.5 hours",
      "From Jaipur: approximately 150 km, around 2.5 to 3 hours",
    ],
    nearby: [
      "Sariska Tiger Reserve, with Neelkanth Mahadev Temple, Pandupol Hanuman Temple and Kankwari Fort",
      "Petrol station: about 8 km",
      "Grocery & local market: about 10 km",
      "ATM & pharmacy: about 10–12 km (in Alwar city)",
    ],
  },
};

export function getLocationDetails(propertySlug: string, destinationSlug: string): LocationDetails | undefined {
  return propertyLocations[propertySlug] || destinationLocations[destinationSlug];
}

// City-level facts for destinations whose property-level locations are not yet confirmed (Alwar).
// Every distance here is measured from the city, not from a property, and is labelled that way on the page.
// Source: the /studios-in-alwar guide and destinations.config.
export interface CityLocation {
  note: string;
  gettingThere: string[];
  nearby: string[];
}

export const cityLocations: Record<string, CityLocation> = {
  alwar: {
    note: "In Alwar city. Distances below are from Alwar city; message us on WhatsApp for directions to the property.",
    gettingThere: [
      "From Delhi NCR or Jaipur: approximately 3 hours by road to Alwar",
      "Jaipur International Airport: about 2.5–3 hours; Delhi IGI Airport: about 3.5–4 hours",
      "By rail: Alwar Junction railway station",
    ],
    nearby: [
      "Bala Qila & City Palace, which define Alwar's skyline",
      "Siliserh Lake, a short drive outside the city",
      "Sariska Tiger Reserve: about 36 km from Alwar city",
    ],
  },
};

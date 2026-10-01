// Verified location details shown on property pages (UX-004).
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
  points: string[];
  // Google Maps search for the named area only (not an exact address). Omit when there is no named area.
  mapsQuery?: string;
}

// Applies to every property in the destination.
export const destinationLocations: Record<string, LocationDetails> = {
  jaipur: {
    area: "Karolan Ka Barh, Jeerota village, Jaipur",
    points: [
      "About 19 km from central Jaipur",
      "Jaipur International Airport (JAI, Sanganer): around 15 km, about a 26-minute drive",
      "Getor Jagatpura Railway Station: about 7–8 km (approx. 7–10 minutes)",
      "Hawa Mahal and City Palace: about 20 minutes each by car",
    ],
    mapsQuery: "Karolan Ka Barh, Jeerota, Jaipur, Rajasthan",
  },
};

// Applies to a single property, and takes priority over destinationLocations.
export const propertyLocations: Record<string, LocationDetails> = {
  "villa-65-sariska": {
    area: "Alwar district, near Sariska Tiger Reserve",
    points: [
      "Alwar city: 12 km, about 30 minutes by road",
      "Alwar Railway Station: 15 km",
      "From Delhi: approximately 160 km, around 3 to 3.5 hours",
      "From Jaipur: approximately 150 km, around 2.5 to 3 hours",
    ],
  },
};

export function getLocationDetails(propertySlug: string, destinationSlug: string): LocationDetails | undefined {
  return propertyLocations[propertySlug] || destinationLocations[destinationSlug];
}

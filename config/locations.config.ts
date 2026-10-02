// Verified location details shown on property pages.
// Only information already published on this site, or confirmed by the owner, belongs here.
// Do not add street addresses, coordinates or distances that have not been verified.
//
// Sources:
// - Jaipur: the /serviced-apartments-jaipur guide. Owner confirmed (Oct 2026) that the
//   Karolan Ka Barh location applies to all Jaipur studios.
// - Villa 65 Sariska: the /stays-in-sariska guide (Sariska has a single property).
// - Alwar-named rooms: placement not verified (see unverifiedPlacementDestinations below).

export interface LocationDetails {
  area: string;
  summary: string;
  gettingThere: string[];
  nearby: string[];
  // Google Maps search for the named area only (not an exact address). Omit when there is no named area.
  mapsQuery?: string;
  // What the map shows, in words, and a note when that is a nearby landmark rather than the stay itself.
  mapsLabel?: string;
  mapsNote?: string;
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
    mapsLabel: "the Karolan Ka Barh area",
    mapsNote: "The map shows the Karolan Ka Barh area, not the exact building.",
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
    // No address or coordinates are published for the villa, so the map shows the reserve it is near.
    mapsQuery: "Sariska Tiger Reserve, Rajasthan",
    mapsLabel: "Sariska Tiger Reserve",
    mapsNote: "The map shows Sariska Tiger Reserve. The villa is in Alwar district near the reserve, 12 km (about 30 minutes) by road from Alwar city.",
  },
};

export function getLocationDetails(propertySlug: string, destinationSlug: string): LocationDetails | undefined {
  return propertyLocations[propertySlug] || destinationLocations[destinationSlug];
}

// Destinations whose property placement is NOT verified (Oct 2026). Hotel-Spider, the source of truth,
// lists the "Alwar"-named rooms at 302022 Jaipur, Rajasthan, and does not confirm they are in Alwar.
// Property pages and cards for these destinations therefore make no city/area claim.
export const unverifiedPlacementDestinations: string[] = ["alwar"];

export function isPlacementVerified(destinationSlug: string): boolean {
  return unverifiedPlacementDestinations.indexOf(destinationSlug) === -1;
}

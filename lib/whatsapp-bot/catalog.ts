import { destinations } from "../../config/destinations.config";
import { properties } from "../../config/properties.config";

// Destinations and properties the bot recognizes, derived from the website's own configuration (the single source
// of truth). Nothing here is invented; the bot only reads names, slugs, destination links, status and maxGuests.

export interface CatalogDestination {
  slug: string;
  name: string;
  comingSoon: boolean;
}

export interface CatalogProperty {
  slug: string;
  name: string;
  destinationSlug: string;
  maxGuests: number | null;
  key: string; // "<type> <number>", e.g. "studio 925", used to match what guests type
}

export interface Catalog {
  destinations: CatalogDestination[];
  properties: CatalogProperty[];
}

// "Studio 502 Alwar" -> "studio 502". Null when the name has no "<word> <number>" form.
function propertyKey(name: string): string | null {
  const m = /^\s*([A-Za-z]+)\s+(\d{1,5})\b/.exec(name);
  return m ? m[1].toLowerCase() + " " + m[2] : null;
}

export function buildCatalog(): Catalog {
  const dests: CatalogDestination[] = destinations.map(function (d) {
    return { slug: d.slug, name: d.name, comingSoon: d.status !== "operational" };
  });
  const keyCounts: Record<string, number> = {};
  properties.forEach(function (p) {
    const k = propertyKey(p.name);
    if (k) keyCounts[k] = (keyCounts[k] || 0) + 1;
  });
  const props: CatalogProperty[] = properties.map(function (p) {
    const k = propertyKey(p.name);
    return {
      slug: p.slug,
      name: p.name,
      destinationSlug: p.destinationSlug,
      maxGuests: typeof p.maxGuests === "number" ? p.maxGuests : null,
      // Ambiguous keys (two properties with the same "<type> <number>") are not used for matching.
      key: k && keyCounts[k] === 1 ? k : "",
    };
  });
  return { destinations: dests, properties: props };
}

export function findDestination(catalog: Catalog, slug: string | null): CatalogDestination | null {
  if (!slug) return null;
  for (let i = 0; i < catalog.destinations.length; i++) if (catalog.destinations[i].slug === slug) return catalog.destinations[i];
  return null;
}

export function findProperty(catalog: Catalog, slug: string | null): CatalogProperty | null {
  if (!slug) return null;
  for (let i = 0; i < catalog.properties.length; i++) if (catalog.properties[i].slug === slug) return catalog.properties[i];
  return null;
}

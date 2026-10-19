import { bookingEngine } from "../../config/booking.config";
import { INTELLISTAY_ROOM_MAPPINGS, type IntellistayRoomMapping } from "../../config/guestMessages.config";
import { getLocationDetails, isPlacementVerified, type LocationDetails } from "../../config/locations.config";
import { properties, type Property } from "../../config/properties.config";
import type { NormalizedBooking, NormalizedRoom } from "../intellistay/types";

// Week 7: the ONLY facts guest messages and FAQ answers may state about a stay, all taken from this website's own
// configuration. A fact that is not configured for the booking's property is null, and callers then use generic
// wording (templates) or escalate to the team (FAQ). Nothing here is invented.

export interface StayFacts {
  property: Property | null; // the website property this booking's room is mapped to, if any
  propertyName: string | null; // its published name
  // Check-in/out times are Hotel-Spider engine facts; booking.config.ts says they apply only to engine-listed rooms.
  checkInTime: string | null;
  checkOutTime: string | null;
  // Area details, only where the property's placement is verified (locations.config.ts).
  location: LocationDetails | null;
  // Amenities listed for the property (may be empty: unverified lists are intentionally left empty).
  amenities: string[];
}

const EMPTY: StayFacts = { property: null, propertyName: null, checkInTime: null, checkOutTime: null, location: null, amenities: [] };

// The mapping entry for one booking room, or null. Strict: the booking's branchId and the room's roomId must both
// match; roomTypeId and roomNo must match too whenever Intellistay sends them. No partial or name-only matches.
export function mappingForRoom(booking: NormalizedBooking, room: NormalizedRoom, mappings: IntellistayRoomMapping[] = INTELLISTAY_ROOM_MAPPINGS): IntellistayRoomMapping | null {
  if (booking.branchId === null || room.roomId === null) return null;
  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    if (m.branchId !== booking.branchId || m.roomId !== room.roomId) continue;
    if (room.roomTypeId !== null && room.roomTypeId !== m.roomTypeId) continue;
    if (room.roomNo !== null && room.roomNo.trim().toLowerCase() !== m.roomNo.trim().toLowerCase()) continue;
    return m;
  }
  return null;
}

// The website property for a booking. Every room in the booking that maps must map to the same property; a booking
// whose rooms point at different properties is treated as unmapped (generic wording) rather than picking one.
export function propertyForBooking(booking: NormalizedBooking | null, mappings: IntellistayRoomMapping[] = INTELLISTAY_ROOM_MAPPINGS): Property | null {
  if (!booking) return null;
  let slug: string | null = null;
  for (let i = 0; i < booking.rooms.length; i++) {
    const m = mappingForRoom(booking, booking.rooms[i], mappings);
    if (!m) continue;
    if (slug !== null && slug !== m.propertySlug) return null;
    slug = m.propertySlug;
  }
  if (slug === null) return null;
  const wanted = slug;
  return properties.filter(function (p) { return p.slug === wanted; })[0] || null;
}

export function stayFacts(booking: NormalizedBooking | null, mappings?: IntellistayRoomMapping[]): StayFacts {
  const property = propertyForBooking(booking, mappings);
  if (!property) return EMPTY;
  const engine = property.bookingEngineListed === true;
  const location = isPlacementVerified(property.destinationSlug) ? getLocationDetails(property.slug, property.destinationSlug) || null : null;
  return {
    property: property,
    propertyName: property.name,
    checkInTime: engine ? bookingEngine.checkIn : null,
    checkOutTime: engine ? bookingEngine.checkOut : null,
    location: location,
    amenities: property.amenities.slice(),
  };
}

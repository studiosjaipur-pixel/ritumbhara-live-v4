// Week 7: confirmed Intellistay sandbox room -> website property mapping (config/guestMessages.config.ts,
// lib/guest-messages/facts.ts, lib/intellistay/normalize.ts). Pure functions: no network.
// Proves the three confirmed rooms map to the right website properties, the matching is strict (branch + roomId, and
// roomTypeId/roomNo when sent), and unknown or inconsistent rooms are never matched. No amenities come from Intellistay.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOM_909, ROOM_925, ROOM_VILLA_65, normalized, rawBooking } from "../helpers/intellistay-fixtures.mjs";

const { INTELLISTAY_ROOM_MAPPINGS, INTELLISTAY_BRANCH } = await import("../../config/guestMessages.config.ts");
const { properties } = await import("../../config/properties.config.ts");
const { propertyForBooking, mappingForRoom, stayFacts } = await import("../../lib/guest-messages/facts.ts");
const { normalizeBooking } = await import("../../lib/intellistay/normalize.ts");
const { renderGuestMessage } = await import("../../lib/guest-messages/templates.ts");
const { buildQueueItem } = await import("../../lib/guest-messages/queue.ts");
const { planMessages } = await import("../../lib/guest-messages/triggers.ts");

const withRooms = (rooms, over = {}) => normalized(Object.assign({ branchId: 1, rooms }, over));
const slugOf = (b) => { const p = propertyForBooking(b); return p ? p.slug : null; };

test("config: exactly the three confirmed rooms on branch 1 'Ritumbhara', each pointing at a real website property, no amenities", () => {
  assert.deepEqual(INTELLISTAY_BRANCH, { branchId: 1, branchName: "Ritumbhara" });
  assert.deepEqual(INTELLISTAY_ROOM_MAPPINGS.map((m) => [m.propertySlug, m.intellistayName, m.branchId, m.roomTypeId, m.roomId, m.roomNo]), [
    ["studio-925", "Studio 925 Urban Jagatpura", 1, 2, 5, "Studio 925"],
    ["studio-909", "Studio 909 Ashadeep Jagatpura", 1, 1, 1, "Studio 909"],
    ["villa-65-sariska", "Villa 65 MS Valley Sariska", 1, 11, 11, "Villa 65"],
  ]);
  for (const m of INTELLISTAY_ROOM_MAPPINGS) {
    assert.ok(properties.some((p) => p.slug === m.propertySlug), m.propertySlug + " exists in properties.config.ts");
    assert.deepEqual(Object.keys(m).sort(), ["branchId", "intellistayName", "propertySlug", "roomId", "roomNo", "roomTypeId"], "identifiers only");
  }
  assert.equal(new Set(INTELLISTAY_ROOM_MAPPINGS.map((m) => m.roomId)).size, 3, "room IDs are unique");
});

test("the three confirmed rooms map to Studio 925, Studio 909 and Villa 65 Sariska", () => {
  assert.equal(slugOf(withRooms([ROOM_925])), "studio-925");
  assert.equal(slugOf(withRooms([ROOM_909])), "studio-909");
  assert.equal(slugOf(withRooms([ROOM_VILLA_65])), "villa-65-sariska");
  // roomNo is compared without case/outer spaces; a room without roomTypeId/roomNo still matches on branch + roomId.
  assert.equal(slugOf(withRooms([Object.assign({}, ROOM_925, { roomNo: " studio 925 " })])), "studio-925");
  assert.equal(slugOf(withRooms([Object.assign({}, ROOM_909, { roomNo: null, roomTypeId: null })])), "studio-909");
});

test("facts per mapped property come only from the website config", () => {
  const f925 = stayFacts(withRooms([ROOM_925]));
  assert.deepEqual([f925.propertyName, f925.checkInTime, f925.checkOutTime], ["Studio 925", "13:00 – 23:00", "10:00"]);
  const f909 = stayFacts(withRooms([ROOM_909]));
  assert.deepEqual([f909.propertyName, f909.checkInTime, f909.checkOutTime, f909.amenities.length], ["Studio 909", null, null, 0], "not engine-listed: no times; amenities empty in config");
  const fVilla = stayFacts(withRooms([ROOM_VILLA_65]));
  assert.equal(fVilla.propertyName, "Villa 65 Sariska");
  assert.equal(fVilla.checkInTime, null, "villa is not engine-listed: no invented times");
  assert.match(fVilla.location.area, /near Sariska Tiger Reserve/);
  assert.deepEqual(fVilla.amenities, properties.find((p) => p.slug === "villa-65-sariska").amenities);
});

test("unknown or inconsistent rooms are NOT matched (generic wording instead)", () => {
  const cases = {
    "unknown roomId": [Object.assign({}, ROOM_925, { roomId: 99 })],
    "no roomId (name alone is not enough)": [Object.assign({}, ROOM_925, { roomId: null })],
    "roomId 5 but roomNo of another room": [Object.assign({}, ROOM_925, { roomNo: "Studio 909" })],
    "roomId 1 but roomTypeId of another room": [Object.assign({}, ROOM_909, { roomTypeId: 2 })],
    "similar name, different room": [{ roomTypeName: "Studio", roomNo: "Studio 9255", roomId: 5, roomTypeId: 2 }],
    "old-style roomNo '925' without IDs": [{ roomTypeName: "Studio", roomNo: "925", roomId: null, roomTypeId: null }],
    "no rooms": [],
  };
  for (const [label, rooms] of Object.entries(cases)) assert.equal(slugOf(withRooms(rooms)), null, label);
  assert.equal(slugOf(withRooms([ROOM_925], { branchId: 2 })), null, "another branch");
  assert.equal(slugOf(withRooms([ROOM_925], { branchId: null })), null, "branch unknown");
  assert.equal(slugOf(withRooms([ROOM_925, ROOM_909])), null, "rooms pointing at different properties: ambiguous, not guessed");
  assert.equal(slugOf(withRooms([ROOM_925, Object.assign({}, ROOM_925)])), "studio-925", "two rooms, same property: fine");
  assert.equal(slugOf(withRooms([{ roomTypeName: "Suite", roomNo: "X1", roomId: 77, roomTypeId: 9 }, ROOM_VILLA_65])), "villa-65-sariska", "one unmapped extra room does not block a clear match");
  assert.equal(mappingForRoom(withRooms([]), Object.assign({}, ROOM_925, { roomId: 99 })), null);

  const unmapped = withRooms([Object.assign({}, ROOM_925, { roomId: 99 })]);
  const text = renderGuestMessage({ type: "PRE_ARRIVAL", booking: unmapped });
  assert.ok(!text.includes("Studio 925") && !text.includes("Check-in is"), "no property name or times for an unmapped room");
});

test("end to end from a raw Intellistay booking: normalize keeps roomId/roomTypeId, then the queue item uses the property name", () => {
  const raw = rawBooking({ branchId: 1, branchName: "Ritumbhara", roomDetails: [{ roomTypeName: "Studio", roomNo: "Studio 925", roomTypeId: 2, roomId: 5, rate: 3333 }] });
  const n = normalizeBooking(raw);
  assert.equal(n.ok, true);
  assert.deepEqual(n.booking.rooms, [{ roomTypeName: "Studio", roomNo: "Studio 925", roomId: 5, roomTypeId: 2 }]);
  const [planned] = planMessages([n.booking], { today: "2026-10-18" });
  const item = buildQueueItem(planned, n.booking, new Date("2026-10-18T03:30:00Z"));
  assert.equal(item.property, "Studio 925");
  assert.match(item.message, /hosting you at Studio 925/);
  assert.ok(!JSON.stringify(item).includes("3333"));

  const rawUnknown = rawBooking({ branchId: 1, roomDetails: [{ roomTypeName: "Deluxe", roomNo: "Room 12", roomTypeId: 4, roomId: 12 }] });
  const u = normalizeBooking(rawUnknown).booking;
  const itemU = buildQueueItem(planMessages([u], { today: "2026-10-18" })[0], u, new Date());
  assert.equal(itemU.property, "Deluxe, room Room 12", "unmapped: the PMS label for the team, never a website property");
  assert.match(itemU.message, /We're looking forward to hosting you from/);
});

// ---------- Studio 925 location (owner-confirmed) ----------

test("Studio 925 location: exactly the owner-confirmed words; no street number, PIN, landmark, distance or map", async () => {
  const { getLocationDetails, propertyLocations } = await import("../../config/locations.config.ts");
  assert.deepEqual(propertyLocations["studio-925"], {
    area: "Urban Suites by BluSalzz Jaipur, Mahal Road, Jagatpura, Jaipur",
    summary: "Jagatpura, Jaipur",
    gettingThere: [],
    nearby: [],
  });
  const loc = getLocationDetails("studio-925", "jaipur");
  assert.equal(loc.mapsQuery, undefined);
  assert.ok(!/\d/.test(JSON.stringify(loc)), "no numbers (street number, PIN, km) were added");

  const b = withRooms([ROOM_925]);
  const f = stayFacts(b);
  assert.equal(f.location.area, "Urban Suites by BluSalzz Jaipur, Mahal Road, Jagatpura, Jaipur");
  const pre = renderGuestMessage({ type: "PRE_ARRIVAL", booking: b, facts: f });
  assert.match(pre, /You'll be staying in Urban Suites by BluSalzz Jaipur, Mahal Road, Jagatpura, Jaipur\./);
  assert.ok(!/Karolan|Jeerota/.test(pre));
  // The Intellistay mapping is unchanged.
  assert.equal(INTELLISTAY_ROOM_MAPPINGS.find((m) => m.propertySlug === "studio-925").roomId, 5);
});

test("all other properties keep exactly their previous location", async () => {
  const { getLocationDetails, destinationLocations, propertyLocations, isPlacementVerified } = await import("../../config/locations.config.ts");
  assert.deepEqual(Object.keys(propertyLocations).sort(), ["studio-925", "villa-65-sariska"]);
  assert.equal(destinationLocations.jaipur.area, "Karolan Ka Barh, Jeerota village, Jaipur");
  assert.equal(destinationLocations.jaipur.mapsQuery, "Karolan Ka Barh, Jeerota, Jaipur, Rajasthan");
  for (const p of properties) {
    if (p.slug === "studio-925") continue;
    const loc = getLocationDetails(p.slug, p.destinationSlug);
    if (p.slug === "villa-65-sariska") assert.equal(loc.area, "Alwar district, near Sariska Tiger Reserve", p.slug);
    else if (p.destinationSlug === "jaipur") assert.equal(loc, destinationLocations.jaipur, p.slug + " still uses the Jaipur (Karolan Ka Barh) details");
    else assert.equal(loc, undefined, p.slug + " has no location details");
  }
  assert.equal(isPlacementVerified("alwar"), false, "Alwar placement still unverified");
  // Guest-facing facts for the other two mapped rooms are unchanged.
  assert.equal(stayFacts(withRooms([ROOM_909])).location.area, "Karolan Ka Barh, Jeerota village, Jaipur");
  assert.equal(stayFacts(withRooms([ROOM_VILLA_65])).location.area, "Alwar district, near Sariska Tiger Reserve");
});

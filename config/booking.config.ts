// Facts verified on Ritumbhara's Hotel-Spider booking engine
// (https://reservations.hotel-spider.com/03u69e20bdb541a7), read-only inspection, 2 Oct 2026.
// They apply only to rooms listed on that engine — see `bookingEngineListed` in properties.config.ts.
// Prices on the engine are averages for the searched dates and guests, so no price is stored here.

export const bookingEngine = {
  // The engine's general search page, used when a room-specific link cannot be verified.
  generalUrl: "https://reservations.hotel-spider.com/03u69e20bdb541a7",
  checkIn: "13:00 – 23:00",
  checkOut: "10:00",
  cancellation: "Free cancellation until 17:59 on the day of check-in; after that, 100% of the stay is charged.",
  payment: "Pay today (flexible cancellation rate)",
  currency: "INR",
  // The only address the engine shows for the listing. It has no street line, map or coordinates.
  address: "302022 Jaipur, Rajasthan, India",
};

// Amenities the engine lists for every studio except Studio 502 Alwar (which shows none).
export const engineStudioBaseAmenities: string[] = [
  "Air conditioning",
  "Private bathroom",
  "Air conditioning individually controlled in room",
  "Ceiling fan",
  "Internet access",
  "TV",
  "Toaster",
  "Shower",
  "Kitchen supplies",
  "Kitchenette",
  "Bathroom amenities",
  "Sitting area",
  "Hairdryer",
  "Desk",
  "Oven",
  "Silverware/utensils",
  "Microwave",
  "Bidet",
  "Separate closet",
  "Plates and bowls",
];

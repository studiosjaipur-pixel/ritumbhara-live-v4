// Week 7: our own booking type, built from Intellistay's booking objects by normalize.ts.
// It holds only what Guest Messages needs. Payment and financial fields (totals, paid amounts, rates, payment
// status) and guest emails/addresses are deliberately never copied in.

export interface NormalizedRoom {
  roomTypeName: string | null;
  roomNo: string | null;
  // Intellistay identifiers, used to match the room to a website property (config/guestMessages.config.ts).
  roomId: number | null;
  roomTypeId: number | null;
}

export interface NormalizedGuest {
  // First word of the primary guest's name, for "Hi <name>". Null when unusable.
  firstName: string | null;
  // E.164 (+919876543210), so the team can message the guest. Null when it cannot be built reliably.
  phone: string | null;
}

export interface NormalizedBooking {
  bookingId: string;
  bookingCode: string | null;
  branchId: number | null;
  branchName: string | null;
  statusId: number | null;
  statusName: string | null;
  // Dates in India time, "YYYY-MM-DD". Intellistay sends naive IST timestamps ("2026-10-20T14:00:00").
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number | null;
  children: number | null;
  rooms: NormalizedRoom[];
  source: string | null;
  // Kept for the team's context only; never written to logs and never echoed back to the guest.
  specialRequest: string | null;
  guest: NormalizedGuest;
}

// A booking Intellistay returned that could not be used, with the reason as a FIELD NAME (never a value).
export interface RejectedBooking {
  bookingId: string | null;
  problem: string;
}

export interface NormalizeResult {
  bookings: NormalizedBooking[];
  rejected: RejectedBooking[];
}

// Week 7 test fixtures: Intellistay booking objects shaped like the TEST API's real responses (data.bookings,
// pagination = null, checkInDate/checkOutDate naive IST, customerDetails[], roomDetails[]). All values are fake.
// Payment fields and an address are included on purpose, so tests can prove they are never copied or logged.

export const FAKE_PASSWORD = "fake-intellistay-password-XYZ";
export const FAKE_USERNAME = "fake-user";
export const FAKE_TOKEN = "fake.jwt.token.value.0123456789abcdefSECRET";
export const TEST_URL = "https://ritumbharatest.aastratech.com";

export const CONFIG = { environment: "test", baseUrl: TEST_URL, username: FAKE_USERNAME, password: FAKE_PASSWORD, branchId: 1 };

export const ENV = {
  INTELLISTAY_ENV: "test",
  INTELLISTAY_BASE_URL: TEST_URL,
  INTELLISTAY_USERNAME: FAKE_USERNAME,
  INTELLISTAY_PASSWORD: FAKE_PASSWORD,
  INTELLISTAY_BRANCH_ID: "1",
};

// Guest data that must never appear in logs or API responses.
export const GUEST_NAME = "Asha Verma";
export const GUEST_EMAIL = "asha.verma@example.com";
export const GUEST_MOBILE = "9876543210";
export const GUEST_E164 = "+919876543210";
export const GUEST_ADDRESS = "12 Secret Lane, Jaipur";
export const SPECIAL_REQUEST_TEXT = "Please arrange a cake for our anniversary";

export function rawBooking(overrides = {}) {
  return Object.assign({
    bookingId: 101,
    bookingCode: "BK101",
    branchId: 1,
    branchName: "Test Branch",
    checkInDate: "2026-10-20T14:00:00",
    checkOutDate: "2026-10-22T11:00:00",
    adultCount: 2,
    childCount: 0,
    noOfDays: 2,
    bookingStatusId: 1,
    bookingStatus: "Reserved",
    source: "Walk-In",
    specialRequest: "",
    grandTotal: 45678,
    totalPaidAmount: 12345,
    paymentStatus: "Paid",
    roomDetails: [{ roomTypeName: "Studio", roomNo: "925", checkInDate: "2026-10-20T14:00:00", checkOutDate: "2026-10-22T11:00:00", noOfAdult: 2, noOfChild: 0, rate: 3333 }],
    customerDetails: [{ customerName: GUEST_NAME, email: GUEST_EMAIL, mobile: GUEST_MOBILE, countryCode: "+91", primaryGuest: true, address: GUEST_ADDRESS }],
  }, overrides);
}

export function bookingsResponse(list, extra = {}) {
  return Object.assign({ success: true, data: { bookings: list, pagination: null } }, extra);
}

// A normalized booking (what lib/intellistay/normalize.ts produces), for trigger/template/FAQ tests.
export function normalized(overrides = {}) {
  return Object.assign({
    bookingId: "101", bookingCode: "BK101", branchId: 1, branchName: "Test Branch", statusId: 1, statusName: "Reserved",
    checkInDate: "2026-10-20", checkOutDate: "2026-10-22", nights: 2, adults: 2, children: 0,
    rooms: [{ roomTypeName: "Studio", roomNo: "925", roomId: null, roomTypeId: null }], source: "Walk-In", specialRequest: null,
    guest: { firstName: "Asha", phone: GUEST_E164 },
  }, overrides);
}

// fetch fake for the Intellistay client: routes by path. `handlers.login` / `handlers.bookings` return
// { status, body } (body object -> JSON) or an Error to throw. Every call is recorded.
export function intellistayFetch(handlers, calls = []) {
  return async (url, init) => {
    const path = new URL(url).pathname;
    const body = init && init.body ? JSON.parse(init.body) : null;
    calls.push({ url, path, init, body });
    const h = path === "/api/Login/Login" ? handlers.login : path === "/api/Booking/GetAllBookingsByPagination" ? handlers.bookings : null;
    if (!h) return new Response("not found", { status: 404 });
    const r = typeof h === "function" ? await h(body, calls, init) : h;
    if (r instanceof Error) throw r;
    const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(text, { status: r.status || 200, headers: { "Content-Type": "application/json" } });
  };
}

// Rooms as the Intellistay TEST API returns them for the three confirmed mappings (config/guestMessages.config.ts).
export const ROOM_925 = { roomTypeName: "Studio", roomNo: "Studio 925", roomId: 5, roomTypeId: 2 };
export const ROOM_909 = { roomTypeName: "Studio", roomNo: "Studio 909", roomId: 1, roomTypeId: 1 };
export const ROOM_VILLA_65 = { roomTypeName: "Villa", roomNo: "Villa 65", roomId: 11, roomTypeId: 11 };

export const LOGIN_OK = { status: 200, body: { accessToken: FAKE_TOKEN, refreshToken: "fake-refresh-SECRET", sessionId: "s1" } };

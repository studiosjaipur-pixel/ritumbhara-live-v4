// Week 7: lib/intellistay (config, client, normalize). fetch is always a fake: no network, no real Intellistay.
// Proves: test server only (production refused), successful/failed authentication, booking retrieval at
// data.bookings, the API ignoring `limit` and returning pagination = null, malformed responses, timeouts, missing
// fields, pagination, re-login on 401, and that credentials, tokens and guest data never reach logs or errors.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG, ENV, FAKE_PASSWORD, FAKE_TOKEN, FAKE_USERNAME, GUEST_ADDRESS, GUEST_E164, GUEST_EMAIL, GUEST_MOBILE, GUEST_NAME,
  LOGIN_OK, SPECIAL_REQUEST_TEXT, TEST_URL, bookingsResponse, intellistayFetch, rawBooking,
} from "../helpers/intellistay-fixtures.mjs";

const { getIntellistayConfig, isAllowedIntellistayBaseUrl, describeIntellistayConfig } = await import("../../lib/intellistay/config.ts");
const { createIntellistayClient, IntellistayError, extractBookingList } = await import("../../lib/intellistay/client.ts");
const { normalizeBooking, normalizeBookings, phoneFrom, istDateFromIntellistay, firstNameFrom } = await import("../../lib/intellistay/normalize.ts");

function client(handlers, extra = {}) {
  const calls = [];
  const logs = [];
  const c = createIntellistayClient(Object.assign({
    config: CONFIG, fetchImpl: intellistayFetch(handlers, calls), log: (e, m) => logs.push(e + " " + JSON.stringify(m || {})),
  }, extra));
  return { c, calls, logs };
}

const SECRETS = [FAKE_PASSWORD, FAKE_TOKEN, "fake-refresh-SECRET", GUEST_NAME, GUEST_EMAIL, GUEST_MOBILE, GUEST_E164, GUEST_ADDRESS, SPECIAL_REQUEST_TEXT];
function assertNoSecrets(text, label) {
  for (const s of SECRETS) assert.ok(!String(text).includes(s), label + " must not contain " + s);
}

// ---------- configuration ----------

test("config: the test server with all variables is ready", () => {
  const r = getIntellistayConfig(ENV);
  assert.equal(r.status, "ready");
  assert.deepEqual(r.config, CONFIG);
  assert.equal(getIntellistayConfig(Object.assign({}, ENV, { INTELLISTAY_BASE_URL: TEST_URL + "/" })).status, "ready", "trailing slash ok");
});

test("config: the production host and any other host are refused", () => {
  for (const url of ["https://ritumbhara.intellistay.in", "https://x.intellistay.in", "http://ritumbharatest.aastratech.com",
    "https://ritumbharatest.aastratech.com/api", "https://ritumbharatest.aastratech.com:8443", "https://evil.example.com",
    "https://ritumbharatest.aastratech.com.evil.com", "https://user:pw@ritumbharatest.aastratech.com"]) {
    assert.equal(isAllowedIntellistayBaseUrl(url), false, url);
    const r = getIntellistayConfig(Object.assign({}, ENV, { INTELLISTAY_BASE_URL: url }));
    assert.equal(r.status, "invalid", url);
  }
  const prod = getIntellistayConfig(Object.assign({}, ENV, { INTELLISTAY_BASE_URL: "https://ritumbhara.intellistay.in" }));
  assert.match(prod.problems.join(";"), /production/);
});

test("config: INTELLISTAY_ENV must be test; missing values are named, never shown", () => {
  assert.equal(getIntellistayConfig(Object.assign({}, ENV, { INTELLISTAY_ENV: "production" })).status, "invalid");
  const r = getIntellistayConfig({ INTELLISTAY_PASSWORD: FAKE_PASSWORD });
  assert.equal(r.status, "invalid");
  assert.deepEqual(r.problems.map((p) => p.split(" ")[0]).sort(), ["INTELLISTAY_BASE_URL", "INTELLISTAY_BRANCH_ID", "INTELLISTAY_ENV", "INTELLISTAY_USERNAME"]);
  assertNoSecrets(JSON.stringify(r), "problems");
  assert.equal(getIntellistayConfig(Object.assign({}, ENV, { INTELLISTAY_BRANCH_ID: "abc" })).status, "invalid");
  assert.equal(getIntellistayConfig(Object.assign({}, ENV, { INTELLISTAY_BRANCH_ID: "0" })).status, "invalid");
  const d = JSON.stringify(describeIntellistayConfig(ENV));
  assertNoSecrets(d, "describe");
  assert.ok(!d.includes(FAKE_USERNAME));
});

// ---------- authentication ----------

test("auth: successful login sends UserIdentifier/password/channelId once and uses the Bearer token", async () => {
  const { c, calls, logs } = client({ login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse([rawBooking()]) } });
  const r = await c.fetchBookings();
  assert.equal(r.raw.length, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, TEST_URL + "/api/Login/Login");
  assert.deepEqual(calls[0].body, { UserIdentifier: FAKE_USERNAME, password: FAKE_PASSWORD, channelId: 1 });
  assert.equal(calls[0].init.redirect, "manual");
  assert.equal(calls[1].init.headers.Authorization, "Bearer " + FAKE_TOKEN);
  assert.deepEqual(calls[1].body, { pagination: { page: 1, limit: 50 }, filter: { getAll: true, orderBy: "bookingId", order: "desc", branchId: 1 } });
  assertNoSecrets(logs.join("\n"), "logs");
});

test("auth: the token is reused for a second read (no second login)", async () => {
  const { c, calls } = client({ login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse([rawBooking()]) } });
  await c.fetchBookings();
  await c.fetchBookings();
  assert.equal(calls.filter((x) => x.path === "/api/Login/Login").length, 1);
});

test("auth: wrong credentials (401/400) and 200-without-token fail as auth_failed, without secrets in the error", async () => {
  for (const login of [{ status: 401, body: { message: "Invalid" } }, { status: 400, body: { message: "bad" } }, { status: 200, body: { success: false, message: "Invalid credentials" } }]) {
    const { c, calls, logs } = client({ login, bookings: { status: 200, body: bookingsResponse([]) } });
    await assert.rejects(c.fetchBookings(), (err) => {
      assert.ok(err instanceof IntellistayError);
      assert.equal(err.reason, "auth_failed");
      assertNoSecrets(err.message + JSON.stringify(err), "error");
      return true;
    });
    assert.equal(calls.length, 1, "no booking call after a failed login");
    assertNoSecrets(logs.join("\n"), "logs");
  }
});

test("auth: an expired token (401 on bookings) triggers exactly one re-login and retry", async () => {
  let n = 0;
  const { c, calls } = client({ login: LOGIN_OK, bookings: () => (++n === 1 ? { status: 401, body: {} } : { status: 200, body: bookingsResponse([rawBooking()]) }) });
  const r = await c.fetchBookings();
  assert.equal(r.raw.length, 1);
  assert.deepEqual(calls.map((x) => x.path), ["/api/Login/Login", "/api/Booking/GetAllBookingsByPagination", "/api/Login/Login", "/api/Booking/GetAllBookingsByPagination"]);
  const { c: c2 } = client({ login: LOGIN_OK, bookings: { status: 401, body: {} } });
  await assert.rejects(c2.fetchBookings(), (e) => e.reason === "auth_failed");
});

// ---------- booking retrieval ----------

test("bookings: read at data.bookings; the API ignoring limit (3 returned for limit 2) is fine; pagination null = one page", async () => {
  const list = [rawBooking({ bookingId: 103 }), rawBooking({ bookingId: 102 }), rawBooking({ bookingId: 101 })];
  const { c, calls } = client({ login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse(list) } });
  const r = await c.fetchBookings({ pageSize: 2 });
  assert.equal(r.raw.length, 3);
  assert.equal(r.listPath, "data.bookings");
  assert.equal(r.pagesRead, 1);
  assert.equal(r.truncated, false);
  assert.equal(calls.filter((x) => x.path.includes("Booking")).length, 1);
});

test("bookings: other list locations are tolerated", () => {
  assert.equal(extractBookingList({ data: { items: [1] } }).path, "data.items");
  assert.equal(extractBookingList({ data: [1] }).path, "data");
  assert.equal(extractBookingList({ bookings: [1] }).path, "bookings");
  assert.equal(extractBookingList([1]).path, "(root)");
  assert.equal(extractBookingList({ data: { bookings: null } }), null);
});

test("pagination: follows totalPages, de-duplicates repeats, stops when a page adds nothing, caps the total", async () => {
  const pages = { 1: [rawBooking({ bookingId: 1 }), rawBooking({ bookingId: 2 })], 2: [rawBooking({ bookingId: 2 }), rawBooking({ bookingId: 3 })], 3: [rawBooking({ bookingId: 3 })] };
  const { c, calls } = client({ login: LOGIN_OK, bookings: (body) => ({ status: 200, body: { data: { bookings: pages[body.pagination.page], pagination: { totalPages: 5 } } } }) });
  const r = await c.fetchBookings();
  assert.deepEqual(r.raw.map((b) => b.bookingId), [1, 2, 3]);
  assert.equal(r.pagesRead, 3, "page 3 added nothing new, so page 4 is not requested");
  assert.equal(calls.filter((x) => x.path.includes("Booking")).length, 3);

  // A server that ignores `page` and returns the same list forever is read once.
  const same = client({ login: LOGIN_OK, bookings: { status: 200, body: { data: { bookings: [rawBooking()], pagination: { totalPages: 99 } } } } });
  const r2 = await same.c.fetchBookings();
  assert.equal(r2.raw.length, 1);
  assert.equal(r2.pagesRead, 2);

  const many = Array.from({ length: 30 }, (_, i) => rawBooking({ bookingId: i + 1 }));
  const capped = client({ login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse(many) } });
  const r3 = await capped.c.fetchBookings({ maxBookings: 10 });
  assert.equal(r3.raw.length, 10);
  assert.equal(r3.truncated, true);
});

test("malformed responses: non-JSON, missing list, empty body -> bad_response; 5xx -> http_5xx; redirect refused", async () => {
  for (const [bookings, reason] of [
    [{ status: 200, body: "<html>oops</html>" }, "bad_response"],
    [{ status: 200, body: { data: { something: 1 } } }, "bad_response"],
    [{ status: 200, body: "" }, "bad_response"],
    [{ status: 503, body: {} }, "http_5xx"],
    [{ status: 404, body: {} }, "http_4xx"],
    [{ status: 302, body: "" }, "redirect"],
  ]) {
    const { c } = client({ login: LOGIN_OK, bookings });
    await assert.rejects(c.fetchBookings(), (e) => e instanceof IntellistayError && e.reason === reason, JSON.stringify(bookings));
  }
});

test("timeout and network errors are reported as such", async () => {
  const hang = (body, calls, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; reject(e); });
  });
  const { c } = client({ login: hang }, { timeoutMs: 20 });
  await assert.rejects(c.fetchBookings(), (e) => e.reason === "timeout");
  const { c: c2 } = client({ login: new TypeError("fetch failed") });
  await assert.rejects(c2.fetchBookings(), (e) => e.reason === "network");
});

test("the client refuses to call a non-test host even if handed one directly", async () => {
  const calls = [];
  const c = createIntellistayClient({ config: Object.assign({}, CONFIG, { baseUrl: "https://ritumbhara.intellistay.in" }), fetchImpl: intellistayFetch({ login: LOGIN_OK }, calls), log() {} });
  await assert.rejects(c.fetchBookings(), (e) => e.reason === "blocked_host");
  assert.equal(calls.length, 0, "no request was made");
});

// ---------- normalization ----------

test("normalize: our booking type, with no payment data, email or address", () => {
  const r = normalizeBooking(rawBooking({ specialRequest: SPECIAL_REQUEST_TEXT }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.booking, {
    bookingId: "101", bookingCode: "BK101", branchId: 1, branchName: "Test Branch", statusId: 1, statusName: "Reserved",
    checkInDate: "2026-10-20", checkOutDate: "2026-10-22", nights: 2, adults: 2, children: 0,
    rooms: [{ roomTypeName: "Studio", roomNo: "925", roomId: null, roomTypeId: null }], source: "Walk-In", specialRequest: SPECIAL_REQUEST_TEXT,
    guest: { firstName: "Asha", phone: GUEST_E164 },
  });
  const text = JSON.stringify(r.booking);
  for (const s of ["45678", "12345", "3333", "Paid", GUEST_EMAIL, GUEST_ADDRESS]) assert.ok(!text.includes(s), s);
});

test("normalize: missing or bad required fields reject the booking by field name; optional fields become null", () => {
  assert.deepEqual(normalizeBooking(null), { ok: false, bookingId: null, problem: "booking" });
  assert.equal(normalizeBooking(rawBooking({ bookingId: undefined })).problem, "bookingId");
  assert.equal(normalizeBooking(rawBooking({ checkInDate: "soon" })).problem, "checkInDate");
  assert.equal(normalizeBooking(rawBooking({ checkOutDate: null })).problem, "checkOutDate");
  assert.equal(normalizeBooking(rawBooking({ checkOutDate: "2026-10-19T11:00:00" })).problem, "checkOutDate", "checkout before check-in");
  const sparse = normalizeBooking({ bookingId: "7", checkInDate: "2026-10-20", checkOutDate: "2026-10-21" });
  assert.equal(sparse.ok, true);
  assert.deepEqual(sparse.booking, {
    bookingId: "7", bookingCode: null, branchId: null, branchName: null, statusId: null, statusName: null,
    checkInDate: "2026-10-20", checkOutDate: "2026-10-21", nights: 1, adults: null, children: null, rooms: [],
    source: null, specialRequest: null, guest: { firstName: null, phone: null },
  });
  const list = normalizeBookings([rawBooking(), rawBooking(), rawBooking({ bookingId: 0 }), "x"]);
  assert.equal(list.bookings.length, 1, "duplicate bookingId kept once");
  assert.deepEqual(list.rejected.map((x) => x.problem), ["bookingId", "booking"]);
});

test("normalize: dates are India-time; inconsistent noOfDays is recomputed", () => {
  assert.equal(istDateFromIntellistay("2026-10-20T23:30:00"), "2026-10-20");
  assert.equal(istDateFromIntellistay("2026-10-20T20:00:00Z"), "2026-10-21", "20:00 UTC is 01:30 next day in India");
  assert.equal(istDateFromIntellistay("2026-02-30"), null);
  assert.equal(normalizeBooking(rawBooking({ noOfDays: 9 })).booking.nights, 2);
});

test("normalize: phone numbers are built safely; anything unclear is null", () => {
  assert.equal(phoneFrom("9876543210", "+91"), GUEST_E164);
  assert.equal(phoneFrom("9876543210", "91"), GUEST_E164);
  assert.equal(phoneFrom("919876543210", "91"), GUEST_E164, "country code repeated in the mobile field");
  assert.equal(phoneFrom("9876543210", ""), GUEST_E164, "assumed Indian mobile (documented)");
  assert.equal(phoneFrom("+447700900123", null), "+447700900123");
  assert.equal(phoneFrom("12345", ""), null);
  assert.equal(phoneFrom("call me", "+91"), null);
  assert.equal(phoneFrom("", "+91"), null);
  assert.equal(firstNameFrom("  asha   verma "), "Asha");
  assert.equal(firstNameFrom("asha@example.com"), null);
  assert.equal(firstNameFrom("12345"), null);
});

test("fetchNormalizedBookings logs counts and field names only", async () => {
  const { c, logs } = client({ login: LOGIN_OK, bookings: { status: 200, body: bookingsResponse([rawBooking({ specialRequest: SPECIAL_REQUEST_TEXT }), rawBooking({ bookingId: 5, checkInDate: "x" })]) } });
  const r = await c.fetchNormalizedBookings();
  assert.equal(r.bookings.length, 1);
  assert.deepEqual(r.rejected, [{ bookingId: "5", problem: "checkInDate" }]);
  assertNoSecrets(logs.join("\n"), "logs");
  assert.ok(logs.some((l) => l.startsWith("bookings_rejected") && l.includes("checkInDate")));
});

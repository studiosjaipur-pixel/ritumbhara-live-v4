import { isAllowedIntellistayBaseUrl, type IntellistayConfig } from "./config";
import { normalizeBookings } from "./normalize";
import type { IntellistayTokenStore } from "./token-store";
import type { NormalizeResult } from "./types";

// Week 7: read-only Intellistay client. SERVER-ONLY.
//
// - Calls only the configured base URL, and only if it is the allowed TEST host (re-checked on every request).
// - Two endpoints: POST /api/Login/Login and POST /api/Booking/GetAllBookingsByPagination. Nothing is ever written
//   to Intellistay.
// - The access token lives in this client's memory and, only when a tokenStore is passed (the guest-messages ask
//   route), in that server-side cache. It is never logged, returned or put in an error.
// - Every request has a timeout and does not follow redirects (a redirect could lead to another host).
// - Errors carry a short reason code only: no URL, credentials, token or response body.
// - The booking reader is defensive: the test API ignored `limit` and returned pagination = null, so it reads the
//   list wherever it is, stops when pagination does not promise more pages, de-duplicates by bookingId and caps the
//   total.

if (typeof window !== "undefined") {
  throw new Error("lib/intellistay/client is server-only and must not be imported in browser code.");
}

export const LOGIN_PATH = "/api/Login/Login";
export const BOOKINGS_PATH = "/api/Booking/GetAllBookingsByPagination";
export const DEFAULT_TIMEOUT_MS = 15000;
// The API did not report token expiry in the test responses; refresh well before an hour, and on any 401.
export const TOKEN_TTL_MS = 50 * 60 * 1000;
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_MAX_PAGES = 5;
export const DEFAULT_MAX_BOOKINGS = 500;

export type IntellistayErrorReason =
  | "blocked_host" | "auth_failed" | "timeout" | "network" | "redirect" | "http_4xx" | "http_5xx" | "bad_response";

export class IntellistayError extends Error {
  reason: IntellistayErrorReason;
  status: number | null;
  constructor(reason: IntellistayErrorReason, status?: number | null) {
    super("Intellistay request failed: " + reason + (status ? " (HTTP " + status + ")" : ""));
    this.name = "IntellistayError";
    this.reason = reason;
    this.status = status || null;
    Object.setPrototypeOf(this, IntellistayError.prototype); // keeps instanceof working when compiled to ES5
  }
}

export type IntellistayLogFn = (event: string, meta?: Record<string, string | number | boolean>) => void;

export interface IntellistayClientOptions {
  config: IntellistayConfig;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: () => number;
  log?: IntellistayLogFn;
  // Optional shared token cache (Redis; see token-store.ts). Without it the token stays in memory only, as before.
  tokenStore?: IntellistayTokenStore;
}

export interface FetchBookingsOptions {
  pageSize?: number;
  maxPages?: number;
  maxBookings?: number;
}

export interface FetchBookingsResult {
  raw: unknown[];
  pagesRead: number;
  listPath: string; // where the list was found, e.g. "data.bookings"
  truncated: boolean; // true when maxBookings or maxPages stopped the read while more were promised
}

export interface IntellistayClient {
  login(): Promise<void>;
  fetchBookings(options?: FetchBookingsOptions): Promise<FetchBookingsResult>;
  fetchNormalizedBookings(options?: FetchBookingsOptions): Promise<NormalizeResult & { pagesRead: number; truncated: boolean }>;
}

type Raw = Record<string, unknown>;

function isObject(v: unknown): v is Raw {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// The access token, wherever this API version puts it.
export function extractToken(body: unknown): string | null {
  if (!isObject(body)) return null;
  const data = isObject(body.data) ? body.data : {};
  const result = isObject(body.result) ? body.result : {};
  const candidates = [body.accessToken, data.accessToken, result.accessToken, body.token, data.token];
  for (let i = 0; i < candidates.length; i++) {
    const t = candidates[i];
    if (typeof t === "string" && t.length >= 10 && t.length <= 8192) return t;
  }
  return null;
}

// The bookings array and its path. data.bookings is what the test API returned; the others are tolerated.
export function extractBookingList(body: unknown): { list: unknown[]; path: string } | null {
  if (Array.isArray(body)) return { list: body, path: "(root)" };
  if (!isObject(body)) return null;
  const data = body.data;
  if (isObject(data)) {
    if (Array.isArray(data.bookings)) return { list: data.bookings, path: "data.bookings" };
    if (Array.isArray(data.items)) return { list: data.items, path: "data.items" };
  }
  if (Array.isArray(data)) return { list: data, path: "data" };
  if (Array.isArray(body.bookings)) return { list: body.bookings, path: "bookings" };
  if (Array.isArray(body.items)) return { list: body.items, path: "items" };
  return null;
}

// totalPages if the response states it, otherwise null (the test API returned pagination = null).
export function extractTotalPages(body: unknown): number | null {
  if (!isObject(body)) return null;
  const data = isObject(body.data) ? body.data : {};
  const p = isObject(data.pagination) ? data.pagination : isObject(body.pagination) ? body.pagination : null;
  if (!p) return null;
  const n = typeof p.totalPages === "number" ? p.totalPages : typeof p.totalPages === "string" ? Number(p.totalPages) : NaN;
  return isFinite(n) && n >= 0 && n % 1 === 0 ? n : null;
}

function bookingKey(raw: unknown): string | null {
  if (!isObject(raw)) return null;
  const id = raw.bookingId;
  return typeof id === "number" || (typeof id === "string" && id.trim()) ? String(id).trim() : null;
}

export function createIntellistayClient(options: IntellistayClientOptions): IntellistayClient {
  const config = options.config;
  const doFetch = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const nowMs = options.nowMs || Date.now;
  const tokenStore = options.tokenStore;
  const log: IntellistayLogFn = options.log || function (event, meta) {
    console.warn("[intellistay] " + event + (meta ? " " + JSON.stringify(meta) : ""));
  };

  let token: string | null = null;
  let tokenExpiresAt = 0;

  async function post(path: string, body: unknown, bearer: string | null): Promise<{ status: number; json: unknown }> {
    // Re-checked on every call: only the allowed test host, never production.
    if (!isAllowedIntellistayBaseUrl(config.baseUrl)) throw new IntellistayError("blocked_host");
    const url = config.baseUrl + path;
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (bearer) headers.Authorization = "Bearer " + bearer;
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    let res: Response;
    let text: string;
    try {
      try {
        res = await doFetch(url, { method: "POST", headers: headers, body: JSON.stringify(body), redirect: "manual", signal: controller.signal, cache: "no-store" });
      } catch (err) {
        throw new IntellistayError(err instanceof Error && err.name === "AbortError" ? "timeout" : "network");
      }
      try {
        text = await res.text();
      } catch (err) {
        throw new IntellistayError(err instanceof Error && err.name === "AbortError" ? "timeout" : "network", res.status);
      }
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 0 || (res.status >= 300 && res.status < 400) || res.type === "opaqueredirect") throw new IntellistayError("redirect", res.status || null);
    let json: unknown = null;
    if (text) {
      try { json = JSON.parse(text); } catch { json = undefined; }
    }
    return { status: res.status, json: json };
  }

  async function login(): Promise<void> {
    token = null;
    const r = await post(LOGIN_PATH, { UserIdentifier: config.username, password: config.password, channelId: 1 }, null);
    if (r.status === 400 || r.status === 401 || r.status === 403) {
      log("login_failed", { status: r.status });
      throw new IntellistayError("auth_failed", r.status);
    }
    if (r.status >= 500) throw new IntellistayError("http_5xx", r.status);
    if (r.status < 200 || r.status >= 300) throw new IntellistayError("http_4xx", r.status);
    const t = extractToken(r.json);
    if (!t) {
      // A 200 without a token is treated as a failed login (some APIs answer 200 with success=false).
      log("login_failed", { status: r.status, tokenReturned: false });
      throw new IntellistayError("auth_failed", r.status);
    }
    token = t;
    tokenExpiresAt = nowMs() + TOKEN_TTL_MS;
    log("login_ok");
    if (tokenStore) {
      try {
        await tokenStore.set(t, tokenExpiresAt);
      } catch {
        log("token_cache_unavailable", { op: "set" });
      }
    }
  }

  // A token from the shared cache, if one is there and still valid. A cache failure is treated as a miss.
  async function tokenFromStore(): Promise<boolean> {
    if (!tokenStore) return false;
    try {
      const cached = await tokenStore.get();
      if (!cached || nowMs() >= cached.expiresAtMs) {
        log("token_cache_miss");
        return false;
      }
      token = cached.token;
      tokenExpiresAt = cached.expiresAtMs;
      log("token_cache_hit");
      return true;
    } catch {
      log("token_cache_unavailable", { op: "get" });
      return false;
    }
  }

  async function authorizedPost(path: string, body: unknown): Promise<unknown> {
    if (!token || nowMs() >= tokenExpiresAt) {
      if (!(await tokenFromStore())) await login();
    }
    let r = await post(path, body, token);
    if (r.status === 401) {
      // Token expired or revoked: drop the cached copy, log in again once (which caches the new one), retry once.
      log("token_rejected_relogin");
      token = null;
      if (tokenStore) {
        try {
          await tokenStore.clear();
        } catch {
          log("token_cache_unavailable", { op: "clear" });
        }
      }
      await login();
      r = await post(path, body, token);
      if (r.status === 401) throw new IntellistayError("auth_failed", 401);
    }
    if (r.status >= 500) throw new IntellistayError("http_5xx", r.status);
    if (r.status < 200 || r.status >= 300) throw new IntellistayError("http_4xx", r.status);
    if (r.json === undefined || r.json === null) throw new IntellistayError("bad_response", r.status);
    return r.json;
  }

  async function fetchBookings(opts?: FetchBookingsOptions): Promise<FetchBookingsResult> {
    const o = opts || {};
    const pageSize = Math.max(1, Math.min(o.pageSize || DEFAULT_PAGE_SIZE, 200));
    const maxPages = Math.max(1, Math.min(o.maxPages || DEFAULT_MAX_PAGES, 50));
    const maxBookings = Math.max(1, Math.min(o.maxBookings || DEFAULT_MAX_BOOKINGS, 5000));
    const out: unknown[] = [];
    const seen: Record<string, boolean> = {};
    let listPath = "";
    let pagesRead = 0;
    let truncated = false;

    for (let page = 1; page <= maxPages; page++) {
      const body = await authorizedPost(BOOKINGS_PATH, {
        pagination: { page: page, limit: pageSize },
        filter: { getAll: true, orderBy: "bookingId", order: "desc", branchId: config.branchId },
      });
      const found = extractBookingList(body);
      if (!found) throw new IntellistayError("bad_response");
      pagesRead = page;
      if (!listPath) listPath = found.path;

      let added = 0;
      for (let i = 0; i < found.list.length; i++) {
        const item = found.list[i];
        const key = bookingKey(item);
        if (key !== null) {
          if (seen[key]) continue;
          seen[key] = true;
        }
        if (out.length >= maxBookings) { truncated = true; break; }
        out.push(item);
        added++;
      }
      if (truncated) break;

      // Only continue when the response promises more pages AND this page added something new (a server that
      // ignores `page` would otherwise return the same list forever).
      const totalPages = extractTotalPages(body);
      if (totalPages === null || page >= totalPages || added === 0) break;
      if (page === maxPages) truncated = true;
    }
    log("bookings_read", { pages: pagesRead, count: out.length, truncated: truncated, path: listPath });
    return { raw: out, pagesRead: pagesRead, listPath: listPath, truncated: truncated };
  }

  async function fetchNormalizedBookings(opts?: FetchBookingsOptions) {
    const r = await fetchBookings(opts);
    const n = normalizeBookings(r.raw);
    if (n.rejected.length) {
      // Field names and booking IDs only (opaque numbers), never guest data.
      log("bookings_rejected", { count: n.rejected.length, problems: n.rejected.map(function (x) { return x.problem; }).join(",") });
    }
    return { bookings: n.bookings, rejected: n.rejected, pagesRead: r.pagesRead, truncated: r.truncated };
  }

  return { login: login, fetchBookings: fetchBookings, fetchNormalizedBookings: fetchNormalizedBookings };
}

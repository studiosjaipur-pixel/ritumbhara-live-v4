// Week 7: Intellistay PMS connection settings. SERVER-ONLY.
//
// Every value comes from environment variables; no credential is ever written in code. Only the Intellistay TEST
// server is supported for now: INTELLISTAY_ENV must be "test" and INTELLISTAY_BASE_URL must be exactly the test URL.
// The production host (and anything else under intellistay.in) is refused here, so production can never be called
// by accident while Week 7 is being built and tested. Supporting production later is a deliberate code change.
// Never import this module from a client component.

if (typeof window !== "undefined") {
  throw new Error("lib/intellistay/config is server-only and must not be imported in browser code.");
}

type Env = Record<string, string | undefined>;

export const INTELLISTAY_TEST_BASE_URL = "https://ritumbharatest.aastratech.com";
// Hosts the client may call. Only the test server for now.
export const INTELLISTAY_ALLOWED_HOSTS = ["ritumbharatest.aastratech.com"];
// Never called from this project during Week 7, even if configured.
export const INTELLISTAY_BLOCKED_HOST_PATTERN = /(^|\.)intellistay\.in$/i;

export const INTELLISTAY_ENVIRONMENTS = ["test"] as const;
export type IntellistayEnvironment = (typeof INTELLISTAY_ENVIRONMENTS)[number];

export interface IntellistayConfig {
  environment: IntellistayEnvironment;
  baseUrl: string; // no trailing slash
  username: string;
  password: string;
  branchId: number;
}

export type IntellistayConfigResult =
  | { status: "invalid"; problems: string[] } // variable names and reasons only, never values
  | { status: "ready"; config: IntellistayConfig };

function read(env: Env, name: string): string {
  const v = env[name];
  return typeof v === "string" ? v.trim() : "";
}

// True only for an https URL on an allowed (test) host, with no path, query, credentials or port.
export function isAllowedIntellistayBaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  if (url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return false;
  const host = url.hostname.toLowerCase();
  if (INTELLISTAY_BLOCKED_HOST_PATTERN.test(host)) return false;
  return INTELLISTAY_ALLOWED_HOSTS.indexOf(host) !== -1;
}

// Reads and validates the Intellistay settings. Never throws and never includes secret values in its result.
export function getIntellistayConfig(env: Env = process.env): IntellistayConfigResult {
  const problems: string[] = [];

  const environment = read(env, "INTELLISTAY_ENV").toLowerCase();
  if (!environment) problems.push("INTELLISTAY_ENV is not set (use \"test\")");
  else if ((INTELLISTAY_ENVIRONMENTS as readonly string[]).indexOf(environment) === -1) {
    problems.push("INTELLISTAY_ENV must be \"test\" (only the Intellistay test server is supported)");
  }

  const baseUrl = read(env, "INTELLISTAY_BASE_URL").replace(/\/+$/, "");
  if (!baseUrl) problems.push("INTELLISTAY_BASE_URL is not set");
  else if (/intellistay\.in/i.test(baseUrl)) problems.push("INTELLISTAY_BASE_URL points at the production Intellistay host, which is not allowed");
  else if (!isAllowedIntellistayBaseUrl(baseUrl)) problems.push("INTELLISTAY_BASE_URL must be " + INTELLISTAY_TEST_BASE_URL);

  const username = read(env, "INTELLISTAY_USERNAME");
  if (!username) problems.push("INTELLISTAY_USERNAME is not set");
  // The password is not trimmed (spaces could be part of it); it only has to be non-empty.
  const password = typeof env.INTELLISTAY_PASSWORD === "string" ? env.INTELLISTAY_PASSWORD : "";
  if (!password) problems.push("INTELLISTAY_PASSWORD is not set");

  const branchRaw = read(env, "INTELLISTAY_BRANCH_ID");
  const branchId = /^\d{1,9}$/.test(branchRaw) ? Number(branchRaw) : NaN;
  if (!branchRaw) problems.push("INTELLISTAY_BRANCH_ID is not set");
  else if (!(branchId > 0)) problems.push("INTELLISTAY_BRANCH_ID must be a positive whole number");

  if (problems.length) return { status: "invalid", problems: problems };
  return {
    status: "ready",
    config: { environment: environment as IntellistayEnvironment, baseUrl: baseUrl, username: username, password: password, branchId: branchId },
  };
}

// Safe description for logs: which settings are present, never their values.
export function describeIntellistayConfig(env: Env = process.env): Record<string, boolean | string> {
  return {
    INTELLISTAY_ENV: read(env, "INTELLISTAY_ENV") || "(not set)",
    INTELLISTAY_BASE_URL: isAllowedIntellistayBaseUrl(read(env, "INTELLISTAY_BASE_URL").replace(/\/+$/, "")) ? "test server" : read(env, "INTELLISTAY_BASE_URL") ? "not allowed" : "(not set)",
    INTELLISTAY_USERNAME: !!read(env, "INTELLISTAY_USERNAME"),
    INTELLISTAY_PASSWORD: !!env.INTELLISTAY_PASSWORD,
    INTELLISTAY_BRANCH_ID: !!read(env, "INTELLISTAY_BRANCH_ID"),
  };
}

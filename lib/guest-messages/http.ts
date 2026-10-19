import { createHash, timingSafeEqual } from "crypto";

// Week 7: shared helpers for the Guest Messages API routes. SERVER-ONLY.
//
// Both routes (/api/guest-messages/run and /api/guest-messages/ask) are OFF (404) unless GUEST_MESSAGES_ENABLED is
// exactly "true", and require Authorization: Bearer <GUEST_MESSAGES_API_SECRET> (at least 32 characters).

if (typeof window !== "undefined") {
  throw new Error("lib/guest-messages/http is server-only and must not be imported in browser code.");
}

export const API_MIN_SECRET_LENGTH = 32;
export const API_MAX_BODY_BYTES = 4096;

type Env = Record<string, string | undefined>;

export type ApiConfigResult =
  | { status: "disabled" }
  | { status: "invalid"; problems: string[] } // names and reasons only, never values
  | { status: "ready"; secret: string };

export function getGuestMessagesApiConfig(env: Env = process.env): ApiConfigResult {
  if ((env.GUEST_MESSAGES_ENABLED || "").trim().toLowerCase() !== "true") return { status: "disabled" };
  const secret = (env.GUEST_MESSAGES_API_SECRET || "").trim();
  if (!secret) return { status: "invalid", problems: ["GUEST_MESSAGES_API_SECRET is not set"] };
  if (secret.length < API_MIN_SECRET_LENGTH) return { status: "invalid", problems: ["GUEST_MESSAGES_API_SECRET must be at least " + API_MIN_SECRET_LENGTH + " characters"] };
  return { status: "ready", secret: secret };
}

// Constant-time comparison (both sides hashed to equal length first).
export function secretMatches(presented: string, expected: string): boolean {
  const a = createHash("sha256").update(presented, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b) && presented.length === expected.length;
}

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// Feature switch, secret and a small JSON object body. Returns the parsed body or the error Response to send.
export async function readAuthorizedJson(req: Request, getConfig: () => ApiConfigResult, log: (event: string, meta?: Record<string, string | number | boolean>) => void):
  Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const config = getConfig();
  if (config.status === "disabled") return { ok: false, response: json(404, { ok: false, error: "disabled" }) };
  if (config.status === "invalid") {
    log("config_invalid", { problems: config.problems.join("; ") });
    return { ok: false, response: json(503, { ok: false, error: "misconfigured" }) };
  }
  const presented = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (!presented || !secretMatches(presented[1].trim(), config.secret)) {
    log("unauthorized");
    return { ok: false, response: json(401, { ok: false, error: "unauthorized" }) };
  }
  if ((req.headers.get("content-type") || "").toLowerCase().indexOf("application/json") !== 0) {
    return { ok: false, response: json(415, { ok: false, error: "unsupported_media_type" }) };
  }
  if (Number(req.headers.get("content-length") || "0") > API_MAX_BODY_BYTES) return { ok: false, response: json(413, { ok: false, error: "too_large" }) };
  const raw = await req.text();
  if (raw.length > API_MAX_BODY_BYTES) return { ok: false, response: json(413, { ok: false, error: "too_large" }) };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, response: json(400, { ok: false, error: "bad_request", field: "body" }) };
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, response: json(400, { ok: false, error: "bad_json" }) };
  }
}

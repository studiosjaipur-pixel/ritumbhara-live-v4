// WhatsApp address helpers (Week 5 stretch). Pure functions, no dependencies.
// Twilio sends WhatsApp addresses as "whatsapp:+<E.164>", e.g. "whatsapp:+919000000001".

const E164 = /^\+[1-9]\d{7,14}$/;

// "whatsapp:+919000000001" -> "+919000000001". Returns null for anything that is not a WhatsApp E.164 address.
export function parseWhatsAppAddress(address: string | null | undefined): string | null {
  if (typeof address !== "string") return null;
  const m = address.trim().match(/^whatsapp:(\+\d+)$/i);
  return m && E164.test(m[1]) ? m[1] : null;
}

// Phone number in any common written form ("+91 90000 00001", "+91-9000000001", "919000000001") -> E.164.
// Requires the country code. Returns null when it cannot be normalized safely.
export function normalizePhoneNumber(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const e164 = "+" + digits;
  return E164.test(e164) ? e164 : null;
}

// Last 4 digits only, for logs (never log full numbers).
export function maskPhoneNumber(e164: string | null | undefined): string {
  if (typeof e164 !== "string" || e164.length < 4) return "****";
  return "***" + e164.slice(-4);
}

// Display form for messages: "+919000000009" -> "+91 9000000009" (Indian numbers); other numbers stay E.164.
export function formatPhoneForDisplay(e164: string): string {
  const m = /^\+91(\d{10})$/.exec(e164);
  return m ? "+91 " + m[1] : e164;
}

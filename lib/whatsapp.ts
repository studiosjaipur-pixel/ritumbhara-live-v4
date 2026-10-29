// Website WhatsApp CTAs (Week 5: Website -> WhatsApp leads).
//
// Every WhatsApp link on the site is built here, so the number and the reference-code format live in one
// place. The number is the Twilio-connected WhatsApp sender (founder instruction); Preview deployments can point it at
// a test number with NEXT_PUBLIC_WHATSAPP_CTA_NUMBER (see resolveWhatsAppNumber). The general phone number
// (+91 95030 02629, used for calls, the footer and structured data) is separate and unchanged.
//
// Each link carries a deterministic reference code (e.g. "W-PROP-studio-925") on the last line of the
// pre-filled message, so the team can see which page/button a WhatsApp conversation came from. A click is
// only "lead intent": the website never learns the visitor's WhatsApp number.

export const PRODUCTION_WHATSAPP_NUMBER = "918306312778";
export const PRODUCTION_WHATSAPP_DISPLAY_NUMBER = "+91 83063 12778";

// Preview-only override, for testing against the Meta TEST number without sending visitors to the production
// number. NEXT_PUBLIC_WHATSAPP_CTA_NUMBER is set ONLY for the Vercel Preview environment (never Production).
// It is ignored when Vercel says this is Production (NEXT_PUBLIC_VERCEL_ENV=production) and when it is not a valid
// international number (8-15 digits, "+" and spaces allowed). Without it the production number is used, unchanged.
export function resolveWhatsAppNumber(override: string | undefined, vercelEnv: string | undefined): { number: string; display: string } {
  const digits = (override || "").replace(/[\s+]/g, "");
  if ((vercelEnv || "").trim().toLowerCase() !== "production" && /^[1-9]\d{7,14}$/.test(digits)) {
    return { number: digits, display: "+" + digits };
  }
  return { number: PRODUCTION_WHATSAPP_NUMBER, display: PRODUCTION_WHATSAPP_DISPLAY_NUMBER };
}

// Literal process.env.NEXT_PUBLIC_* reads, so Next.js inlines them into the browser bundle at build time.
const RESOLVED = resolveWhatsAppNumber(process.env.NEXT_PUBLIC_WHATSAPP_CTA_NUMBER, process.env.NEXT_PUBLIC_VERCEL_ENV);

export const WHATSAPP_NUMBER = RESOLVED.number;
export const WHATSAPP_DISPLAY_NUMBER = RESOLVED.display;
export const WHATSAPP_BASE_URL = "https://wa.me/" + WHATSAPP_NUMBER;

// Reference codes: "W-" followed by upper-case context parts and an optional lower-case slug,
// e.g. W-FLOATING, W-CONTACT, W-HOME-AVAILABILITY, W-PROP-studio-925, W-PAGE-stays-in-sariska-AVAILABILITY.
export const WHATSAPP_REF_PATTERN = /^W-[A-Za-z0-9-]{1,80}$/;

function cleanPart(part: string): string {
  return part.replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function makeWhatsAppRef(...parts: string[]): string {
  const body = parts.map(cleanPart).filter(Boolean).join("-");
  return "W-" + (body || "SITE");
}

// Reference code for the page a widget sits on, from its pathname. Deterministic, so it is identical on the
// server and in the browser.
export function pageRefFromPath(pathname: string): string {
  const segments = (pathname || "/").split("/").filter(Boolean);
  if (segments.length === 0) return "HOME";
  const [section, slug] = segments;
  if (section === "destinations" && slug) return "DEST-" + slug;
  if (section === "journal" && slug) return "JOURNAL-" + slug;
  if (section === "properties" && slug) return "PROP-" + slug;
  return "PAGE-" + segments.join("-");
}

// The pre-filled message is the visible text plus a final "Ref:" line. URL-encoded as a whole.
export function buildWhatsAppMessage(message: string, ref: string): string {
  const text = (message || "").trim();
  return (text ? text + "\n\n" : "") + "Ref: " + ref;
}

export function buildWhatsAppUrl(message: string, ref: string): string {
  return WHATSAPP_BASE_URL + "?text=" + encodeURIComponent(buildWhatsAppMessage(message, ref));
}

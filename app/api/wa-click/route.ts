import { NextResponse } from "next/server";
import { WHATSAPP_NUMBER, WHATSAPP_REF_PATTERN } from "@/lib/whatsapp";
import { emit } from "@/lib/events/bus";
import "@/lib/leads/apps-script-sink"; // registers the WHATSAPP_CLICK handler (Google Sheet + team email)

// Week 5: receives "Lead Intent" events from components/WhatsAppClickTracker.tsx, validates them and emits
// WHATSAPP_CLICK on the event bus. The handler in lib/leads/apps-script-sink.ts sends the event to a Google
// Apps Script web app, which appends a row to the leads Sheet and emails the team.
// The Apps Script URL and secret are server-only environment variables, never sent to the browser.
// This route always fails quietly: tracking problems must never affect visitors opening WhatsApp.

export const dynamic = "force-dynamic";
export const maxDuration = 15; // allows for an Apps Script cold start (the sink itself times out at 8 s)

const MAX_BODY_BYTES = 4096;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const CTA_VALUES = ["floating", "availability", "property", "contact", ""];

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isoDateOrEmpty(value: unknown): string {
  const v = str(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

function noContent() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: Request) {
  try {
    // Only accept events from this site's own pages (the browser sends Origin with sendBeacon/fetch).
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) return new NextResponse(null, { status: 403 });
      } catch {
        return new NextResponse(null, { status: 403 });
      }
    }

    const raw = await req.text();
    if (!raw || raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 400 });

    let input: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new NextResponse(null, { status: 400 });
      input = parsed as Record<string, unknown>;
    } catch {
      return new NextResponse(null, { status: 400 });
    }

    // Validate: allow-listed fields only, length-capped strings.
    const ref = str(input.ref, 90);
    const page = str(input.page, 300);
    const cta = str(input.cta, 30);
    const destination = str(input.whatsappDestination, 60);
    if (!WHATSAPP_REF_PATTERN.test(ref) || !page.startsWith("/") || CTA_VALUES.indexOf(cta) === -1 || destination !== "wa.me/" + WHATSAPP_NUMBER) {
      return new NextResponse(null, { status: 400 });
    }

    const ctxIn = input.context && typeof input.context === "object" && !Array.isArray(input.context) ? (input.context as Record<string, unknown>) : {};
    const guests = str(ctxIn.guests, 3);

    const event: Record<string, unknown> = {
      event: "WhatsApp Click",
      status: "Lead Intent",
      clientTimestamp: str(input.timestamp, 40),
      receivedAt: new Date().toISOString(),
      site: host || "",
      page: page,
      ref: ref,
      cta: cta,
      whatsappDestination: destination,
      referrer: str(input.referrer, 300),
      context: {
        destination: str(ctxIn.destination, 40).replace(/[^a-z0-9-]/gi, ""),
        checkIn: isoDateOrEmpty(ctxIn.checkIn),
        checkOut: isoDateOrEmpty(ctxIn.checkOut),
        guests: /^(\d{1,2}\+?)$/.test(guests) ? guests : "",
      },
    };
    UTM_KEYS.forEach(function (k) {
      event[k] = str(input[k], 200);
    });

    // Handlers never throw out of emit(); failures are logged and the visitor is unaffected.
    await emit("WHATSAPP_CLICK", event);

    return noContent();
  } catch (err) {
    console.warn("[wa-click] Unexpected error:", err instanceof Error ? err.message : err);
    return noContent();
  }
}

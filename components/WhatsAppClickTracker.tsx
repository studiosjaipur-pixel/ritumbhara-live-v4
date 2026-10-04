"use client";
import { useEffect } from "react";

// Week 5: records clicks on any WhatsApp link (a[href*="wa.me/"]) as a "Lead Intent" event.
// A click is not a confirmed lead: the website never learns the visitor's WhatsApp number.
// Events go to this site's own /api/wa-click route (which logs them to the Google Sheet and emails the team),
// never straight to Google.
// Sent with navigator.sendBeacon so tracking never delays or blocks opening WhatsApp, and every step is
// wrapped so a tracking error can't break the link.

const ENDPOINT = "/api/wa-click";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const UTM_STORAGE_KEY = "rb_utm";

type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

function utmFrom(search: string): Utm {
  const params = new URLSearchParams(search);
  const out: Utm = {};
  UTM_KEYS.forEach(function (k) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 200);
  });
  return out;
}

// UTMs from the current URL; otherwise the ones seen earlier in this browser session (landing page), so a
// campaign visit is still attributed after the visitor clicks through to another page.
function currentUtm(): Utm {
  const fromUrl = utmFrom(window.location.search);
  try {
    if (Object.keys(fromUrl).length > 0) {
      window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const saved = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Utm) : {};
  } catch {
    return fromUrl;
  }
}

// Referrer as origin + path only (query strings can carry personal data).
function cleanReferrer(): string {
  try {
    if (!document.referrer) return "";
    const u = new URL(document.referrer);
    return u.origin + u.pathname;
  } catch {
    return "";
  }
}

function waDestination(href: string): string {
  try {
    const u = new URL(href);
    return u.hostname + u.pathname; // e.g. "wa.me/918306312778" (the message text is not sent)
  } catch {
    return "";
  }
}

function refFromHref(href: string): string {
  try {
    const text = new URL(href).searchParams.get("text") || "";
    const m = text.match(/Ref:\s*(W-[A-Za-z0-9-]+)\s*$/);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      if (queued) return;
    }
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
  } catch {
    // Tracking must never interfere with opening WhatsApp.
  }
}

export default function WhatsAppClickTracker() {
  useEffect(function () {
    // Keep UTMs from the landing page for later clicks in this session.
    try { currentUtm(); } catch {}

    function onClick(e: MouseEvent) {
      try {
        if (e.type === "auxclick" && e.button !== 1) return; // middle-click opens in a new tab; ignore right-click
        const target = e.target as Element | null;
        const link = target && target.closest ? (target.closest('a[href*="wa.me/"]') as HTMLAnchorElement | null) : null;
        if (!link) return;
        const href = link.href;
        const d = link.dataset;
        const context: Record<string, string> = {};
        if (d.waDestination) context.destination = d.waDestination;
        if (d.waCheckIn) context.checkIn = d.waCheckIn;
        if (d.waCheckOut) context.checkOut = d.waCheckOut;
        if (d.waGuests) context.guests = d.waGuests;

        send({
          event: "WhatsApp Click",
          status: "Lead Intent",
          timestamp: new Date().toISOString(),
          page: window.location.pathname,
          ref: d.waRef || refFromHref(href),
          cta: d.waCta || "",
          whatsappDestination: waDestination(href),
          referrer: cleanReferrer(),
          ...currentUtm(),
          context: context,
        });
      } catch {
        // Ignore: never block the click.
      }
    }

    // Capture phase, passive: runs before navigation and never calls preventDefault.
    document.addEventListener("click", onClick, { capture: true, passive: true });
    document.addEventListener("auxclick", onClick, { capture: true, passive: true });
    return function () {
      document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
      document.removeEventListener("auxclick", onClick, { capture: true } as EventListenerOptions);
    };
  }, []);

  return null;
}

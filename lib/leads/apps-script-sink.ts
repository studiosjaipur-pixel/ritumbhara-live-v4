import { on, type WhatsAppClickEvent } from "@/lib/events/bus";

// Week 5: WHATSAPP_CLICK handler that sends the event to a Google Apps Script web app, which appends a row to
// the leads Google Sheet and emails the team. Server-only: LEAD_SINK_URL and LEAD_SINK_SECRET are never
// exposed to the browser (do not prefix them with NEXT_PUBLIC_).
//
// Apps Script web apps can't read custom request headers, so the secret travels in the JSON body
// (server-to-server, over HTTPS). Apps Script runs doPost, then answers with a 302 redirect to
// script.googleusercontent.com; fetch follows it with a GET (no body is re-sent) to read the JSON reply.

const SINK_TIMEOUT_MS = 8000; // Apps Script cold starts can take a few seconds
const ALLOWED_PREFIX = "https://script.google.com/";

export async function sendToAppsScript(event: WhatsAppClickEvent): Promise<void> {
  const url = process.env.LEAD_SINK_URL;
  const secret = process.env.LEAD_SINK_SECRET;
  if (!url || !secret) {
    console.warn("[lead-sink] LEAD_SINK_URL or LEAD_SINK_SECRET is not set; event not logged.");
    return;
  }
  // Guard against a misconfigured URL sending the secret anywhere other than Google Apps Script.
  if (url.indexOf(ALLOWED_PREFIX) !== 0) {
    console.warn("[lead-sink] LEAD_SINK_URL must start with " + ALLOWED_PREFIX + "; event not logged.");
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, SINK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secret, event: event }),
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let reply: { ok?: boolean; error?: string; duplicate?: boolean } | null = null;
    try { reply = JSON.parse(text); } catch { reply = null; }
    if (!res.ok || !reply || reply.ok !== true) {
      // A 200 HTML page here usually means the web app isn't deployed with "Who has access: Anyone".
      const why = reply && reply.error ? reply.error : res.ok ? "non-JSON reply" : "HTTP " + res.status;
      console.warn("[lead-sink] Apps Script did not accept the event: " + why);
    }
  } catch (err) {
    console.warn("[lead-sink] Could not reach Apps Script:", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
}

// Registered when this module is first imported (by app/api/wa-click/route.ts). on() ignores a repeat
// registration of the same handler.
on("WHATSAPP_CLICK", sendToAppsScript);

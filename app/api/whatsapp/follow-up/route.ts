import { handleFollowUpRequest } from "@/lib/whatsapp-bot/follow-up";

// Week 6 Stretch 2: automatic WhatsApp follow-ups, called by the leads Apps Script.
// OFF (404) unless WHATSAPP_FOLLOW_UP_ENABLED=true. mode "dry_run" never sends. mode "live" sends one approved
// template and is refused (409) unless WHATSAPP_FOLLOW_UP_LIVE_ENABLED=true, the inbound bot is enabled and the
// template is configured. See lib/whatsapp-bot/follow-up.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 20; // Redis calls + one Twilio request (8 s timeout)

export async function POST(req: Request) {
  return handleFollowUpRequest(req);
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

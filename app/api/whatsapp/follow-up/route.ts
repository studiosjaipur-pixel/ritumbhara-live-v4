import { handleFollowUpRequest } from "@/lib/whatsapp-bot/follow-up";

// Week 6 Stretch 2, Phase A: dry-run check for automatic WhatsApp follow-ups, called by the leads Apps Script.
// OFF (404) unless WHATSAPP_FOLLOW_UP_ENABLED=true. Never sends a message. See lib/whatsapp-bot/follow-up.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(req: Request) {
  return handleFollowUpRequest(req);
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

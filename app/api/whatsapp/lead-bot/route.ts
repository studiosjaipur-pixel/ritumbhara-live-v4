import { handleMetaLeadBot } from "@/lib/whatsapp-bot/lead-bot-meta";

// Lead qualification bot for the META WhatsApp number, called by the Hospitality OS (JSON, HMAC-signed with
// LEAD_BOT_OS_SECRET). Runs alongside the unchanged Twilio entry point /api/whatsapp/inbound.
// OFF (404) unless WHATSAPP_BOT_META_ENABLED=true. See lib/whatsapp-bot/lead-bot-meta.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(req: Request) {
  return handleMetaLeadBot(req);
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

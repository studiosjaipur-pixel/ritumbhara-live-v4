import { handleInboundWebhook } from "@/lib/whatsapp-bot/webhook";

// Week 5 stretch: Twilio WhatsApp inbound webhook (Sandbox only for now).
// The bot is OFF unless WHATSAPP_BOT_ENABLED=true; when off this returns an empty TwiML response and does nothing.
// All checks (signature, account, destination, fields) live in lib/whatsapp-bot/webhook.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 15; // Redis calls + optional 4 s AI fallback; Twilio waits up to 15 s

export async function POST(req: Request) {
  return handleInboundWebhook(req);
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

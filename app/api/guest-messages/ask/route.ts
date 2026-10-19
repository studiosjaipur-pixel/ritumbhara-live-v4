import { handleGuestAsk } from "@/lib/guest-messages/assistant";

// Week 7 stretch: guest FAQ replies with escalation to the team. Answers only from configured facts; anything else
// (or a request for a person, a change, a cancellation or a payment) becomes a Guest Escalations row + team email.
// OFF (404) unless GUEST_MESSAGES_ENABLED=true; requires Authorization: Bearer <GUEST_MESSAGES_API_SECRET>.
// See lib/guest-messages/assistant.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 30; // optional Intellistay lookup (15 s timeouts) + one Apps Script call

export async function POST(req: Request) {
  return handleGuestAsk(req);
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

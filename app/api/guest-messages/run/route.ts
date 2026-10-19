import { handleGuestMessagesRun } from "@/lib/guest-messages/run";

// Week 7: Guest Messages run. Reads bookings from the Intellistay TEST server and, in mode "queue", adds due
// pre-arrival / check-in / checkout messages to the team's Guest Messages tab. Never messages a guest.
// OFF (404) unless GUEST_MESSAGES_ENABLED=true; requires Authorization: Bearer <GUEST_MESSAGES_API_SECRET>.
// See lib/guest-messages/run.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Intellistay login + bookings (15 s timeouts) + one Apps Script call per message

export async function POST(req: Request) {
  return handleGuestMessagesRun(req);
}

export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

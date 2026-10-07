// Lightweight server-side event bus (Week 5).
// A route emits an event; every registered handler runs independently via Promise.allSettled, so one failing
// handler never affects another or the route's response. In-process only: no queue, no persistence.

import type { HandoffPayload, QualifiedLeadPayload } from "../leads/qualified-lead";

export type WhatsAppClickEvent = Record<string, unknown>;

export interface EventMap {
  WHATSAPP_CLICK: WhatsAppClickEvent;
  // Week 5 stretch: a WhatsApp guest confirmed their details (handled by lib/leads/qualified-lead-sink.ts).
  LEAD_QUALIFIED: QualifiedLeadPayload;
  // Week 5 stretch: a WhatsApp guest was handed to the team without confirming (never a qualified lead).
  LEAD_HANDOFF: HandoffPayload;
}

export type EventName = keyof EventMap;
type Handler<K extends EventName> = (payload: EventMap[K]) => unknown;

const handlers: { [K in EventName]?: Handler<K>[] } = {};

export function on<K extends EventName>(name: K, handler: Handler<K>): void {
  const list = (handlers[name] || (handlers[name] = [])) as Handler<K>[];
  if (list.indexOf(handler) === -1) list.push(handler);
}

// Returns each handler's settled result (callers that do not need it, such as /api/wa-click, ignore it).
export async function emit<K extends EventName>(name: K, payload: EventMap[K]): Promise<PromiseSettledResult<unknown>[]> {
  const list = (handlers[name] || []) as Handler<K>[];
  const results = await Promise.allSettled(
    list.map(function (handler) {
      return Promise.resolve().then(function () { return handler(payload); });
    })
  );
  results.forEach(function (r) {
    if (r.status === "rejected") {
      console.warn("[events] " + name + " handler failed:", r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });
  return results;
}

import { getIntellistayConfig, type IntellistayConfigResult, type IntellistayConfig } from "../intellistay/config";
import { createIntellistayClient, IntellistayError, type IntellistayClient } from "../intellistay/client";
import type { NormalizedBooking } from "../intellistay/types";
import { getGuestMessagesApiConfig, json, readAuthorizedJson, type ApiConfigResult } from "./http";
import { buildQueueItem, postGuestEnvelope, type GuestEnvelope, type SinkResult } from "./queue";
import { istToday, planMessages } from "./triggers";
import type { PlannedMessage } from "./types";

// Week 7: POST /api/guest-messages/run. SERVER-ONLY.
//
// Reads bookings from the Intellistay TEST server, works out which guest messages are due (triggers.ts) and, in
// mode "queue", adds them to the team's Guest Messages tab (queue.ts). It never sends anything to a guest.
//   mode "dry_run": plans only and returns IDs, types, dates and statuses. Nothing is stored. An optional "today"
//                   (YYYY-MM-DD) lets the team preview another day, e.g. a future test booking's check-in date.
//   mode "queue":   stores the plan for today (India time). "today" is not accepted.
// Normally called once a day by the Apps Script trigger runGuestMessages (apps-script/Code.gs).
// Responses and logs contain IDs, dates, counts and reason codes only: no guest names, phones or message text.

if (typeof window !== "undefined") {
  throw new Error("lib/guest-messages/run is server-only and must not be imported in browser code.");
}

export const RUN_DELIVERY_BUDGET_MS = 40000; // leaves headroom inside the route's maxDuration (60 s)
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type RunLogFn = (event: string, meta?: Record<string, string | number | boolean>) => void;

export interface RunDeps {
  getApiConfig: () => ApiConfigResult;
  getIntellistayConfig: () => IntellistayConfigResult;
  createClient: (config: IntellistayConfig) => IntellistayClient;
  deliver: (envelope: GuestEnvelope) => Promise<SinkResult>;
  sinkConfigured: () => boolean;
  now: () => Date;
  nowMs: () => number;
  log: RunLogFn;
}

const defaultLog: RunLogFn = function (event, meta) {
  console.warn("[guest-messages] " + event + (meta ? " " + JSON.stringify(meta) : ""));
};

const defaultDeps: RunDeps = {
  getApiConfig: function () { return getGuestMessagesApiConfig(); },
  getIntellistayConfig: function () { return getIntellistayConfig(); },
  createClient: function (config) { return createIntellistayClient({ config: config }); },
  deliver: function (envelope) { return postGuestEnvelope(envelope); },
  sinkConfigured: function () {
    const url = process.env.GUEST_MESSAGES_SINK_URL || "";
    return !!process.env.GUEST_MESSAGES_SINK_SECRET && url.indexOf("https://script.google.com/") === 0;
  },
  now: function () { return new Date(); },
  nowMs: function () { return Date.now(); },
  log: defaultLog,
};

function isRealDay(s: string): boolean {
  if (!ISO_DAY.test(s)) return false;
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  return d.toISOString().slice(0, 10) === s;
}

function countBy(items: Array<Record<string, unknown>>, key: string): Record<string, number> {
  const out: Record<string, number> = {};
  items.forEach(function (i) { const k = String(i[key]); out[k] = (out[k] || 0) + 1; });
  return out;
}

function publicPlan(p: PlannedMessage) {
  return { messageId: p.messageId, type: p.type, status: p.status, reason: p.reason, scheduledDate: p.scheduledDate, sendBy: p.sendBy, bookingId: p.bookingId };
}

export function createGuestMessagesRunHandler(overrides?: Partial<RunDeps>) {
  const deps: RunDeps = Object.assign({}, defaultDeps, overrides || {});

  return async function handleRunRequest(req: Request): Promise<Response> {
    const auth = await readAuthorizedJson(req, deps.getApiConfig, deps.log);
    if (!auth.ok) return auth.response;
    const body = auth.body;

    const mode = typeof body.mode === "string" ? body.mode : "";
    if (mode !== "dry_run" && mode !== "queue") return json(400, { ok: false, error: "bad_request", field: "mode" });
    let today = istToday(deps.now());
    if (body.today !== undefined) {
      if (mode !== "dry_run" || typeof body.today !== "string" || !isRealDay(body.today)) return json(400, { ok: false, error: "bad_request", field: "today" });
      today = body.today;
    }
    if (mode === "queue" && !deps.sinkConfigured()) {
      deps.log("sink_not_configured");
      return json(503, { ok: false, error: "misconfigured", detail: "GUEST_MESSAGES_SINK_URL / GUEST_MESSAGES_SINK_SECRET" });
    }

    const isConfig = deps.getIntellistayConfig();
    if (isConfig.status !== "ready") {
      deps.log("intellistay_config_invalid", { problems: isConfig.problems.join("; ") });
      return json(503, { ok: false, error: "intellistay_misconfigured" });
    }

    let bookings: NormalizedBooking[];
    let rejected = 0;
    let truncated = false;
    try {
      const r = await deps.createClient(isConfig.config).fetchNormalizedBookings();
      bookings = r.bookings;
      rejected = r.rejected.length;
      truncated = r.truncated;
    } catch (err) {
      const reason = err instanceof IntellistayError ? err.reason : "unexpected";
      deps.log("intellistay_failed", { reason: reason });
      return json(502, { ok: false, error: "intellistay_unavailable", reason: reason });
    }

    const plan = planMessages(bookings, { today: today });
    const byId: Record<string, NormalizedBooking> = {};
    bookings.forEach(function (b) { byId[b.bookingId] = b; });
    const summary = { bookings: bookings.length, rejectedBookings: rejected, truncated: truncated, planned: plan.length, byStatus: countBy(plan as unknown as Array<Record<string, unknown>>, "status") };

    if (mode === "dry_run") {
      deps.log("run_dry", { today: today, bookings: bookings.length, planned: plan.length });
      return json(200, Object.assign({ ok: true, mode: mode, today: today, items: plan.map(publicPlan) }, summary));
    }

    // Queue: one item at a time within a time budget. Items not attempted or failed are retried by the next run.
    const started = deps.nowMs();
    const results: Array<Record<string, unknown>> = [];
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      if (deps.nowMs() - started > RUN_DELIVERY_BUDGET_MS) {
        results.push({ messageId: p.messageId, type: p.type, status: p.status, delivery: "not_attempted" });
        continue;
      }
      let r: SinkResult;
      try {
        r = await deps.deliver({ type: "guest_message", message: buildQueueItem(p, byId[p.bookingId], deps.now()) });
      } catch {
        r = { ok: false, reason: "network" };
      }
      results.push(r.ok
        ? { messageId: p.messageId, type: p.type, status: p.status, delivery: r.status }
        : { messageId: p.messageId, type: p.type, status: p.status, delivery: "failed", reason: r.reason });
    }
    const deliveries = countBy(results, "delivery");
    deps.log("run_queued", Object.assign({ today: today, bookings: bookings.length, planned: plan.length }, deliveries));
    const allOk = !deliveries.failed && !deliveries.not_attempted;
    return json(200, Object.assign({ ok: true, mode: mode, today: today, complete: allOk, deliveries: deliveries, items: results }, summary));
  };
}

export const handleGuestMessagesRun = createGuestMessagesRunHandler();

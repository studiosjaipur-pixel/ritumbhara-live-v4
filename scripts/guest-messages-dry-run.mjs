// Week 7: read-only check of the Guest Messages pipeline against the Intellistay TEST server, from your computer.
// Uses the project's own code (lib/intellistay + lib/guest-messages). It logs in, reads bookings, normalizes them
// and plans the messages for a day. It stores nothing, sends nothing, and never calls production (the config
// refuses any host other than the test server).
//
// Prints only: booking count, rejected-field names, booking IDs, statuses, dates, planned message types/statuses,
// and whether each message could be built. Never prints names, phones, emails, message text, tokens or credentials.
//
// Usage (env vars: INTELLISTAY_ENV, INTELLISTAY_BASE_URL, INTELLISTAY_USERNAME, INTELLISTAY_PASSWORD, INTELLISTAY_BRANCH_ID):
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/helpers/register-ts.mjs scripts/guest-messages-dry-run.mjs [YYYY-MM-DD]
// The optional date previews another day (e.g. a future test booking's check-in date). Default: today in India.

const { getIntellistayConfig, describeIntellistayConfig } = await import("../lib/intellistay/config.ts");
const { createIntellistayClient } = await import("../lib/intellistay/client.ts");
const { planMessages, istToday, messageWindow, addDays } = await import("../lib/guest-messages/triggers.ts");
const { buildQueueItem } = await import("../lib/guest-messages/queue.ts");

const arg = process.argv[2];
if (arg !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  console.error("STOPPED: the optional argument must be a date like 2026-10-20");
  process.exit(1);
}

const cfg = getIntellistayConfig();
if (cfg.status !== "ready") {
  console.error("STOPPED: Intellistay settings are not ready:");
  cfg.problems.forEach((p) => console.error("  - " + p));
  console.error("Settings seen (values hidden): " + JSON.stringify(describeIntellistayConfig()));
  process.exit(1);
}

const client = createIntellistayClient({ config: cfg.config, log: () => {} });
let read;
try {
  read = await client.fetchNormalizedBookings();
} catch (err) {
  console.error("STOPPED: Intellistay request failed: " + (err && err.reason ? err.reason : "error"));
  process.exit(1);
}

const today = arg || istToday(new Date());
console.log("Target: " + cfg.config.baseUrl + " (test server), branch " + cfg.config.branchId);
console.log("Bookings read: " + read.bookings.length + " (pages: " + read.pagesRead + ", truncated: " + read.truncated + ")");
if (read.rejected.length) console.log("Rejected (field names only): " + read.rejected.map((r) => (r.bookingId || "?") + ":" + r.problem).join(", "));

console.log("\nBookings (no guest data):");
read.bookings.forEach((b) => {
  console.log("  #" + b.bookingId + "  status " + b.statusId + " " + JSON.stringify(b.statusName) + "  " + b.checkInDate + " -> " + b.checkOutDate +
    "  (" + b.nights + (b.nights === 1 ? " night)" : " nights)") + "  rooms " + b.rooms.length + "  guest phone usable: " + (b.guest.phone ? "yes" : "no") +
    "  first name usable: " + (b.guest.firstName ? "yes" : "no"));
});

const plan = planMessages(read.bookings, { today });
console.log("\nPlan for " + today + ": " + plan.length + " message(s)");
const byId = Object.fromEntries(read.bookings.map((b) => [b.bookingId, b]));
plan.forEach((p) => {
  const item = buildQueueItem(p, byId[p.bookingId], new Date());
  console.log("  " + p.messageId + "  " + p.type + "  " + p.status + (p.reason ? " (" + p.reason + ")" : "") + "  booking #" + p.bookingId +
    "  scheduled " + p.scheduledDate + "  message built: " + (item.message ? item.message.length + " chars" : "no"));
});
if (!plan.length) console.log("  (nothing due on this date)");

// ---------- Per-booking preview: every Week 7 message for each current/future booking ----------
// For each booking that has not ended, plans the days its messages are scheduled (and the day before, when QUEUED
// items are created), so all three messages show up in one run, whatever today is.
const realToday = istToday(new Date());
const upcoming = read.bookings.filter((b) => b.checkOutDate >= realToday);
console.log("\nCurrent / future bookings: " + upcoming.length);
upcoming.forEach((b) => {
  const days = new Set();
  ["PRE_ARRIVAL", "CHECK_IN", "CHECKOUT"].forEach((type) => {
    const w = messageWindow(b, type);
    if (w) { days.add(addDays(w.scheduled, -1)); days.add(w.scheduled); }
  });
  console.log("\n  Booking #" + b.bookingId + "  status " + b.statusId + " " + JSON.stringify(b.statusName) + "  " + b.checkInDate + " -> " + b.checkOutDate);
  Array.from(days).sort().forEach((day) => {
    const items = planMessages([b], { today: day });
    console.log("    on " + day + ": " + (items.length ? items.map((p) => p.type + " " + p.status + (p.reason ? " (" + p.reason + ")" : "") + " " + p.messageId).join(", ") : "nothing"));
  });
});

// ---------- Duplicate protection (in memory only: nothing is stored anywhere) ----------
// Runs the queue step twice for each preview day against an in-memory queue that, like the Sheet, keeps each
// Message ID once. The second run must add nothing.
const memoryQueue = new Map();
let firstAdded = 0, secondAdded = 0, idsDiffer = 0;
const previewDays = new Set([today]);
upcoming.forEach((b) => ["PRE_ARRIVAL", "CHECK_IN", "CHECKOUT"].forEach((type) => { const w = messageWindow(b, type); if (w) previewDays.add(w.scheduled); }));
Array.from(previewDays).sort().forEach((day) => {
  const run1 = planMessages(read.bookings, { today: day });
  const run2 = planMessages(read.bookings, { today: day });
  if (JSON.stringify(run1.map((p) => p.messageId)) !== JSON.stringify(run2.map((p) => p.messageId))) idsDiffer++;
  run1.forEach((p) => { if (!memoryQueue.has(p.messageId)) { memoryQueue.set(p.messageId, p.status); firstAdded++; } });
  run2.forEach((p) => { if (!memoryQueue.has(p.messageId)) { memoryQueue.set(p.messageId, p.status); secondAdded++; } });
});
console.log("\nDuplicate protection (in-memory queue, " + previewDays.size + " day(s) checked):");
console.log("  first run added " + firstAdded + ", second run added " + secondAdded + ", runs with different IDs: " + idsDiffer);
console.log("  result: " + (secondAdded === 0 && idsDiffer === 0 ? "OK (no duplicate queue entries)" : "PROBLEM"));
console.log("\nDone. Nothing was stored or sent.");

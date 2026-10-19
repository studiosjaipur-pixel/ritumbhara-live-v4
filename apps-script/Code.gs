/**
 * Ritumbhara website: WhatsApp click ("Lead Intent") logger.
 * Receives events from the website's /api/wa-click route (server-to-server), appends a row to this
 * spreadsheet and emails the team.
 * A click is NOT a confirmed lead: the website never knows the visitor's name or WhatsApp number.
 *
 * Script Properties (Project Settings -> Script Properties):
 *   LEAD_SINK_SECRET  - same value as the LEAD_SINK_SECRET environment variable in Vercel
 *   TEAM_EMAILS       - comma-separated recipients
 *   EMAIL_HOURLY_CAP  - optional, default 20 (rows are always logged; only emails are capped)
 *
 * Week 5 stretch (WhatsApp bot): the same web app also receives, from the website server,
 *   type "qualified_lead" -> "Qualified Leads" tab + "New Qualified WhatsApp Lead" email
 *   type "lead_handoff"   -> "Handoffs" tab + "WhatsApp guest needs a team member" email (NOT qualified)
 * authenticated with a separate secret:
 *   QUALIFIED_LEAD_SINK_SECRET - same value as QUALIFIED_LEAD_SINK_SECRET in Vercel
 *   LEADS_SHEET_ID             - ID of the leads Google Sheet (the part of its URL between /d/ and /edit).
 *                                This is a standalone script, so click logging and bot leads both open
 *                                the Sheet by this ID (never getActiveSpreadsheet).
 * Both are idempotent: the same Lead ID / Handoff ID never creates a second row or a second email.
 * Click flow: a repeat of the same button on the same page within 15 seconds is logged once (cache fast path,
 * plus a check of the Sheet's recent rows because the cache is best-effort).
 *
 * Week 6, Step 1 (lead status tracking) on "Qualified Leads" and "Handoffs": Status dropdown (New, Contacted,
 * Booked, Lost), "Status Updated (IST)" and "Next Follow-up" columns, kept up to date by the onLeadStatusEdit
 * trigger. Run setupLeadStatusTracking() once after deploying. Bot-lead values are written by header name, and
 * Email Status goes to its own column (it is no longer the last one).
 *
 * Week 6, Step 2 (simple lead scoring) on the same two tabs: "Score" (0-100) and "Priority" (Hot/Warm/Cold),
 * calculated by scoreLead_ when a lead is written. recalculateLeadScores() re-scores open leads on demand.
 *
 * Week 6, Step 3 (follow-up reminders): sendFollowUpDigest, run daily by the trigger that setupFollowUpReminders
 * installs, emails one digest of due/overdue leads (Hot first) to TEAM_EMAILS. Reminder only: it changes nothing
 * in the Sheet and never contacts a guest. All emails share one recipient/quota check (teamMailCheck_).
 *
 * Week 6, Stretch 1 (conversion report): generateConversionReport(), run by hand, rebuilds a separate
 * "Conversion Report" tab (by Source and by Ref) from the current data. Read-only on the lead and click tabs.
 *
 * Week 6, Stretch 2 (automatic WhatsApp follow-ups): sendWhatsAppFollowUps picks eligible Contacted leads on
 * "Qualified Leads" and calls the website's /api/whatsapp/follow-up endpoint (opt-out + one-claim-per-lead checks in
 * Redis). OFF by default. WA_FOLLOW_UP_MODE "dry_run" never sends. "live" sends one approved WhatsApp template per
 * lead and also needs WA_FOLLOW_UP_LIVE_ENABLED=true here plus the website's own live configuration.
 * Run setupWhatsAppFollowUps() once to add the columns and the daily trigger.
 *
 * Week 7 (guest messages): type "guest_message" -> "Guest Messages" tab (team queue: the team sends, nothing is sent
 * to guests from here) and type "guest_escalation" -> "Guest Escalations" tab + team email, authenticated with
 * GUEST_MESSAGES_SINK_SECRET. runGuestMessages (daily) calls the website's /api/guest-messages/run and emails a digest
 * of due messages. OFF unless GUEST_MESSAGES_MODE is set. Run setupGuestMessages() once. See the Week 7 section below.
 */
var SHEET_NAME = "WhatsApp Clicks";
var HEADERS = ["Received (IST)", "Status", "Ref", "CTA", "Page", "Destination", "Check-in", "Check-out", "Guests",
  "UTM source", "UTM medium", "UTM campaign", "UTM term", "UTM content", "Referrer", "Site", "Received at (UTC)", "Email"];
var DEDUPE_SECONDS = 15;

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "");
  } catch (err) {
    return json_({ ok: false, error: "bad_json" });
  }

  // WhatsApp bot leads have their own handler and secret; everything else is the unchanged click flow.
  if (body && typeof body === "object" && (body.type === "qualified_lead" || body.type === "lead_handoff")) {
    return handleBotLead_(body, props);
  }
  // Week 7: guest message queue items and guest escalations (own handler and secret).
  if (body && typeof body === "object" && (body.type === "guest_message" || body.type === "guest_escalation")) {
    return handleGuestRequest_(body, props);
  }

  var expected = props.getProperty("LEAD_SINK_SECRET");
  if (!expected || !body || typeof body !== "object" || body.secret !== expected) {
    return json_({ ok: false, error: "unauthorized" });
  }

  var ev = body.event || {};
  if (ev.event !== "WhatsApp Click" || !/^W-[A-Za-z0-9-]{1,80}$/.test(String(ev.ref || ""))) {
    return json_({ ok: false, error: "bad_event" });
  }
  var ctx = ev.context || {};

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: "busy" });
  var sheet, rowIndex, decision;
  try {
    var cache = CacheService.getScriptCache();
    // The same button on the same page within 15 seconds (e.g. a double-click) is logged once.
    var dedupeKey = "d:" + Utilities.base64Encode(Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5, [ev.site, ev.ref, ev.page].join("|")));
    // Fast path: the cache usually remembers a click from the last 15 seconds.
    if (cache.get(dedupeKey)) return json_({ ok: true, duplicate: true });
    // Reliable path: CacheService is best-effort (entries can be missing), so also check the Sheet's most
    // recent rows. This runs under the script lock, so a click logged just before is always visible.
    sheet = getSheet_();
    if (recentClickRow_(sheet, ev)) return json_({ ok: true, duplicate: true });
    cache.put(dedupeKey, "1", DEDUPE_SECONDS);

    decision = emailDecision_(props, cache);
    sheet.appendRow([
      Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss"),
      ev.status, ev.ref, ev.cta, ev.page,
      ctx.destination, ctx.checkIn, ctx.checkOut, ctx.guests,
      ev.utm_source, ev.utm_medium, ev.utm_campaign, ev.utm_term, ev.utm_content,
      ev.referrer, ev.site, ev.receivedAt,
      decision.send ? "sending" : decision.reason
    ].map(cell_));
    rowIndex = sheet.getLastRow();
    // Commit the row before releasing the lock, so the next request's duplicate check can see it.
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Email is sent after the lock is released, so a slow send never blocks other clicks being logged.
  if (decision.send) {
    var status = sendEmail_(ev, ctx, decision.to, sheet.getParent().getUrl());
    sheet.getRange(rowIndex, HEADERS.length).setValue(status);
  }
  return json_({ ok: true });
}

function doGet(e) {
  // Temporary bot-lead diagnostics: /exec?diag=<DIAG_KEY>. Off unless the DIAG_KEY Script Property is set.
  var key = PropertiesService.getScriptProperties().getProperty("DIAG_KEY");
  if (key && key.length >= 16 && e && e.parameter && e.parameter.diag === key) return json_(botLeadDiagnostics_());
  return json_({ ok: false, error: "method_not_allowed" });
}

// The one recipient + quota check shared by every email this script sends (click emails, bot-lead emails and
// the follow-up digest): TEAM_EMAILS must be set, and today's Mail quota must cover one email to all of them.
function teamMailCheck_(props) {
  var to = (props.getProperty("TEAM_EMAILS") || "").split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
  if (!to.length) return { send: false, reason: "skipped: TEAM_EMAILS not set" };
  if (MailApp.getRemainingDailyQuota() < to.length) return { send: false, reason: "skipped: daily email quota" };
  return { send: true, to: to };
}

// Click emails: the shared check, plus the hourly cap (EMAIL_HOURLY_CAP) that applies to click emails only.
function emailDecision_(props, cache) {
  var check = teamMailCheck_(props);
  if (!check.send) return check;
  var to = check.to;
  var cap = parseInt(props.getProperty("EMAIL_HOURLY_CAP") || "20", 10);
  var hourKey = "h:" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH");
  var sent = parseInt(cache.get(hourKey) || "0", 10);
  if (sent >= cap) return { send: false, reason: "skipped: hourly cap" };
  cache.put(hourKey, String(sent + 1), 3600);
  return { send: true, to: to };
}

function sendEmail_(ev, ctx, to, sheetUrl) {
  var stay = [];
  if (ctx.destination) stay.push("Destination: " + ctx.destination);
  if (ctx.checkIn) stay.push("Check-in: " + ctx.checkIn);
  if (ctx.checkOut) stay.push("Check-out: " + ctx.checkOut);
  if (ctx.guests) stay.push("Guests: " + ctx.guests);
  var utm = [ev.utm_source, ev.utm_medium, ev.utm_campaign].filter(function (s) { return s; }).join(" / ");

  var lines = [
    "A visitor clicked a WhatsApp button on the website.",
    "",
    "This is lead intent, not a confirmed lead: the website does not know the visitor's name or WhatsApp number.",
    "If they send the message, it will arrive on WhatsApp (+91 83063 12778) ending with \"Ref: " + ev.ref + "\".",
    "",
    "Ref: " + ev.ref,
    "Button: " + (ev.cta || "(other link)"),
    "Page: https://" + ev.site + ev.page,
    "Stay details entered: " + (stay.length ? stay.join(", ") : "none")
  ];
  if (utm) lines.push("Campaign: " + utm);
  if (ev.referrer) lines.push("Came from: " + ev.referrer);
  lines.push("", "Sheet: " + sheetUrl);

  try {
    MailApp.sendEmail({ to: to.join(","), subject: "WhatsApp click (lead intent) - " + ev.ref, body: lines.join("\n") });
    return "sent";
  } catch (err) {
    return "failed: " + String(err).slice(0, 100);
  }
}

// ---------- Click de-duplication against the Sheet (reliable fallback for the cache) ----------

var DEDUPE_SCAN_ROWS = 20;

// True if one of the last 20 "WhatsApp Clicks" rows has the same Site + Ref + Page and was received within
// DEDUPE_SECONDS of this click. Time = "Received at (UTC)" (when the website received the click), so a delayed
// request is still matched to the click it duplicates. If either time is unusable, falls back to Apps Script's
// own time ("Received (IST)" vs now).
function recentClickRow_(sheet, ev) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var n = Math.min(DEDUPE_SCAN_ROWS, last - 1);
  var rows = sheet.getRange(last - n + 1, 1, n, HEADERS.length).getValues();
  var ref = sheetText_(ev.ref), page = sheetText_(ev.page), site = sheetText_(ev.site);
  var clickMs = isoMs_(ev.receivedAt);
  var nowMs = new Date().getTime();
  var tz = null;
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (sheetText_(r[2]) !== ref || sheetText_(r[4]) !== page || sheetText_(r[15]) !== site) continue;
    var rowClickMs = isoMs_(r[16]);
    if (!isNaN(clickMs) && !isNaN(rowClickMs)) {
      if (Math.abs(clickMs - rowClickMs) < DEDUPE_SECONDS * 1000) return true;
      continue;
    }
    if (tz === null) tz = sheet.getParent().getSpreadsheetTimeZone();
    var rowIstMs = istCellMs_(r[0], tz);
    if (!isNaN(rowIstMs) && Math.abs(nowMs - rowIstMs) < DEDUPE_SECONDS * 1000) return true;
  }
  return false;
}

// A value as it reads back from the Sheet: text, without the apostrophe cell_() adds against formulas.
function sheetText_(v) {
  var s = cell_(v);
  s = typeof s === "string" ? s : String(s);
  return s.charAt(0) === "'" ? s.slice(1) : s;
}

// Milliseconds from an ISO timestamp string like "2026-10-08T08:30:01.123Z" (anything else: NaN).
// A cell the Sheet turned into a Date is treated as unusable (its time zone is ambiguous) -> IST fallback.
function isoMs_(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v)) return NaN;
  return Date.parse(v);
}

// Milliseconds from the "Received (IST)" cell: our "yyyy-MM-dd HH:mm:ss" IST text, or the Date the Sheet
// converted it into (re-read as wall-clock time in the spreadsheet's time zone, then interpreted as IST).
function istCellMs_(v, tz) {
  var s = Object.prototype.toString.call(v) === "[object Date]" ? Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm:ss") : String(v);
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - 330 * 60000; // IST = UTC+05:30
}

function getSheet_() {
  // Standalone script: open the leads Sheet by the LEADS_SHEET_ID Script Property (same as bot leads).
  var ss = openLeadsSpreadsheet_(PropertiesService.getScriptProperties());
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Prevents spreadsheet formula injection: visitor-controlled text (e.g. UTM values) is never run as a formula.
function cell_(v) {
  if (typeof v === "number" && isFinite(v)) return v; // numbers (nights, guests) stay numbers
  if (Array.isArray(v)) v = v.join(" "); // a Sheet cell cannot hold an array
  else if (v !== null && typeof v === "object") v = JSON.stringify(v);
  var s = v === undefined || v === null ? "" : String(v).slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor: grants Sheets + Mail permissions, creates the tab and sends a test email. */
function setupTest() {
  getSheet_();
  var to = PropertiesService.getScriptProperties().getProperty("TEAM_EMAILS");
  if (!to) throw new Error("Set TEAM_EMAILS in Script Properties first.");
  MailApp.sendEmail(to, "Ritumbhara lead logger - setup test",
    "Setup works. Remaining daily email quota: " + MailApp.getRemainingDailyQuota());
}


// ===================== Week 5 stretch: WhatsApp bot leads =====================

var QUALIFIED_SHEET = "Qualified Leads";
var QUALIFIED_HEADERS = ["Received (IST)", "Lead ID", "Status", "Phone", "Destination", "Property", "Check-in", "Check-out",
  "Nights", "Guests", "Requirements", "Ref", "Source", "Conversation State", "Qualification Status", "Site",
  "Received (UTC)", "Handoff Number", "Notes", "Email Status", "Status Updated (IST)", "Next Follow-up", "Score", "Priority"];
var HANDOFF_SHEET = "Handoffs";
var HANDOFF_HEADERS = ["Received (IST)", "Handoff ID", "Status", "Reason", "Phone", "Destination", "Property", "Check-in",
  "Check-out", "Nights", "Guests", "Requirements", "Ref", "Source", "Conversation State", "Qualification Status", "Site",
  "Received (UTC)", "Handoff Number", "Email Status", "Status Updated (IST)", "Next Follow-up", "Score", "Priority",
  "Guest Name", "Booking Code"];
// "Guest Name" and "Booking Code" (Guest Escalation leads, see upsertEscalationLead_) are appended like every earlier
// column: existing columns are never moved. Everything is placed by header NAME, so the team may drag "Guest Name"
// next to "Phone" in the Sheet; the script and the Hospitality OS keep working.

var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
var REF_RE = /^(DIRECT|W-[A-Za-z0-9-]{1,80})$/;
var PHONE_RE = /^\+[1-9]\d{7,14}$/;

function str_(v, max) {
  return typeof v === "string" && v.length <= max ? v : null;
}

function nightsBetween_(a, b) {
  var d1 = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  var d2 = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((d2 - d1) / 86400000);
}

// Basic re-validation (the website already validated everything; this is defense in depth).
// Each returns the NAME of the first invalid field (never its value), or "" when everything is valid.
function qualifiedLeadProblem_(l) {
  if (!l || typeof l !== "object") return "lead";
  if (!/^L-[0-9A-F]{10}$/.test(String(l.leadId))) return "leadId";
  if (!PHONE_RE.test(String(l.phone))) return "phone";
  if (!str_(l.destination, 60)) return "destination";
  if (l.property !== null && !str_(l.property, 60)) return "property";
  if (!ISO_DATE.test(String(l.checkIn)) || !ISO_DATE.test(String(l.checkOut))) return "dates";
  var nights = nightsBetween_(l.checkIn, l.checkOut);
  if (nights < 1 || nights > 90 || l.nights !== nights) return "nights";
  if (typeof l.guests !== "number" || l.guests % 1 !== 0 || l.guests < 1 || l.guests > 20) return "guests";
  if (typeof l.requirements !== "string" || l.requirements.length > 300) return "requirements";
  if (!REF_RE.test(String(l.ref))) return "ref";
  if (l.qualificationStatus !== "QUALIFIED") return "qualificationStatus";
  if (l.conversationState !== "HANDED_OFF") return "conversationState";
  return "";
}

function handoffProblem_(h) {
  if (!h || typeof h !== "object") return "handoff";
  if (!/^H-[0-9A-F]{10}$/.test(String(h.handoffId))) return "handoffId";
  if (!PHONE_RE.test(String(h.phone))) return "phone";
  if (h.reason !== "HUMAN_REQUESTED" && h.reason !== "NEEDS_FOLLOW_UP") return "reason";
  if (h.qualificationStatus !== "NOT_QUALIFIED") return "qualificationStatus";
  if (!REF_RE.test(String(h.ref))) return "ref";
  if (h.requirements !== null && !str_(h.requirements, 300)) return "requirements";
  return "";
}

function validQualifiedLead_(l) { return qualifiedLeadProblem_(l) ? null : l; }
function validHandoff_(h) { return handoffProblem_(h) ? null : h; }

var BOT_CODE_VERSION = "bot-v6.6-follow-up-live";

// Wrapper: an unexpected exception returns JSON (never Google's HTML error page) with a SAFE diagnostic:
// the step that failed, the error type, a scrubbed message and the Code.gs line. No secrets, phone numbers,
// emails, guest text or spreadsheet IDs are ever included. The last outcome is also kept for /exec?diag=.
function handleBotLead_(body, props, opts) {
  var trace = { stage: "start" };
  var result;
  try {
    result = handleBotLeadInner_(body, props, trace, opts || {});
  } catch (err) {
    console.error("handleBotLead_ failed at " + trace.stage + ": " + (err && err.stack ? err.stack : err));
    result = {
      ok: false, error: "server_error", code: (err && err.diagCode) || "EXCEPTION", stage: trace.stage,
      errName: safeErrName_(err), errMsg: safeErrMsg_(err, props), where: errWhere_(err), v: BOT_CODE_VERSION
    };
  }
  if (!(opts && opts.dryRun)) rememberBotResult_(body, result, props);
  return json_(result);
}

// Notes arrive as an array of strings; a Sheet cell needs one plain string.
function notesText_(notes) {
  return Array.isArray(notes) ? notes.join(" ") : (notes ? String(notes) : "");
}

function handleBotLeadInner_(body, props, trace, opts) {
  // Authentication and validation failures say which CHECK failed (never the submitted value).
  trace.stage = "auth";
  var expected = props.getProperty("QUALIFIED_LEAD_SINK_SECRET");
  if (!expected) return { ok: false, error: "rejected", code: "NO_SECRET_PROPERTY", v: BOT_CODE_VERSION };
  if (body.secret !== expected) return { ok: false, error: "rejected", code: "AUTH", v: BOT_CODE_VERSION };

  trace.stage = "validate";
  var qualified = body.type === "qualified_lead";
  var item = qualified ? body.lead : body.handoff;
  var problem = qualified ? qualifiedLeadProblem_(item) : handoffProblem_(item);
  if (problem) return { ok: false, error: "rejected", code: "INVALID", field: problem, v: BOT_CODE_VERSION };
  var id = qualified ? item.leadId : item.handoffId;
  var tabName = qualified ? QUALIFIED_SHEET : HANDOFF_SHEET;
  var headers = qualified ? QUALIFIED_HEADERS : HANDOFF_HEADERS;

  // Check the Sheet setting before taking the lock, so a missing ID is reported immediately.
  trace.stage = "config";
  leadsSheetId_(props);

  trace.stage = "lock";
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: "busy", code: "BUSY", v: BOT_CODE_VERSION };
  var sheet, rowIndex, cols;
  try {
    var ss = openLeadsSpreadsheet_(props, trace);
    trace.stage = "open_tab";
    sheet = ss.getSheetByName(tabName);
    if (!sheet) { trace.stage = "create_tab"; sheet = ss.insertSheet(tabName); }
    // Writes the header row on a new tab and adds any missing column (e.g. the Week 6 status columns) to an
    // existing one. Every value below is placed by header NAME, so team-added columns are never overwritten.
    trace.stage = "write_headers";
    cols = ensureLeadHeaders_(sheet, headers);
    trace.stage = "find_id";
    if (findRowById_(sheet, id) > 0) return { ok: true, duplicate: true }; // retry: no new row, no new email
    trace.stage = "build_row";
    var now = new Date();
    var istNow = istText_(now);
    var scored = scoreLead_({
      qualified: qualified, reason: qualified ? null : item.reason, checkIn: item.checkIn, checkOut: item.checkOut,
      nights: item.nights, property: item.property, ref: item.ref
    }, istDateText_(now));
    var values = qualified
      ? [istNow, id, DEFAULT_LEAD_STATUS, item.phone, item.destination, item.property, item.checkIn, item.checkOut, item.nights,
         item.guests, item.requirements, item.ref, item.source, item.conversationState, item.qualificationStatus, item.site,
         item.receivedAt, item.handoffNumber, notesText_(item.notes), "PENDING", istNow, nextFollowUpFor_(DEFAULT_LEAD_STATUS, now),
         scored.score, scored.priority]
      : [istNow, id, DEFAULT_LEAD_STATUS, item.reason, item.phone, item.destination, item.property, item.checkIn, item.checkOut,
         item.nights, item.guests, item.requirements, item.ref, item.source, item.conversationState, item.qualificationStatus,
         item.site, item.receivedAt, item.handoffNumber, "PENDING", istNow, nextFollowUpFor_(DEFAULT_LEAD_STATUS, now),
         scored.score, scored.priority];
    var byName = {};
    headers.forEach(function (h, i) { byName[h] = values[i]; });
    var row = cols.names.map(function (name) {
      return cell_(Object.prototype.hasOwnProperty.call(byName, name) ? byName[name] : "");
    });
    trace.stage = "append_row";
    sheet.appendRow(row);
    trace.stage = "read_row_index";
    rowIndex = sheet.getLastRow();
    if (opts.dryRun) {
      trace.stage = "dry_run_cleanup";
      sheet.deleteRow(rowIndex);
    } else {
      trace.stage = "status_dropdown";
      applyStatusValidation_(sheet.getRange(rowIndex, cols.index[STATUS_HEADER]));
    }
  } finally {
    lock.releaseLock();
  }
  if (opts.dryRun) return { ok: true, dryRun: true, wouldStore: true, v: BOT_CODE_VERSION };

  // The row is stored. Email failure does not undo it, and a retry finds the row and sends nothing again.
  trace.stage = "email";
  var emailStatus = sendBotLeadEmail_(item, qualified, props, sheet.getParent().getUrl()) ? "SENT" : "FAILED";
  trace.stage = "email_status";
  // Explicit column (found by header name), not "the last column": columns after Email Status exist now.
  sheet.getRange(rowIndex, cols.index[EMAIL_STATUS_HEADER]).setValue(emailStatus);
  return { ok: true, stored: true, emailStatus: emailStatus };
}

// ===================== Week 6, Step 1: lead status tracking =====================
//
// Applies to the "Qualified Leads" and "Handoffs" tabs only ("WhatsApp Clicks" is lead intent, not a lead).
//   Status               - dropdown: New, Contacted, Booked, Lost. New rows start as New.
//   Status Updated (IST) - set when a row is created and whenever the team changes Status.
//   Next Follow-up (IST) - set from the status: New = 1 day later, Contacted = 2 days later, Booked/Lost = empty.
// The team changes Status by hand; onLeadStatusEdit (an installable "on edit" trigger, created by
// setupLeadStatusTracking) updates the two date columns. Edits made by this script do not fire the trigger.

var LEAD_STATUSES = ["New", "Contacted", "Booked", "Lost"];
var DEFAULT_LEAD_STATUS = "New";
var FOLLOW_UP_DAYS = { "New": 1, "Contacted": 2 }; // Booked and Lost: no follow-up
var STATUS_HEADER = "Status";
var EMAIL_STATUS_HEADER = "Email Status";
var STATUS_UPDATED_HEADER = "Status Updated (IST)";
var NEXT_FOLLOW_UP_HEADER = "Next Follow-up";
var LEAD_TABS = [QUALIFIED_SHEET, HANDOFF_SHEET];
var STATUS_EDIT_HANDLER = "onLeadStatusEdit";

// "yyyy-MM-dd HH:mm:ss" in IST, the same format as "Received (IST)".
function istText_(date) {
  return Utilities.formatDate(date, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
}

// The canonical status for a cell value ("contacted " -> "Contacted"), or "" if it is not one of LEAD_STATUSES.
function canonicalStatus_(v) {
  var s = String(v === null || v === undefined ? "" : v).trim().toLowerCase();
  for (var i = 0; i < LEAD_STATUSES.length; i++) if (LEAD_STATUSES[i].toLowerCase() === s) return LEAD_STATUSES[i];
  return "";
}

// Next follow-up for a status, counted from `from` (a Date): IST text, or "" when no follow-up is due.
function nextFollowUpFor_(status, from) {
  var days = FOLLOW_UP_DAYS[status];
  return days ? istText_(new Date(from.getTime() + days * 86400000)) : "";
}

// Header row of a lead tab: writes it on an empty tab, appends any header from `headers` that is missing,
// and returns { names: [header per column], index: { header name -> 1-based column } }.
function ensureLeadHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var names = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v).trim(); });
  headers.forEach(function (h) {
    if (names.indexOf(h) === -1) {
      names.push(h);
      sheet.getRange(1, names.length).setValue(h);
    }
  });
  return { names: names, index: headerIndex_(names) };
}

function headerIndex_(names) {
  var index = {};
  names.forEach(function (n, i) { if (n && !index[n]) index[n] = i + 1; });
  return index;
}

// Reads the header row of an existing tab without changing it.
function readLeadHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (sheet.getLastRow() === 0 || lastCol === 0) return { names: [], index: {} };
  var names = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v).trim(); });
  return { names: names, index: headerIndex_(names) };
}

// Status dropdown: only the four milestone statuses are accepted.
function applyStatusValidation_(range) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(LEAD_STATUSES, true)
    .setAllowInvalid(false)
    .setHelpText("Choose New, Contacted, Booked or Lost.")
    .build();
  range.setDataValidation(rule);
}

/**
 * Installable "on edit" trigger (created by setupLeadStatusTracking). When the team changes Status on a lead
 * tab, stamps Status Updated (IST) and sets Next Follow-up from the new status. Ignores other tabs, other
 * columns, the header row, rows without a Lead/Handoff ID, values that are not a milestone status, and
 * re-selecting the value a cell already had.
 */
function onLeadStatusEdit(e) {
  if (!e || !e.range) return;
  var range = e.range;
  var sheet = range.getSheet();
  // Week 7: the same trigger also stamps manual status changes on the Guest Messages tab (own handler below).
  if (sheet.getName() === GUEST_MESSAGES_SHEET) return guestMessageStatusEdit_(e);
  if (LEAD_TABS.indexOf(sheet.getName()) === -1) return;
  var cols = readLeadHeaders_(sheet);
  var statusCol = cols.index[STATUS_HEADER];
  var updatedCol = cols.index[STATUS_UPDATED_HEADER];
  var nextCol = cols.index[NEXT_FOLLOW_UP_HEADER];
  if (!statusCol || !updatedCol || !nextCol) return; // setupLeadStatusTracking has not been run on this tab
  if (statusCol < range.getColumn() || statusCol > range.getLastColumn()) return;
  var first = Math.max(range.getRow(), 2);
  var last = range.getLastRow();
  if (last < first) return;
  var n = last - first + 1;
  var singleCell = range.getNumRows() === 1 && range.getNumColumns() === 1;

  var ids = sheet.getRange(first, 2, n, 1).getValues();
  var statuses = sheet.getRange(first, statusCol, n, 1).getValues();
  var updated = sheet.getRange(first, updatedCol, n, 1).getValues();
  var next = sheet.getRange(first, nextCol, n, 1).getValues();
  var now = new Date();
  var changed = false, recased = false;
  for (var i = 0; i < n; i++) {
    if (!String(ids[i][0]).trim()) continue;
    var status = canonicalStatus_(statuses[i][0]);
    if (!status) continue;
    if (singleCell && e.oldValue !== undefined && canonicalStatus_(e.oldValue) === status) continue;
    if (statuses[i][0] !== status) { statuses[i][0] = status; recased = true; }
    updated[i][0] = istText_(now);
    next[i][0] = nextFollowUpFor_(status, now);
    changed = true;
  }
  if (!changed) return;
  if (recased) sheet.getRange(first, statusCol, n, 1).setValues(statuses);
  sheet.getRange(first, updatedCol, n, 1).setValues(updated);
  sheet.getRange(first, nextCol, n, 1).setValues(next);
}

/**
 * Run ONCE from the Apps Script editor after deploying Week 6 (safe to run again). For each lead tab:
 *   - adds the "Status Updated (IST)" and "Next Follow-up" columns if missing (existing columns are not moved),
 *   - puts the Status dropdown on every data row,
 *   - existing rows: empty Status -> New; a different-case status is normalised; any other value is left as
 *     it is and counted as "invalid" for the team to fix,
 *   - fills only EMPTY date cells: New rows get Status Updated = their Received (IST) time and Next Follow-up
 *     1 day after it; Contacted rows get Next Follow-up 2 days from now; Booked/Lost rows have Next Follow-up
 *     cleared,
 *   - installs the onLeadStatusEdit trigger for the leads Sheet (once).
 * Logs and returns a summary with counts only (no phone numbers or lead details).
 */
function setupLeadStatusTracking() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Another request holds the script lock; run this again in a minute.");
  var summary = { version: BOT_CODE_VERSION, tabs: {} };
  var ss;
  try {
    ss = openLeadsSpreadsheet_(props, null);
    var tz = ss.getSpreadsheetTimeZone();
    var now = new Date();
    [[QUALIFIED_SHEET, QUALIFIED_HEADERS], [HANDOFF_SHEET, HANDOFF_HEADERS]].forEach(function (pair) {
      var sheet = ss.getSheetByName(pair[0]) || ss.insertSheet(pair[0]);
      var cols = ensureLeadHeaders_(sheet, pair[1]);
      var statusCol = cols.index[STATUS_HEADER], updatedCol = cols.index[STATUS_UPDATED_HEADER];
      var nextCol = cols.index[NEXT_FOLLOW_UP_HEADER], receivedCol = cols.index["Received (IST)"];
      var stats = { rows: 0, setToNew: 0, normalised: 0, invalid: 0, statusUpdatedFilled: 0, followUpsSet: 0, followUpsCleared: 0 };
      if (sheet.getMaxRows() > 1) applyStatusValidation_(sheet.getRange(2, statusCol, sheet.getMaxRows() - 1, 1));
      var lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        var n = lastRow - 1;
        var ids = sheet.getRange(2, 2, n, 1).getValues();
        var received = receivedCol ? sheet.getRange(2, receivedCol, n, 1).getValues() : null;
        var statuses = sheet.getRange(2, statusCol, n, 1).getValues();
        var updated = sheet.getRange(2, updatedCol, n, 1).getValues();
        var next = sheet.getRange(2, nextCol, n, 1).getValues();
        for (var i = 0; i < n; i++) {
          if (!String(ids[i][0]).trim()) continue;
          stats.rows++;
          var raw = String(statuses[i][0]).trim();
          var status = canonicalStatus_(raw);
          if (!raw) { status = DEFAULT_LEAD_STATUS; statuses[i][0] = status; stats.setToNew++; }
          else if (!status) { stats.invalid++; continue; }
          else if (statuses[i][0] !== status) { statuses[i][0] = status; stats.normalised++; }
          var receivedMs = received ? istCellMs_(received[i][0], tz) : NaN;
          if (status === DEFAULT_LEAD_STATUS && String(updated[i][0]).trim() === "" && !isNaN(receivedMs)) {
            updated[i][0] = istText_(new Date(receivedMs));
            stats.statusUpdatedFilled++;
          }
          var hasNext = String(next[i][0]).trim() !== "";
          if (FOLLOW_UP_DAYS[status] && !hasNext) {
            var from = status === DEFAULT_LEAD_STATUS && !isNaN(receivedMs) ? new Date(receivedMs) : now;
            next[i][0] = nextFollowUpFor_(status, from);
            stats.followUpsSet++;
          } else if (!FOLLOW_UP_DAYS[status] && hasNext) {
            next[i][0] = "";
            stats.followUpsCleared++;
          }
        }
        sheet.getRange(2, statusCol, n, 1).setValues(statuses);
        sheet.getRange(2, updatedCol, n, 1).setValues(updated);
        sheet.getRange(2, nextCol, n, 1).setValues(next);
      }
      summary.tabs[pair[0]] = stats;
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === STATUS_EDIT_HANDLER && t.getTriggerSourceId() === ss.getId();
  });
  if (!exists) ScriptApp.newTrigger(STATUS_EDIT_HANDLER).forSpreadsheet(ss).onEdit().create();
  summary.trigger = exists ? "already installed" : "installed";
  var text = "LEAD STATUS SETUP | " + JSON.stringify(summary);
  console.log(text);
  Logger.log(text);
  return summary;
}

// ===================== Week 6, Step 2: simple lead scoring =====================
//
// "Score" (0-100) and "Priority" (Hot / Warm / Cold) on "Qualified Leads" and "Handoffs". Calculated when a
// lead is written, and again for open leads (Status New or Contacted) whenever recalculateLeadScores() is run.
// All rules live in scoreLead_ below; the bands live in priorityFor_.

var SCORE_HEADER = "Score";
var PRIORITY_HEADER = "Priority";
var OPEN_LEAD_STATUSES = ["New", "Contacted"]; // Booked and Lost are closed: their score is left as it was

/**
 * THE scoring rules. Deterministic: the same lead on the same day always gets the same score.
 *   lead:     { qualified: true|false, reason, checkIn, checkOut, nights, property, ref }
 *             (the existing lead columns; dates are "yyyy-MM-dd" text, anything else counts as "not given")
 *   todayIst: today's date in India, "yyyy-MM-dd"
 * Returns { score, priority, reasons } where reasons lists every rule that applied, e.g. "Qualified lead +40".
 *
 *   Check-in date already passed ........................ score 0 (no other rule applies)
 *   Qualified lead ...................................... +40
 *   Handoff, guest asked for a person (HUMAN_REQUESTED) . +25
 *   Handoff, bot could not finish (NEEDS_FOLLOW_UP) ..... +10
 *   Check-in within 7 days (today counts as 0 days) ..... +20
 *   Check-in in 8 to 30 days ............................ +10   (the 7-day and 30-day rules never add up)
 *   Both check-in and check-out given ................... +10
 *   Specific property given ............................. +10
 *   3 or more nights .................................... +10
 *   Ref from a property page or availability widget ..... +5    (W-PROP-..., or ending in -AVAILABILITY)
 * The highest possible score is 95; the result is kept within 0-100.
 */
function scoreLead_(lead, todayIst) {
  var checkIn = isoDateOrNull_(lead.checkIn);
  var checkOut = isoDateOrNull_(lead.checkOut);
  if (checkIn && checkIn < todayIst) {
    return { score: 0, priority: priorityFor_(0), reasons: ["Check-in has already passed: score 0"] };
  }
  var score = 0;
  var reasons = [];
  function add(points, why) { score += points; reasons.push(why + " +" + points); }

  if (lead.qualified) add(40, "Qualified lead");
  else if (lead.reason === "HUMAN_REQUESTED") add(25, "Guest asked for a person");
  else if (lead.reason === "NEEDS_FOLLOW_UP") add(10, "Needs follow-up");

  if (checkIn) {
    var daysAway = nightsBetween_(todayIst, checkIn);
    if (daysAway <= 7) add(20, "Check-in within 7 days");
    else if (daysAway <= 30) add(10, "Check-in within 30 days");
  }
  if (checkIn && checkOut) add(10, "Check-in and check-out given");
  if (String(lead.property === null || lead.property === undefined ? "" : lead.property).trim()) add(10, "Specific property");
  var nights = Number(lead.nights);
  if (isFinite(nights) && nights >= 3) add(10, "3 or more nights");
  if (isPropertyOrAvailabilityRef_(lead.ref)) add(5, "Property/availability Ref");

  score = Math.max(0, Math.min(100, score));
  return { score: score, priority: priorityFor_(score), reasons: reasons };
}

// Priority bands: 70-100 Hot, 40-69 Warm, below 40 Cold.
function priorityFor_(score) {
  if (score >= 70) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
}

// "yyyy-MM-dd" for a real calendar date, otherwise null.
function isoDateOrNull_(v) {
  var s = String(v === null || v === undefined ? "" : v).trim();
  if (!ISO_DATE.test(s)) return null;
  var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  return d.getUTCFullYear() === +s.slice(0, 4) && d.getUTCMonth() === +s.slice(5, 7) - 1 && d.getUTCDate() === +s.slice(8, 10) ? s : null;
}

// Website Refs: W-PROP-<slug> (property page) or W-...-AVAILABILITY (Check Availability widget).
function isPropertyOrAvailabilityRef_(ref) {
  var s = String(ref === null || ref === undefined ? "" : ref).trim();
  return /^W-PROP-./.test(s) || /^W-.+-AVAILABILITY$/.test(s);
}

// Today's date in India, "yyyy-MM-dd".
function istDateText_(date) {
  return Utilities.formatDate(date, "Asia/Kolkata", "yyyy-MM-dd");
}

// A date cell as "yyyy-MM-dd": our text as written, or the Date the Sheet may have turned it into.
function sheetDateText_(v, tz) {
  if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, tz, "yyyy-MM-dd");
  return sheetText_(v).trim();
}

/**
 * Run from the Apps Script editor (no trigger yet). Recalculates Score and Priority for every OPEN lead
 * (Status New, Contacted, or empty) on both lead tabs, using today's date, so "check-in within 7 days" and
 * "check-in has passed" stay current. Booked and Lost rows, and rows with any other status, are not changed.
 * Adds the Score and Priority columns if they are missing. Logs and returns counts only (no lead details).
 */
function recalculateLeadScores() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Another request holds the script lock; run this again in a minute.");
  var today = istDateText_(new Date());
  var summary = { version: BOT_CODE_VERSION, today: today, tabs: {} };
  try {
    var ss = openLeadsSpreadsheet_(props, null);
    var tz = ss.getSpreadsheetTimeZone();
    [[QUALIFIED_SHEET, QUALIFIED_HEADERS, true, "Lead ID"], [HANDOFF_SHEET, HANDOFF_HEADERS, false, "Handoff ID"]].forEach(function (t) {
      var sheet = ss.getSheetByName(t[0]);
      if (!sheet) { summary.tabs[t[0]] = { missing: true }; return; }
      var cols = ensureLeadHeaders_(sheet, t[1]);
      var stats = { open: 0, notOpen: 0, hot: 0, warm: 0, cold: 0 };
      var last = sheet.getLastRow();
      if (last >= 2) {
        var n = last - 1;
        var rows = sheet.getRange(2, 1, n, cols.names.length).getValues();
        var scoreCol = cols.index[SCORE_HEADER], priorityCol = cols.index[PRIORITY_HEADER];
        var scores = sheet.getRange(2, scoreCol, n, 1).getValues();
        var priorities = sheet.getRange(2, priorityCol, n, 1).getValues();
        for (var i = 0; i < n; i++) {
          var get = function (name) { return cols.index[name] ? rows[i][cols.index[name] - 1] : ""; };
          if (!String(get(t[3])).trim()) continue;
          var rawStatus = String(get(STATUS_HEADER)).trim();
          if (rawStatus && OPEN_LEAD_STATUSES.indexOf(canonicalStatus_(rawStatus)) === -1) { stats.notOpen++; continue; }
          var result = scoreLead_({
            qualified: t[2], reason: t[2] ? null : sheetText_(get("Reason")).trim(),
            checkIn: sheetDateText_(get("Check-in"), tz), checkOut: sheetDateText_(get("Check-out"), tz),
            nights: get("Nights"), property: sheetText_(get("Property")), ref: sheetText_(get("Ref"))
          }, today);
          scores[i][0] = result.score;
          priorities[i][0] = result.priority;
          stats.open++;
          stats[result.priority.toLowerCase()]++;
        }
        sheet.getRange(2, scoreCol, n, 1).setValues(scores);
        sheet.getRange(2, priorityCol, n, 1).setValues(priorities);
      }
      summary.tabs[t[0]] = stats;
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  var text = "LEAD SCORE RECALC | " + JSON.stringify(summary);
  console.log(text);
  Logger.log(text);
  return summary;
}

// ===================== Week 6, Step 3: follow-up reminders =====================
//
// Once a day, sendFollowUpDigest emails ONE digest to TEAM_EMAILS listing every lead whose follow-up is due:
//   Next Follow-up is today or earlier (date in India), Status is not Booked or Lost, and the row has a valid
//   Lead ID (L-XXXXXXXXXX) or Handoff ID (H-XXXXXXXXXX).
// Sorted Hot, then Warm, then Cold (then any row without a Priority). Within a priority: overdue first, then
// higher score, then the oldest follow-up date. A lead is marked OVERDUE when its follow-up date is before today,
// or when it is still New more than 24 hours after it was received.
// Reminder only: it never changes Status or any other cell, never contacts a guest (no WhatsApp, no Twilio), and
// sends nothing when no lead is due. setupFollowUpReminders installs the daily trigger (once).

var FOLLOW_UP_DIGEST_HANDLER = "sendFollowUpDigest";
var FOLLOW_UP_DIGEST_HOUR = 9; // about 09:30 in the project's time zone (Apps Script runs it within +/- 15 min)
var FOLLOW_UP_DIGEST_MINUTE = 30;
var FOLLOW_UP_FALLBACK_TZ = "Asia/Kolkata"; // used only if the project has no time zone set
var LAST_DIGEST_PROPERTY = "LAST_FOLLOW_UP_DIGEST"; // date (India) of the last digest actually sent
var CLOSED_LEAD_STATUSES = ["Booked", "Lost"];
var PRIORITY_RANK = { "Hot": 0, "Warm": 1, "Cold": 2 }; // anything else sorts after Cold
var NEW_LEAD_OVERDUE_MS = 24 * 60 * 60 * 1000;

// Date part ("yyyy-MM-dd") of a Next Follow-up cell: our "yyyy-MM-dd HH:mm:ss" text, a date typed by the team,
// or a Date cell (read in the spreadsheet's time zone). "" when there is no usable date.
function followUpDateText_(v, tz) {
  if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, tz, "yyyy-MM-dd");
  var m = sheetText_(v).trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/);
  return m ? (isoDateOrNull_(m[1]) || "") : "";
}

// A cell for the email: Date cells as "yyyy-MM-dd HH:mm" in the spreadsheet's time zone, text as written.
function cellDisplay_(v, tz) {
  if (Object.prototype.toString.call(v) === "[object Date]") return isNaN(v.getTime()) ? "" : Utilities.formatDate(v, tz, "yyyy-MM-dd HH:mm");
  return sheetText_(v).trim();
}

// Every due lead on both lead tabs (read-only). Returns { items, tabs } where tabs says, per tab, how many
// were due or why the tab was skipped. A Lead/Handoff ID that appears on more than one row is listed once.
function collectDueFollowUps_(ss, today, now) {
  var tz = ss.getSpreadsheetTimeZone();
  var sheetUrl = String(ss.getUrl()).replace(/[?#].*$/, "");
  var items = [], seen = {}, tabs = {};
  [[QUALIFIED_SHEET, "Lead ID", /^L-[0-9A-F]{10}$/, "Qualified lead"],
   [HANDOFF_SHEET, "Handoff ID", /^H-[0-9A-F]{10}$/, "Handoff"]].forEach(function (t) {
    var sheet = ss.getSheetByName(t[0]);
    if (!sheet) { tabs[t[0]] = "missing tab"; return; }
    var cols = readLeadHeaders_(sheet);
    if (!cols.index[t[1]] || !cols.index[STATUS_HEADER] || !cols.index[NEXT_FOLLOW_UP_HEADER]) {
      tabs[t[0]] = "missing columns (run setupLeadStatusTracking)";
      return;
    }
    var last = sheet.getLastRow();
    var rows = last >= 2 ? sheet.getRange(2, 1, last - 1, cols.names.length).getValues() : [];
    var due = 0;
    rows.forEach(function (row, i) {
      var get = function (name) { return cols.index[name] ? row[cols.index[name] - 1] : ""; };
      var id = sheetText_(get(t[1])).trim();
      if (!t[2].test(id) || seen[id]) return;
      var statusText = sheetText_(get(STATUS_HEADER)).trim();
      if (CLOSED_LEAD_STATUSES.indexOf(canonicalStatus_(statusText)) !== -1) return;
      var followUpDate = followUpDateText_(get(NEXT_FOLLOW_UP_HEADER), tz);
      if (!followUpDate || followUpDate > today) return;
      seen[id] = true;
      due++;
      var receivedMs = istCellMs_(get("Received (IST)"), tz);
      var overdueWhy = [];
      if (followUpDate < today) overdueWhy.push("follow-up date has passed");
      if (canonicalStatus_(statusText) === DEFAULT_LEAD_STATUS && !isNaN(receivedMs) && now.getTime() - receivedMs > NEW_LEAD_OVERDUE_MS) {
        overdueWhy.push("still New more than 24 hours after it was received");
      }
      var scoreNum = Number(get(SCORE_HEADER));
      var scoreText = sheetText_(get(SCORE_HEADER)).trim();
      items.push({
        kind: t[3], id: id, row: i + 2, link: sheetUrl + "#gid=" + sheet.getSheetId() + "&range=A" + (i + 2),
        status: statusText || "(empty)", priority: sheetText_(get(PRIORITY_HEADER)).trim(),
        score: scoreText !== "" && isFinite(scoreNum) ? scoreNum : null,
        phone: sheetText_(get("Phone")).trim(), reason: sheetText_(get("Reason")).trim(),
        destination: sheetText_(get("Destination")).trim(), property: sheetText_(get("Property")).trim(),
        checkIn: sheetDateText_(get("Check-in"), tz), checkOut: sheetDateText_(get("Check-out"), tz),
        nights: sheetText_(get("Nights")).trim(), guests: sheetText_(get("Guests")).trim(),
        received: cellDisplay_(get("Received (IST)"), tz), nextFollowUp: cellDisplay_(get(NEXT_FOLLOW_UP_HEADER), tz),
        followUpDate: followUpDate, overdue: overdueWhy.length > 0, overdueWhy: overdueWhy
      });
    });
    tabs[t[0]] = due;
  });
  items.sort(compareDueFollowUps_);
  return { items: items, tabs: tabs };
}

// Hot, Warm, Cold, then no/unknown Priority; then overdue first; then higher score; then oldest follow-up date.
function compareDueFollowUps_(a, b) {
  var pa = PRIORITY_RANK.hasOwnProperty(a.priority) ? PRIORITY_RANK[a.priority] : 3;
  var pb = PRIORITY_RANK.hasOwnProperty(b.priority) ? PRIORITY_RANK[b.priority] : 3;
  if (pa !== pb) return pa - pb;
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  var sa = a.score === null ? -1 : a.score, sb = b.score === null ? -1 : b.score;
  if (sa !== sb) return sb - sa;
  if (a.followUpDate !== b.followUpDate) return a.followUpDate < b.followUpDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// The digest email (plain text) for a sorted list of due leads.
function followUpDigestEmail_(items, today, sheetUrl) {
  var overdue = items.filter(function (it) { return it.overdue; }).length;
  var counts = { Hot: 0, Warm: 0, Cold: 0, other: 0 };
  items.forEach(function (it) { counts[PRIORITY_RANK.hasOwnProperty(it.priority) ? it.priority : "other"]++; });
  var lines = [
    "Lead follow-ups due on " + today + " (India time): " + items.length + (items.length === 1 ? " lead" : " leads") +
      (overdue ? ", " + overdue + " overdue." : "."),
    "Hot: " + counts.Hot + " | Warm: " + counts.Warm + " | Cold: " + counts.Cold + (counts.other ? " | No priority: " + counts.other : ""),
    "",
    "Reminder only: no status was changed and no message was sent to any guest. After following up, update Status",
    "(Contacted, Booked or Lost) in the Sheet; Next Follow-up then moves on by itself.",
    ""
  ];
  items.forEach(function (it, i) {
    lines.push((i + 1) + ". " + (it.overdue ? "OVERDUE (" + it.overdueWhy.join("; ") + ") | " : "Due today | ") +
      (it.priority || "No priority") + (it.score === null ? "" : ", score " + it.score));
    lines.push("   " + it.kind + " " + it.id + " | Status: " + it.status);
    if (it.reason) lines.push("   Reason: " + (it.reason === "HUMAN_REQUESTED" ? "guest asked for a team member" : it.reason === "NEEDS_FOLLOW_UP" ? "assistant could not complete the details" : it.reason));
    if (it.phone) lines.push("   Guest WhatsApp: " + it.phone);
    var stay = [it.property, it.destination].filter(function (s) { return s; }).join(", ");
    var details = [];
    if (stay) details.push("Stay: " + stay);
    if (it.checkIn) details.push("Check-in " + it.checkIn);
    if (it.checkOut) details.push("Check-out " + it.checkOut);
    if (it.nights) details.push(it.nights + (it.nights === "1" ? " night" : " nights"));
    if (it.guests) details.push(it.guests + (it.guests === "1" ? " guest" : " guests"));
    if (details.length) lines.push("   " + details.join(" | "));
    lines.push("   Next follow-up: " + it.nextFollowUp + (it.received ? " | Received: " + it.received : ""));
    lines.push("   Row: " + it.link);
    lines.push("");
  });
  lines.push("Leads Sheet: " + sheetUrl);
  return {
    subject: "Lead follow-ups due " + today + ": " + items.length + (overdue ? " (" + overdue + " overdue)" : ""),
    body: lines.join("\n")
  };
}

/**
 * Daily trigger handler (installed by setupFollowUpReminders; can also be run by hand from the editor).
 * Sends at most one digest per day: once a digest has been sent, later runs on the same date (India) send
 * nothing. To send again the same day, delete the Script Property LAST_FOLLOW_UP_DIGEST.
 * Logs and returns counts only (no phone numbers or lead details).
 */
function sendFollowUpDigest() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var today = istDateText_(now);
  var result = { version: BOT_CODE_VERSION, today: today, sent: false };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    result.reason = "busy: another request holds the script lock";
  } else {
    try {
      if (props.getProperty(LAST_DIGEST_PROPERTY) === today) {
        result.reason = "already sent today";
      } else {
        var ss = openLeadsSpreadsheet_(props, null);
        var found = collectDueFollowUps_(ss, today, now);
        result.tabs = found.tabs;
        result.due = found.items.length;
        result.overdue = found.items.filter(function (it) { return it.overdue; }).length;
        if (!found.items.length) {
          result.reason = "nothing due";
        } else {
          var check = teamMailCheck_(props);
          if (!check.send) {
            result.reason = check.reason;
          } else {
            var email = followUpDigestEmail_(found.items, today, String(ss.getUrl()).replace(/[?#].*$/, ""));
            try {
              MailApp.sendEmail({ to: check.to.join(","), subject: email.subject, body: email.body });
              props.setProperty(LAST_DIGEST_PROPERTY, today);
              result.sent = true;
              result.recipients = check.to.length;
            } catch (err) {
              result.reason = "send failed: " + safeErrName_(err);
            }
          }
        }
      }
    } finally {
      lock.releaseLock();
    }
  }
  var text = "FOLLOW-UP DIGEST | " + JSON.stringify(result);
  console.log(text);
  Logger.log(text);
  return result;
}

/**
 * Run ONCE from the Apps Script editor (safe to run again). Installs the daily sendFollowUpDigest trigger at
 * about 09:30 in the project's time zone (Project Settings -> Time zone); if the project has none, India time.
 * Never creates a second trigger: an existing one is kept, and any extra copies are removed.
 * Logs and returns a summary.
 */
function setupFollowUpReminders() {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === FOLLOW_UP_DIGEST_HANDLER;
  });
  for (var i = 1; i < existing.length; i++) ScriptApp.deleteTrigger(existing[i]);
  var projectTz = Session.getScriptTimeZone();
  if (!existing.length) {
    var builder = ScriptApp.newTrigger(FOLLOW_UP_DIGEST_HANDLER).timeBased()
      .atHour(FOLLOW_UP_DIGEST_HOUR).nearMinute(FOLLOW_UP_DIGEST_MINUTE).everyDays(1);
    if (!projectTz) builder = builder.inTimezone(FOLLOW_UP_FALLBACK_TZ);
    builder.create();
  }
  var tz = projectTz || FOLLOW_UP_FALLBACK_TZ;
  var summary = {
    version: BOT_CODE_VERSION,
    trigger: existing.length ? "already installed" : "installed",
    duplicatesRemoved: Math.max(existing.length - 1, 0),
    runsAt: "daily, about 09:30 (" + tz + ")",
    teamEmailsSet: !!String(PropertiesService.getScriptProperties().getProperty("TEAM_EMAILS") || "").trim()
  };
  if (tz !== FOLLOW_UP_FALLBACK_TZ) {
    summary.note = "The project time zone is " + tz + ", so the digest runs at about 09:30 there. To run it at 09:30 India time, set the project time zone to Asia/Kolkata (Project Settings) and run this again after deleting the trigger.";
  }
  var text = "FOLLOW-UP REMINDER SETUP | " + JSON.stringify(summary);
  console.log(text);
  Logger.log(text);
  return summary;
}

// ===================== Week 6, Stretch 1: conversion report by source =====================
//
// generateConversionReport() (run by hand from the editor) rebuilds the "Conversion Report" tab from the current
// data. It only READS "Qualified Leads", "Handoffs" and "WhatsApp Clicks", and only WRITES the report tab:
// no lead row is changed, no email is sent, no guest is contacted. Safe to run any number of times.
//   One lead = one valid Lead ID (L-...) or Handoff ID (H-...), counted once even if it appears on several rows.
//   Status as on the lead tabs: empty counts as New; anything other than the four statuses is "Other status".
//   Open = New + Contacted. Booking conversion = Booked / Total. Contact rate = Contacted / Total (current
//   status). Reached rate = (Contacted + Booked) / Total. Click -> Lead (approximate) = leads with a Ref / clicks
//   with the same Ref; clicks are not matched to individual leads.

var CONVERSION_REPORT_SHEET = "Conversion Report";
var CONVERSION_REPORT_MARKER = "Conversion Report"; // cell A1 of a report this script generated
var CONVERSION_STATUS_COLUMNS = ["New", "Contacted", "Booked", "Lost"];

// Percentage text with one decimal ("33.3%"), or "N/A" when there is nothing to divide by.
function percentText_(part, whole) {
  return whole > 0 ? (Math.round(part / whole * 1000) / 10).toFixed(1) + "%" : "N/A";
}

// Which kind of website link a Ref comes from (Refs are built in the website's lib/whatsapp.ts).
function refEntryPoint_(ref) {
  if (ref === "DIRECT" || ref === "(none)") return "Direct (no website Ref)";
  if (ref === "W-FLOATING") return "Floating button";
  if (ref === "W-CONTACT") return "Contact page";
  if (/^W-PROP-./.test(ref)) return "Property page";
  if (/^W-.+-AVAILABILITY$/.test(ref)) return "Availability widget";
  if (/^W-./.test(ref)) return "Other website link";
  return "Unknown";
}

function emptyConversionGroup_() {
  return { total: 0, qualified: 0, handoffs: 0, phones: {}, New: 0, Contacted: 0, Booked: 0, Lost: 0, other: 0, clicks: 0 };
}

function addToConversionGroup_(g, lead) {
  g.total++;
  if (lead.kind === "qualified") g.qualified++; else g.handoffs++;
  if (lead.phone) g.phones[lead.phone] = true;
  var status = lead.status ? canonicalStatus_(lead.status) : DEFAULT_LEAD_STATUS; // empty Status = New
  if (status) g[status]++; else g.other++;
}

/**
 * Pure counting. leads: [{ kind: "qualified"|"handoff", id, source, ref, status, phone }] in sheet order;
 * clickRefs: the Ref of every WhatsApp Clicks row. IDs must already be valid; a repeated ID counts once.
 * Returns { bySource: {name: group}, byRef: {ref: group}, total: group, duplicates }.
 */
function buildConversionStats_(leads, clickRefs) {
  var bySource = {}, byRef = {}, total = emptyConversionGroup_(), seen = {}, duplicates = 0;
  leads.forEach(function (lead) {
    if (seen[lead.id]) { duplicates++; return; }
    seen[lead.id] = true;
    var source = lead.source || "(none)";
    var ref = lead.ref || "(none)";
    addToConversionGroup_(bySource[source] || (bySource[source] = emptyConversionGroup_()), lead);
    addToConversionGroup_(byRef[ref] || (byRef[ref] = emptyConversionGroup_()), lead);
    addToConversionGroup_(total, lead);
  });
  clickRefs.forEach(function (ref) {
    if (!/^W-[A-Za-z0-9-]{1,80}$/.test(ref)) return;
    (byRef[ref] || (byRef[ref] = emptyConversionGroup_())).clicks++;
    total.clicks++;
  });
  return { bySource: bySource, byRef: byRef, total: total, duplicates: duplicates };
}

// The shared columns of both sections for one group.
function conversionCells_(g) {
  var open = g.New + g.Contacted;
  return [g.total, g.qualified, g.handoffs, Object.keys(g.phones).length, g.New, g.Contacted, g.Booked, g.Lost, g.other, open,
    percentText_(g.Booked, g.total), percentText_(g.Contacted, g.total), percentText_(g.Contacted + g.Booked, g.total)];
}

var CONVERSION_COMMON_HEADERS = ["Total leads", "Qualified", "Handoffs", "Unique guests", "New", "Contacted", "Booked", "Lost",
  "Other status", "Open leads", "Booking conversion %", "Contact rate %", "Reached rate %"];
var CONVERSION_SOURCE_HEADERS = ["Source"].concat(CONVERSION_COMMON_HEADERS);
var CONVERSION_REF_HEADERS = ["Ref", "Entry point"].concat(CONVERSION_COMMON_HEADERS, ["WhatsApp clicks", "Click → Lead % (approx.)"]);

// Groups sorted by total leads (most first), then clicks, then name.
function sortedGroupNames_(groups) {
  return Object.keys(groups).sort(function (a, b) {
    var ga = groups[a], gb = groups[b];
    if (ga.total !== gb.total) return gb.total - ga.total;
    if (ga.clicks !== gb.clicks) return gb.clicks - ga.clicks;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** The report as rows of cells (text cells are not yet passed through cell_). */
function conversionReportRows_(stats, generatedIst, notes) {
  var rows = [
    [CONVERSION_REPORT_MARKER, "Generated by generateConversionReport(). Do not edit: run it again to refresh."],
    ["Generated (IST)", generatedIst],
    ["Definitions", "One lead = one Lead ID or Handoff ID, counted once. Empty Status counts as New. Open = New + Contacted. " +
      "Booking conversion = Booked / Total. Contact rate = Contacted / Total (current status). Reached rate = (Contacted + Booked) / Total."]
  ];
  notes.forEach(function (n) { rows.push(["Note", n]); });
  rows.push([]);
  rows.push(["By Source"]);
  rows.push(CONVERSION_SOURCE_HEADERS.slice());
  sortedGroupNames_(stats.bySource).forEach(function (name) {
    rows.push([name].concat(conversionCells_(stats.bySource[name])));
  });
  rows.push(["Total"].concat(conversionCells_(stats.total)));
  rows.push([]);
  rows.push(["By Ref (website entry point)"]);
  rows.push(["Note", "WhatsApp clicks are counted by exact Ref from the WhatsApp Clicks tab. Click → Lead % is APPROXIMATE: " +
    "clicks are not matched to individual leads, not every click becomes a WhatsApp message, and clicks count even when the bot is off. " +
    "N/A = no clicks for that Ref."]);
  rows.push(CONVERSION_REF_HEADERS.slice());
  var websiteLeads = 0;
  sortedGroupNames_(stats.byRef).forEach(function (ref) {
    var g = stats.byRef[ref];
    if (/^W-./.test(ref)) websiteLeads += g.total;
    rows.push([ref, refEntryPoint_(ref)].concat(conversionCells_(g), [g.clicks, percentText_(g.total, g.clicks)]));
  });
  rows.push(["Total", "All"].concat(conversionCells_(stats.total), [stats.total.clicks, percentText_(websiteLeads, stats.total.clicks)]));
  return rows;
}

/**
 * Run from the Apps Script editor. Rebuilds the "Conversion Report" tab from the current lead and click data.
 * Refuses to overwrite a non-empty "Conversion Report" tab that this script did not create (cell A1 is checked).
 * Logs and returns counts only (no phone numbers or lead details).
 */
function generateConversionReport() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Another request holds the script lock; run this again in a minute.");
  var summary = { version: BOT_CODE_VERSION };
  try {
    var ss = openLeadsSpreadsheet_(props, null);
    var leads = [], notes = [], skippedNoId = 0;
    [[QUALIFIED_SHEET, "Lead ID", /^L-[0-9A-F]{10}$/, "qualified"],
     [HANDOFF_SHEET, "Handoff ID", /^H-[0-9A-F]{10}$/, "handoff"]].forEach(function (t) {
      var sheet = ss.getSheetByName(t[0]);
      if (!sheet) { notes.push("The " + t[0] + " tab is missing, so it is not counted."); return; }
      var cols = readLeadHeaders_(sheet);
      if (!cols.index[t[1]]) { notes.push("The " + t[0] + " tab has no " + t[1] + " column, so it is not counted."); return; }
      var last = sheet.getLastRow();
      var rows = last >= 2 ? sheet.getRange(2, 1, last - 1, cols.names.length).getValues() : [];
      rows.forEach(function (row) {
        var get = function (name) { return cols.index[name] ? sheetText_(row[cols.index[name] - 1]).trim() : ""; };
        var id = get(t[1]);
        if (!t[2].test(id)) { if (row.some(function (v) { return String(v).trim() !== ""; })) skippedNoId++; return; }
        leads.push({ kind: t[3], id: id, source: get("Source"), ref: get("Ref"), status: get(STATUS_HEADER), phone: get("Phone") });
      });
    });
    var clickRefs = [];
    var clicks = ss.getSheetByName(SHEET_NAME);
    if (!clicks) {
      notes.push("The " + SHEET_NAME + " tab is missing, so click counts are 0.");
    } else {
      var clickCols = readLeadHeaders_(clicks);
      var refCol = clickCols.index["Ref"];
      var lastClick = clicks.getLastRow();
      if (refCol && lastClick >= 2) {
        clicks.getRange(2, refCol, lastClick - 1, 1).getValues().forEach(function (r) { clickRefs.push(sheetText_(r[0]).trim()); });
      }
    }
    var stats = buildConversionStats_(leads, clickRefs);
    if (skippedNoId) notes.push(skippedNoId + " row(s) without a valid Lead/Handoff ID are not counted.");
    if (stats.duplicates) notes.push(stats.duplicates + " row(s) repeat a Lead/Handoff ID already counted and are not counted again.");

    var generated = istText_(new Date());
    var rows = conversionReportRows_(stats, generated, notes);
    var width = 0;
    rows.forEach(function (r) { width = Math.max(width, r.length); });
    var grid = rows.map(function (r) {
      var out = [];
      for (var i = 0; i < width; i++) out.push(i < r.length ? cell_(r[i]) : "");
      return out;
    });

    var report = ss.getSheetByName(CONVERSION_REPORT_SHEET);
    if (report) {
      var a1 = report.getLastRow() > 0 ? sheetText_(report.getRange(1, 1).getValue()).trim() : "";
      if (report.getLastRow() > 0 && a1 !== CONVERSION_REPORT_MARKER) {
        throw new Error("A \"" + CONVERSION_REPORT_SHEET + "\" tab already exists and was not created by this script (cell A1 is not \"" +
          CONVERSION_REPORT_MARKER + "\"). Rename or delete that tab, then run generateConversionReport again.");
      }
      report.clearContents();
    } else {
      report = ss.insertSheet(CONVERSION_REPORT_SHEET);
    }
    report.getRange(1, 1, grid.length, width).setValues(grid);
    SpreadsheetApp.flush();

    summary.generatedAt = generated;
    summary.leads = stats.total.total;
    summary.qualified = stats.total.qualified;
    summary.handoffs = stats.total.handoffs;
    summary.sources = Object.keys(stats.bySource).length;
    summary.refs = Object.keys(stats.byRef).length;
    summary.clicks = stats.total.clicks;
    summary.skippedNoId = skippedNoId;
    summary.duplicateIds = stats.duplicates;
  } finally {
    lock.releaseLock();
  }
  var text = "CONVERSION REPORT | " + JSON.stringify(summary);
  console.log(text);
  Logger.log(text);
  return summary;
}

// ===================== Week 6, Stretch 2: automatic WhatsApp follow-ups (off / dry run / live) =====================
//
// sendWhatsAppFollowUps (daily trigger from setupWhatsAppFollowUps, or run by hand) selects leads that are due a
// WhatsApp follow-up and, for each, calls the website endpoint /api/whatsapp/follow-up. The website checks the
// guest's opt-out (STOP) and claims the lead once in Redis.
//   WA_FOLLOW_UP_MODE = off (default) : nothing is read, nothing is contacted.
//   WA_FOLLOW_UP_MODE = dry_run       : asks "could we send?" only. No message. (Phase A, unchanged.)
//   WA_FOLLOW_UP_MODE = live          : the website sends ONE approved WhatsApp template per lead. Refused unless the
//                                       second switch WA_FOLLOW_UP_LIVE_ENABLED is "true" here AND the website has
//                                       its own live switch, the inbound bot on and the approved template configured.
// The template (Content SID) lives only on the website (Vercel); this script never holds Twilio settings and only
// sends the website the guest-safe fields destination, property, check-in and check-out (never score, Source, Ref,
// notes or IDs other than the Lead ID used for the claim).
//
// A lead is processed only when ALL of these hold:
//   - tab "Qualified Leads" (handoffs are never followed up automatically), valid Lead ID, first row with that ID
//   - Status is Contacted (New, Booked, Lost, empty or anything else: never)
//   - Source is exactly "whatsapp-bot" (sandbox, diagnostic and test rows: never); not the diagnostic Lead ID
//   - Received (IST) on or after WA_FOLLOW_UP_START_DATE (older leads: never)
//   - Next Follow-up is today or earlier (India), and the check-in date is today or later
//   - Auto Follow-up is not "No" (the team's per-lead switch)
//   - the phone is a valid number, not in WA_FOLLOW_UP_BLOCKED_PHONES, and (if WA_FOLLOW_UP_ALLOWED_PHONES is set)
//     in that list
//   - not already processed: WA Message ID is empty, and WA Follow-up Status is empty or a same-day-only status
//     ("Dry run: ...", "In progress: ...", "Live: will retry ...") from an EARLIER day. Every other status (a live
//     send, opt-out, duplicate or failed send, or text the team typed) blocks the lead permanently.
//   - at most one lead per phone number per run, and at most WA_FOLLOW_UP_DAILY_CAP endpoint calls per day (India)
//   - the run is between 10:00 and 19:00 India time, and no other follow-up run is in progress
//   - live only: the website also allows one automatic follow-up per guest NUMBER per 30 days (any Lead ID)
// A run starts no new endpoint call after 4 minutes, so its results are written before Apps Script's 6-minute limit.
// Order: Hot, Warm, Cold, then higher Score, then the oldest follow-up date.
// Overlapping runs: a run marker (WA_FOLLOW_UP_RUNNING, expires after 10 minutes) stops a second run, and every
// picked lead is marked "In progress: ..." under the script lock before any endpoint call, so another run skips it.
// The endpoint is called outside the lock; results are written under the lock to the row found again by Lead ID.
// Only the WA Follow-up columns are written (Status, WA Follow-up Sent (IST), WA Message ID); Status, Next
// Follow-up, Score and every other column are never changed, and no email is sent.
// Logs and the WA_FOLLOW_UP_LAST_RUN property hold counts only (no phone numbers, secrets or lead details).

var WA_FOLLOW_UP_HANDLER = "sendWhatsAppFollowUps";
var WA_FOLLOW_UP_AUTO_HEADER = "Auto Follow-up";
var WA_FOLLOW_UP_STATUS_HEADER = "WA Follow-up Status";
var WA_FOLLOW_UP_SENT_HEADER = "WA Follow-up Sent (IST)";
var WA_FOLLOW_UP_MESSAGE_ID_HEADER = "WA Message ID";
var WA_FOLLOW_UP_HEADERS = [WA_FOLLOW_UP_AUTO_HEADER, WA_FOLLOW_UP_STATUS_HEADER, WA_FOLLOW_UP_SENT_HEADER, WA_FOLLOW_UP_MESSAGE_ID_HEADER];
var WA_FOLLOW_UP_MODES = ["off", "dry_run", "live"];
var WA_FOLLOW_UP_LIVE_SWITCH_PROPERTY = "WA_FOLLOW_UP_LIVE_ENABLED"; // must be "true" for mode live (second key)
var WA_FOLLOW_UP_SOURCE = "whatsapp-bot"; // Production bot leads only
var WA_FOLLOW_UP_DIAGNOSTIC_ID = "L-0000000000"; // diagnoseBotLead's synthetic lead
var WA_FOLLOW_UP_DEFAULT_CAP = 10;
var WA_FOLLOW_UP_MAX_CAP = 50;
var WA_FOLLOW_UP_MIN_SECRET_LENGTH = 32;
var WA_FOLLOW_UP_WINDOW_START_HOUR = 10; // India time, inclusive
var WA_FOLLOW_UP_WINDOW_END_HOUR = 19; // India time, exclusive
var WA_FOLLOW_UP_TRIGGER_HOUR = 11; // about 11:00 in the project's time zone
// Status prefixes. These three only block a lead for the rest of the day they were written:
var WA_FOLLOW_UP_DRY_RUN_PREFIX = "Dry run: ";
var WA_FOLLOW_UP_IN_PROGRESS_PREFIX = "In progress: ";
var WA_FOLLOW_UP_RETRY_PREFIX = "Live: will retry, ";
var WA_FOLLOW_UP_DAY_ONLY_PREFIXES = [WA_FOLLOW_UP_DRY_RUN_PREFIX, WA_FOLLOW_UP_IN_PROGRESS_PREFIX, WA_FOLLOW_UP_RETRY_PREFIX];
var WA_FOLLOW_UP_COUNT_PROPERTY = "WA_FOLLOW_UP_COUNT"; // "yyyy-MM-dd|n": endpoint calls made that day (India)
var WA_FOLLOW_UP_LAST_RUN_PROPERTY = "WA_FOLLOW_UP_LAST_RUN"; // counts-only summary of the last run
var WA_FOLLOW_UP_RUNNING_PROPERTY = "WA_FOLLOW_UP_RUNNING"; // "<runId>|<start ms>" while a run is in progress
var WA_FOLLOW_UP_RUN_MAX_MS = 10 * 60 * 1000; // a marker older than this is stale (Apps Script stops runs at 6 min)
// No new endpoint call starts after this much run time, so results are always written before Apps Script's 6-minute
// limit (each call takes at most about 20 seconds).
var WA_FOLLOW_UP_TIME_BUDGET_MS = 4 * 60 * 1000;
var WA_FOLLOW_UP_MESSAGE_SID_RE = /^(SM|MM)[0-9a-fA-F]{32}$/;
// Endpoint answers that mean "stop this run" (the problem is not specific to one lead).
var WA_FOLLOW_UP_STOP_ERRORS = { "disabled": 1, "misconfigured": 1, "unauthorized": 1, "live_not_available": 1, "redis_unavailable": 1, "internal_error": 1, "unsupported_media_type": 1 };

// A comma/space/semicolon-separated list of phone numbers -> { "+91...": true }. Invalid entries are counted.
function phoneListProperty_(raw) {
  var set = {}, count = 0, invalid = 0;
  String(raw || "").split(/[\s,;]+/).forEach(function (p) {
    if (!p) return;
    if (PHONE_RE.test(p)) { set[p] = true; count++; } else invalid++;
  });
  return { set: set, count: count, invalid: invalid };
}

// Reads and checks the Script Properties. Never returns or logs the secret or the endpoint in a summary.
// { ok: true, mode, endpoint, secret, startDate, cap, blocked, allowed } or { ok: false, mode, reason }.
function waFollowUpConfig_(props) {
  var rawMode = String(props.getProperty("WA_FOLLOW_UP_MODE") || "off").trim().toLowerCase();
  if (WA_FOLLOW_UP_MODES.indexOf(rawMode) === -1) return { ok: false, mode: "off", reason: "WA_FOLLOW_UP_MODE is not off, dry_run or live: treated as off" };
  if (rawMode === "off") return { ok: false, mode: "off", reason: "WA_FOLLOW_UP_MODE is off" };
  if (rawMode === "live" && String(props.getProperty(WA_FOLLOW_UP_LIVE_SWITCH_PROPERTY) || "").trim().toLowerCase() !== "true") {
    return { ok: false, mode: "live", reason: "live mode also needs the Script Property " + WA_FOLLOW_UP_LIVE_SWITCH_PROPERTY + "=true: nothing was sent" };
  }
  var endpoint = String(props.getProperty("WA_FOLLOW_UP_ENDPOINT") || "").trim();
  if (!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/api\/whatsapp\/follow-up$/.test(endpoint)) {
    return { ok: false, mode: rawMode, reason: "WA_FOLLOW_UP_ENDPOINT must be https://<site>/api/whatsapp/follow-up (no query string)" };
  }
  var secret = String(props.getProperty("WA_FOLLOW_UP_SECRET") || "").trim();
  if (secret.length < WA_FOLLOW_UP_MIN_SECRET_LENGTH) {
    return { ok: false, mode: rawMode, reason: "WA_FOLLOW_UP_SECRET is missing or shorter than " + WA_FOLLOW_UP_MIN_SECRET_LENGTH + " characters" };
  }
  var startDate = isoDateOrNull_(props.getProperty("WA_FOLLOW_UP_START_DATE"));
  if (!startDate) return { ok: false, mode: rawMode, reason: "WA_FOLLOW_UP_START_DATE must be set as yyyy-MM-dd" };
  var rawCap = String(props.getProperty("WA_FOLLOW_UP_DAILY_CAP") || "").trim();
  var cap = WA_FOLLOW_UP_DEFAULT_CAP;
  if (rawCap) {
    if (!/^\d{1,4}$/.test(rawCap) || +rawCap < 1) return { ok: false, mode: rawMode, reason: "WA_FOLLOW_UP_DAILY_CAP must be a whole number from 1 to " + WA_FOLLOW_UP_MAX_CAP };
    cap = Math.min(+rawCap, WA_FOLLOW_UP_MAX_CAP);
  }
  var blocked = phoneListProperty_(props.getProperty("WA_FOLLOW_UP_BLOCKED_PHONES"));
  var allowed = phoneListProperty_(props.getProperty("WA_FOLLOW_UP_ALLOWED_PHONES"));
  if (allowed.invalid) return { ok: false, mode: rawMode, reason: "WA_FOLLOW_UP_ALLOWED_PHONES has an entry that is not a +<country><number> phone number" };
  if (blocked.invalid) return { ok: false, mode: rawMode, reason: "WA_FOLLOW_UP_BLOCKED_PHONES has an entry that is not a +<country><number> phone number" };
  return { ok: true, mode: rawMode, endpoint: endpoint, secret: secret, startDate: startDate, cap: cap, blocked: blocked, allowed: allowed };
}

// Endpoint calls already made on `today` (India), from WA_FOLLOW_UP_COUNT.
function waFollowUpCountToday_(props, today) {
  var m = String(props.getProperty(WA_FOLLOW_UP_COUNT_PROPERTY) || "").match(/^(\d{4}-\d{2}-\d{2})\|(\d+)$/);
  return m && m[1] === today ? +m[2] : 0;
}

// Does a WA Follow-up Status value block the lead today? Empty: no. A same-day-only status ("Dry run: ",
// "In progress: ", "Live: will retry, "): only if written today (a readable date is required to block). Anything
// else (a live result, or text the team typed) means "already processed": blocks permanently.
function waFollowUpStatusBlocks_(statusText, today) {
  var s = String(statusText || "").trim();
  if (!s) return false;
  var dayOnly = WA_FOLLOW_UP_DAY_ONLY_PREFIXES.some(function (p) { return s.indexOf(p) === 0; });
  if (!dayOnly) return true;
  var m = s.match(/\((\d{4}-\d{2}-\d{2}) \d{2}:\d{2} IST\)$/);
  return !!m && m[1] >= today;
}

// Every lead eligible for a follow-up, sorted. Read-only. Returns { candidates, skipped, missing }.
function collectWaFollowUpCandidates_(sheet, cfg, today) {
  var skipped = {};
  function skip(why) { skipped[why] = (skipped[why] || 0) + 1; }
  var cols = readLeadHeaders_(sheet);
  var need = ["Lead ID", STATUS_HEADER, "Phone", "Source", "Received (IST)", "Check-in", NEXT_FOLLOW_UP_HEADER].concat(WA_FOLLOW_UP_HEADERS);
  var missing = need.filter(function (h) { return !cols.index[h]; });
  if (missing.length) return { candidates: [], skipped: skipped, missing: missing };
  var tz = sheet.getParent().getSpreadsheetTimeZone();
  var last = sheet.getLastRow();
  var rows = last >= 2 ? sheet.getRange(2, 1, last - 1, cols.names.length).getValues() : [];
  var seen = {}, candidates = [];
  rows.forEach(function (row, i) {
    var get = function (name) { return cols.index[name] ? row[cols.index[name] - 1] : ""; };
    var id = sheetText_(get("Lead ID")).trim();
    if (!/^L-[0-9A-F]{10}$/.test(id)) { skip("noLeadId"); return; }
    if (seen[id]) { skip("duplicateRow"); return; }
    seen[id] = true;
    if (canonicalStatus_(get(STATUS_HEADER)) !== "Contacted") { skip("notContacted"); return; }
    if (sheetText_(get("Source")).trim() !== WA_FOLLOW_UP_SOURCE || id === WA_FOLLOW_UP_DIAGNOSTIC_ID) { skip("testOrOtherSource"); return; }
    var received = followUpDateText_(get("Received (IST)"), tz);
    if (!received || received < cfg.startDate) { skip("beforeStartDate"); return; }
    var followUp = followUpDateText_(get(NEXT_FOLLOW_UP_HEADER), tz);
    if (!followUp || followUp > today) { skip("notDue"); return; }
    var checkIn = sheetDateText_(get("Check-in"), tz);
    if (!isoDateOrNull_(checkIn) || checkIn < today) { skip("checkInPassedOrMissing"); return; }
    if (sheetText_(get(WA_FOLLOW_UP_AUTO_HEADER)).trim().toLowerCase() === "no") { skip("autoFollowUpNo"); return; }
    var phone = sheetText_(get("Phone")).trim();
    if (!PHONE_RE.test(phone)) { skip("invalidPhone"); return; }
    if (cfg.blocked.set[phone]) { skip("blockedPhone"); return; }
    if (cfg.allowed.count && !cfg.allowed.set[phone]) { skip("notAllowedPhone"); return; }
    if (sheetText_(get(WA_FOLLOW_UP_MESSAGE_ID_HEADER)).trim() || waFollowUpStatusBlocks_(sheetText_(get(WA_FOLLOW_UP_STATUS_HEADER)), today)) {
      skip("alreadyProcessed"); return;
    }
    var scoreText = sheetText_(get(SCORE_HEADER)).trim();
    candidates.push({
      id: id, phone: phone, followUpDate: followUp, row: i + 2,
      priority: sheetText_(get(PRIORITY_HEADER)).trim(),
      score: scoreText !== "" && isFinite(Number(scoreText)) ? Number(scoreText) : null,
      overdue: false,
      // Guest-safe fields the website may put into the approved template (live mode only).
      guest: {
        destination: sheetText_(get("Destination")).trim(), property: sheetText_(get("Property")).trim(),
        checkIn: checkIn, checkOut: sheetDateText_(get("Check-out"), tz)
      }
    });
  });
  candidates.sort(compareDueFollowUps_);
  return { candidates: candidates, skipped: skipped, missing: [] };
}

// The request body for one lead. dry_run: exactly as in Phase A. live: plus the non-empty guest-safe fields.
function waFollowUpPayload_(mode, lead) {
  var body = { leadId: lead.id, phone: lead.phone, mode: mode === "live" ? "live" : "dry_run" };
  if (mode === "live") {
    ["destination", "property", "checkIn", "checkOut"].forEach(function (f) { if (lead.guest[f]) body[f] = lead.guest[f]; });
  }
  return body;
}

// Calls the website endpoint for one lead. Never throws; returns { result, messageSid? } or { error, stop }.
function callWaFollowUpEndpoint_(cfg, lead) {
  var res;
  try {
    res = UrlFetchApp.fetch(cfg.endpoint, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + cfg.secret },
      payload: JSON.stringify(waFollowUpPayload_(cfg.mode, lead)),
      muteHttpExceptions: true,
      followRedirects: false
    });
  } catch (err) {
    // In live mode the website may or may not have received it; its permanent claim makes a later retry safe.
    return { error: "network", stop: true };
  }
  var code = res.getResponseCode();
  var body = null;
  try { body = JSON.parse(res.getContentText()); } catch (e) { body = null; }
  var known = cfg.mode === "live" ? ["sent", "duplicate", "opted_out", "send_failed"] : ["would_send", "duplicate", "opted_out"];
  if (code === 200 && body && body.ok === true && body.leadId === lead.id && known.indexOf(body.result) !== -1 &&
      (cfg.mode !== "live" || body.mode === "live")) {
    if (body.result === "sent") {
      // A send without a valid Message SID is still a send: record it, but stop and let the team check Twilio.
      if (!WA_FOLLOW_UP_MESSAGE_SID_RE.test(String(body.messageSid || ""))) return { result: "sent", messageSid: "", stop: true, error: "no_message_sid" };
      return { result: "sent", messageSid: String(body.messageSid) };
    }
    if (body.result === "send_failed") {
      var reason = typeof body.reason === "string" && /^[a-z0-9_]{1,40}$/.test(body.reason) ? body.reason : "unknown";
      return { result: "send_failed", reason: reason, stop: body.systemic !== false, error: "send_failed_" + reason };
    }
    if (body.result === "duplicate" && body.reason === "phone_recently_contacted") return { result: "duplicate", reason: "phone" };
    return { result: body.result };
  }
  var error = body && typeof body.error === "string" && /^[a-z_]{1,40}$/.test(body.error) ? body.error : "http_" + code;
  return { error: error, stop: !!WA_FOLLOW_UP_STOP_ERRORS[error] || code === 401 || code === 404 || code >= 500 || (code >= 300 && code < 400) };
}

// The WA Follow-up Status text for an endpoint answer. Every text ends with the time.
function waFollowUpStatusText_(mode, outcome, now) {
  var when = " (" + Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm") + " IST)";
  if (mode !== "live") {
    var what = outcome.result === "would_send" ? "would send"
      : outcome.result === "duplicate" ? "already checked in the last 24 hours"
      : outcome.result === "opted_out" ? "guest opted out, would not send"
      : "check failed (" + outcome.error + ")";
    return WA_FOLLOW_UP_DRY_RUN_PREFIX + what + when;
  }
  if (outcome.result === "sent") return "Live: sent" + when;
  if (outcome.result === "duplicate" && outcome.reason === "phone") return "Live: not sent, this guest already got an automatic follow-up recently" + when;
  if (outcome.result === "duplicate") return "Live: not sent, already claimed earlier" + when;
  if (outcome.result === "opted_out") return "Live: not sent, guest opted out" + when;
  if (outcome.result === "send_failed") return "Live: send failed (" + outcome.reason + "), not retried" + when;
  // Rejected before the website claimed the lead (or no answer): safe to try again on a later day.
  return WA_FOLLOW_UP_RETRY_PREFIX + "not sent (" + outcome.error + ")" + when;
}

/**
 * Daily trigger handler (installed by setupWhatsAppFollowUps; can also be run by hand from the editor).
 * dry_run: asks the website whether each eligible lead could get a follow-up. live (only with
 * WA_FOLLOW_UP_LIVE_ENABLED=true): the website sends one approved template per lead. Records the result in the
 * WA Follow-up columns only; never changes Status or any other column, never emails. Logs and returns counts only.
 */
function sendWhatsAppFollowUps() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var today = istDateText_(now);
  var summary = { version: BOT_CODE_VERSION, today: today, mode: "off", checked: 0 };
  var runId = "";
  function finish(reason) {
    if (reason) summary.reason = reason;
    var text = "WA FOLLOW-UP | " + JSON.stringify(summary);
    console.log(text);
    Logger.log(text);
    try { props.setProperty(WA_FOLLOW_UP_LAST_RUN_PROPERTY, JSON.stringify(summary).slice(0, 4000)); } catch (e) { /* diagnostics only */ }
    return summary;
  }

  var cfg = waFollowUpConfig_(props);
  summary.mode = cfg.mode;
  if (!cfg.ok) return finish(cfg.reason);
  var hour = +Utilities.formatDate(now, "Asia/Kolkata", "HH");
  if (hour < WA_FOLLOW_UP_WINDOW_START_HOUR || hour >= WA_FOLLOW_UP_WINDOW_END_HOUR) {
    return finish("outside the 10:00-19:00 India time window");
  }

  // 1. Under the lock: claim the run, select, mark each picked lead "In progress", and reserve the daily cap.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return finish("busy: another request holds the script lock");
  var picked = [], usedBefore = 0;
  try {
    var running = String(props.getProperty(WA_FOLLOW_UP_RUNNING_PROPERTY) || "").match(/^([A-Za-z0-9]+)\|(\d+)$/);
    if (running && now.getTime() - +running[2] < WA_FOLLOW_UP_RUN_MAX_MS) return finish("another follow-up run is in progress");
    usedBefore = waFollowUpCountToday_(props, today);
    summary.cap = cfg.cap;
    summary.usedBefore = usedBefore;
    if (usedBefore >= cfg.cap) return finish("daily cap reached");
    var ss = openLeadsSpreadsheet_(props, null);
    var sheet = ss.getSheetByName(QUALIFIED_SHEET);
    if (!sheet) return finish("missing tab " + QUALIFIED_SHEET);
    var found = collectWaFollowUpCandidates_(sheet, cfg, today);
    if (found.missing.length) return finish("missing columns (run setupLeadStatusTracking and setupWhatsAppFollowUps): " + found.missing.join(", "));
    summary.skipped = found.skipped;
    summary.eligible = found.candidates.length;
    var phones = {};
    found.candidates.forEach(function (c) {
      if (phones[c.phone]) { summary.skipped.samePhoneThisRun = (summary.skipped.samePhoneThisRun || 0) + 1; return; }
      phones[c.phone] = true;
      picked.push(c);
    });
    if (picked.length > cfg.cap - usedBefore) {
      summary.overCap = picked.length - (cfg.cap - usedBefore);
      picked = picked.slice(0, cfg.cap - usedBefore);
    }
    if (picked.length) {
      runId = Utilities.formatDate(now, "Asia/Kolkata", "HHmmss") + String(Math.floor(Math.random() * 1e6));
      props.setProperty(WA_FOLLOW_UP_RUNNING_PROPERTY, runId + "|" + now.getTime());
      props.setProperty(WA_FOLLOW_UP_COUNT_PROPERTY, today + "|" + (usedBefore + picked.length));
      var statusCol = readLeadHeaders_(sheet).index[WA_FOLLOW_UP_STATUS_HEADER];
      var marker = cell_(WA_FOLLOW_UP_IN_PROGRESS_PREFIX + cfg.mode + " run" +
        " (" + Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm") + " IST)");
      picked.forEach(function (c) { sheet.getRange(c.row, statusCol).setValue(marker); });
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }
  if (!picked.length) return finish("no eligible lead");

  var outcomes = [];
  try {
    // 2. Outside the lock: call the website for each lead. A run-wide problem stops the run.
    summary.results = {};
    for (var i = 0; i < picked.length; i++) {
      if (i > 0 && new Date().getTime() - now.getTime() > WA_FOLLOW_UP_TIME_BUDGET_MS) { summary.stopped = "time_budget"; break; }
      var outcome = callWaFollowUpEndpoint_(cfg, picked[i]);
      outcome.id = picked[i].id;
      outcomes.push(outcome);
      var key = outcome.result || ("error_" + outcome.error);
      summary.results[key] = (summary.results[key] || 0) + 1;
      if (outcome.stop) { summary.stopped = outcome.error; break; }
    }
    summary.checked = outcomes.length;

    // 3. Under the lock again: give back unused cap; write each result (and clear the markers of leads not called).
    var written = 0, rowsGone = 0;
    if (!lock.tryLock(30000)) return finish("results not written: another request held the script lock");
    try {
      var unused = picked.length - outcomes.length;
      if (unused > 0) {
        var nowUsed = waFollowUpCountToday_(props, today);
        props.setProperty(WA_FOLLOW_UP_COUNT_PROPERTY, today + "|" + Math.max(nowUsed - unused, 0));
      }
      var ss2 = openLeadsSpreadsheet_(props, null);
      var sheet2 = ss2.getSheetByName(QUALIFIED_SHEET);
      var cols = sheet2 ? readLeadHeaders_(sheet2) : { index: {} };
      var statusCol2 = cols.index[WA_FOLLOW_UP_STATUS_HEADER];
      var sentCol = cols.index[WA_FOLLOW_UP_SENT_HEADER], sidCol = cols.index[WA_FOLLOW_UP_MESSAGE_ID_HEADER];
      var writeTime = new Date();
      outcomes.forEach(function (o) {
        var row = sheet2 && statusCol2 ? findRowById_(sheet2, o.id) : 0;
        if (!row) { rowsGone++; return; }
        sheet2.getRange(row, statusCol2).setValue(cell_(waFollowUpStatusText_(cfg.mode, o, writeTime)));
        if (cfg.mode === "live" && o.result === "sent") {
          if (sentCol) sheet2.getRange(row, sentCol).setValue(cell_(istText_(writeTime)));
          if (sidCol && o.messageSid) sheet2.getRange(row, sidCol).setValue(cell_(o.messageSid));
        }
        written++;
      });
      // Leads picked but not called (the run stopped early): remove our marker so a later run can pick them.
      picked.slice(outcomes.length).forEach(function (c) {
        var row = sheet2 && statusCol2 ? findRowById_(sheet2, c.id) : 0;
        if (row && String(sheet2.getRange(row, statusCol2).getValue()).indexOf(WA_FOLLOW_UP_IN_PROGRESS_PREFIX) === 0) {
          sheet2.getRange(row, statusCol2).setValue("");
        }
      });
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
    summary.written = written;
    if (rowsGone) summary.rowsNotFound = rowsGone;
    return finish(summary.stopped ? "stopped: " + summary.stopped : "");
  } finally {
    // Release the run marker only if it is still ours.
    try {
      if (String(props.getProperty(WA_FOLLOW_UP_RUNNING_PROPERTY) || "").indexOf(runId + "|") === 0) {
        props.deleteProperty(WA_FOLLOW_UP_RUNNING_PROPERTY);
      }
    } catch (e) { /* a stale marker expires after 10 minutes */ }
  }
}

/**
 * Run ONCE from the Apps Script editor (safe to run again). It:
 *   - adds the columns "Auto Follow-up", "WA Follow-up Status", "WA Follow-up Sent (IST)" and "WA Message ID" to
 *     "Qualified Leads" if they are missing (existing columns are not moved; Handoffs is not changed),
 *   - puts a Yes/No dropdown on "Auto Follow-up" (empty means Yes; "No" excludes that lead),
 *   - installs the daily sendWhatsAppFollowUps trigger at about 11:00 in the project's time zone, once.
 * It does NOT switch anything on: WA_FOLLOW_UP_MODE and WA_FOLLOW_UP_LIVE_ENABLED stay as they are.
 * Logs and returns a summary with yes/no values only (never the secret or the endpoint).
 */
function setupWhatsAppFollowUps() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Another request holds the script lock; run this again in a minute.");
  var summary = { version: BOT_CODE_VERSION };
  try {
    var ss = openLeadsSpreadsheet_(props, null);
    var sheet = ss.getSheetByName(QUALIFIED_SHEET) || ss.insertSheet(QUALIFIED_SHEET);
    var before = readLeadHeaders_(sheet).names.length;
    ensureLeadHeaders_(sheet, QUALIFIED_HEADERS);
    var cols = ensureLeadHeaders_(sheet, WA_FOLLOW_UP_HEADERS);
    summary.columnsAdded = cols.names.length - before;
    if (sheet.getMaxRows() > 1) {
      var rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["Yes", "No"], true)
        .setAllowInvalid(false)
        .setHelpText("No = never send this lead an automatic WhatsApp follow-up. Empty or Yes = allowed.")
        .build();
      sheet.getRange(2, cols.index[WA_FOLLOW_UP_AUTO_HEADER], sheet.getMaxRows() - 1, 1).setDataValidation(rule);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === WA_FOLLOW_UP_HANDLER; });
  for (var i = 1; i < existing.length; i++) ScriptApp.deleteTrigger(existing[i]);
  var projectTz = Session.getScriptTimeZone();
  if (!existing.length) {
    var builder = ScriptApp.newTrigger(WA_FOLLOW_UP_HANDLER).timeBased().atHour(WA_FOLLOW_UP_TRIGGER_HOUR).nearMinute(0).everyDays(1);
    if (!projectTz) builder = builder.inTimezone(FOLLOW_UP_FALLBACK_TZ);
    builder.create();
  }
  var cfg = waFollowUpConfig_(props);
  var tz = projectTz || FOLLOW_UP_FALLBACK_TZ;
  summary.trigger = existing.length ? "already installed" : "installed";
  summary.duplicatesRemoved = Math.max(existing.length - 1, 0);
  summary.runsAt = "daily, about 11:00 (" + tz + ")";
  if (tz !== FOLLOW_UP_FALLBACK_TZ) summary.note = "The project time zone is " + tz + ". Runs only do anything between 10:00 and 19:00 India time, so set the project time zone to Asia/Kolkata.";
  summary.mode = cfg.mode;
  summary.ready = cfg.ok;
  if (!cfg.ok) summary.notReady = cfg.reason;
  summary.props = {
    WA_FOLLOW_UP_ENDPOINT: !!props.getProperty("WA_FOLLOW_UP_ENDPOINT"),
    WA_FOLLOW_UP_SECRET: !!props.getProperty("WA_FOLLOW_UP_SECRET"),
    WA_FOLLOW_UP_START_DATE: !!props.getProperty("WA_FOLLOW_UP_START_DATE"),
    WA_FOLLOW_UP_LIVE_ENABLED: String(props.getProperty(WA_FOLLOW_UP_LIVE_SWITCH_PROPERTY) || "").trim().toLowerCase() === "true"
  };
  var text = "WA FOLLOW-UP SETUP | " + JSON.stringify(summary);
  console.log(text);
  Logger.log(text);
  return summary;
}

// ---------- Leads Sheet connection (standalone script: open by ID, never getActiveSpreadsheet) ----------

function configError_(code, message) {
  var e = new Error(message);
  e.name = "ConfigError";
  e.diagCode = code;
  return e;
}

// Reads LEADS_SHEET_ID. Accepts the bare ID or a pasted full Sheet URL. Throws a clear ConfigError otherwise.
function leadsSheetId_(props) {
  var raw = String(props.getProperty("LEADS_SHEET_ID") || "").trim();
  if (!raw) throw configError_("LEADS_SHEET_ID_MISSING", "Script Property LEADS_SHEET_ID is not set. Add the leads Sheet ID in Project Settings > Script Properties.");
  var fromUrl = raw.match(/\/d\/([A-Za-z0-9_-]+)/);
  var id = fromUrl ? fromUrl[1] : raw;
  if (!/^[A-Za-z0-9_-]{25,100}$/.test(id)) throw configError_("LEADS_SHEET_ID_INVALID", "Script Property LEADS_SHEET_ID does not look like a Google Sheet ID. Paste only the part of the Sheet URL between /d/ and /edit.");
  return id;
}

// Opens the leads Sheet by ID. trace (optional) records the step for diagnostics.
function openLeadsSpreadsheet_(props, trace) {
  if (trace) trace.stage = "config";
  var id = leadsSheetId_(props);
  if (trace) trace.stage = "open_spreadsheet";
  var ss;
  try {
    ss = SpreadsheetApp.openById(id);
  } catch (err) {
    var e = configError_("LEADS_SHEET_OPEN_FAILED", "Could not open the Sheet in LEADS_SHEET_ID (check the ID, and that the script owner can edit that Sheet): " + safeErrMsg_(err, props));
    e.name = safeErrName_(err);
    throw e;
  }
  if (!ss) throw configError_("LEADS_SHEET_OPEN_FAILED", "SpreadsheetApp.openById returned nothing for LEADS_SHEET_ID");
  return ss;
}

// Row number of an existing Lead/Handoff ID (column B), or 0.
function findRowById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

// ---------- Safe diagnostics (temporary; harmless to keep) ----------

function safeErrName_(err) {
  var n = err && err.name ? String(err.name) : "Error";
  return /^[A-Za-z]{1,40}$/.test(n) ? n : "Error";
}

// Error message with anything sensitive removed: secrets, emails, URLs, long IDs, phone numbers / digit runs.
function safeErrMsg_(err, props) {
  var m = String(err && err.message ? err.message : err);
  ["QUALIFIED_LEAD_SINK_SECRET", "LEAD_SINK_SECRET", "DIAG_KEY", "TEAM_EMAILS", "LEADS_SHEET_ID", "WA_FOLLOW_UP_SECRET", "WA_FOLLOW_UP_ENDPOINT",
    "GUEST_MESSAGES_SINK_SECRET", "GUEST_MESSAGES_API_SECRET", "GUEST_MESSAGES_ENDPOINT"].forEach(function (k) {
    var v = props && props.getProperty(k);
    if (v) v.split(",").forEach(function (part) { part = part.trim(); if (part.length >= 4) m = m.split(part).join("[redacted]"); });
  });
  return m
    .replace(/[^\s@]+@[^\s@]+/g, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[A-Za-z0-9_-]{25,}/g, "[id]")
    .replace(/\+?\d[\d\s-]{3,}\d/g, "[num]")
    .replace(/[\u0000-\u001F]/g, " ")
    .slice(0, 200);
}

// "Code:123" style location of the throwing line (file name and line number only).
function errWhere_(err) {
  var s = err && err.stack ? String(err.stack) : "";
  var m = s.match(/\(?([A-Za-z0-9_ .-]{1,40}):(\d{1,5}):\d{1,5}\)?/);
  return m ? m[1] + ":" + m[2] : "";
}

// Keeps the outcome of the most recent real bot-lead request (no PII: Lead/Handoff ID is an opaque hash).
function rememberBotResult_(body, result, props) {
  try {
    var item = body && (body.type === "qualified_lead" ? body.lead : body.handoff);
    var id = item && typeof item === "object" ? String(item.leadId || item.handoffId || "") : "";
    var copy = {};
    Object.keys(result).forEach(function (k) { copy[k] = result[k]; });
    copy.type = String(body && body.type || "");
    copy.id = /^[LH]-[0-9A-F]{10}$/.test(id) ? id : "";
    copy.at = new Date().toISOString();
    props.setProperty("LAST_BOT_LEAD_RESULT", JSON.stringify(copy));
  } catch (e) {
    console.error("rememberBotResult_ failed: " + e);
  }
}

// What /exec?diag=<DIAG_KEY> returns (and what diagnoseBotLead() logs in the editor).
function botLeadDiagnostics_() {
  var props = PropertiesService.getScriptProperties();
  var out = { version: BOT_CODE_VERSION, generatedAt: new Date().toISOString() };
  out.props = {
    QUALIFIED_LEAD_SINK_SECRET: !!props.getProperty("QUALIFIED_LEAD_SINK_SECRET"),
    LEAD_SINK_SECRET: !!props.getProperty("LEAD_SINK_SECRET"),
    TEAM_EMAILS: !!props.getProperty("TEAM_EMAILS"),
    LEADS_SHEET_ID: !!props.getProperty("LEADS_SHEET_ID"),
    secretsDiffer: props.getProperty("QUALIFIED_LEAD_SINK_SECRET") !== props.getProperty("LEAD_SINK_SECRET")
  };
  try { out.lastResult = JSON.parse(props.getProperty("LAST_BOT_LEAD_RESULT") || "null"); } catch (e) { out.lastResult = "unreadable"; }
  // Sheet probe (read-only), using the same explicit connection as real leads.
  try {
    out.sheet = { connection: "openById(LEADS_SHEET_ID)", opened: false };
    var ss = openLeadsSpreadsheet_(props, null);
    out.sheet.opened = true;
    if (ss) {
      var wanted = [SHEET_NAME, QUALIFIED_SHEET, HANDOFF_SHEET];
      var norm = function (s) { return String(s).toLowerCase().replace(/\s+/g, ""); };
      var tabs = ss.getSheets().map(function (s) { return s.getName(); });
      out.sheet.tabCount = tabs.length;
      out.sheet.tabs = {};
      wanted.forEach(function (w) {
        var t = ss.getSheetByName(w);
        out.sheet.tabs[w] = t ? {
          exists: true, lastRow: t.getLastRow(), lastColumn: t.getLastColumn(), maxRows: t.getMaxRows(),
          colB: t.getLastRow() > 0 ? String(t.getRange(1, 2).getValue()).slice(0, 30) : ""
        } : { exists: false, nearMatches: tabs.filter(function (n) { return n !== w && norm(n) === norm(w); }) };
      });
    }
  } catch (err) {
    out.sheet = { connection: "openById(LEADS_SHEET_ID)", opened: false, code: (err && err.diagCode) || "EXCEPTION",
      error: safeErrName_(err) + ": " + safeErrMsg_(err, props), where: errWhere_(err) };
  }
  // Dry run of the exact write path with a synthetic lead: appends then deletes one test row, sends no email.
  var probe = {
    secret: props.getProperty("QUALIFIED_LEAD_SINK_SECRET"), type: "qualified_lead",
    lead: { leadId: "L-0000000000", timestamp: out.generatedAt, phone: "+910000000000", destination: "Diagnostic", property: null,
      checkIn: "2030-01-01", checkOut: "2030-01-02", nights: 1, guests: 1, requirements: "", ref: "DIRECT",
      source: "diagnostic", conversationState: "HANDED_OFF", qualificationStatus: "QUALIFIED", site: "diagnostic",
      receivedAt: out.generatedAt, handoffNumber: "", notes: [] }
  };
  try {
    out.dryRun = JSON.parse(handleBotLead_(probe, props, { dryRun: true }).getContent());
  } catch (err) {
    out.dryRun = { error: safeErrName_(err) + ": " + safeErrMsg_(err, props) };
  }
  return out;
}

/**
 * Run from the Apps Script editor: select "diagnoseBotLead" in the function dropdown, click Run.
 * Writes the report three ways, so it is visible even if one channel shows nothing:
 *   1. console.log  2. Logger.log  (both appear in the editor's Execution log panel)
 *   3. Script Property LAST_DIAG_REPORT (Project Settings -> Script Properties)
 * The report holds only: version, generatedAt, props (true/false only), sheet, lastResult, dryRun.
 * No secrets, DIAG_KEY, phone numbers, email addresses or guest text.
 */
function diagnoseBotLead() {
  var LABEL = "BOT LEAD DIAGNOSTIC REPORT";
  console.log(LABEL + " | start | " + BOT_CODE_VERSION);
  Logger.log(LABEL + " | start | " + BOT_CODE_VERSION);
  var props = PropertiesService.getScriptProperties();
  var report;
  try {
    report = botLeadDiagnostics_();
  } catch (err) {
    report = { version: BOT_CODE_VERSION, reportError: safeErrName_(err) + ": " + safeErrMsg_(err, props), where: errWhere_(err) };
  }
  var text = JSON.stringify(report);
  console.log(LABEL + " | " + text);
  Logger.log(LABEL + " | " + text);
  try {
    props.setProperty("LAST_DIAG_REPORT", text.slice(0, 8000));
    console.log(LABEL + " | also saved to Script Property LAST_DIAG_REPORT");
    Logger.log(LABEL + " | also saved to Script Property LAST_DIAG_REPORT");
  } catch (e) {
    console.log(LABEL + " | could not save LAST_DIAG_REPORT: " + safeErrName_(e));
  }
  console.log(LABEL + " | end");
  Logger.log(LABEL + " | end");
  return report;
}

function sendBotLeadEmail_(item, qualified, props, sheetUrl) {
  try {
    var check = teamMailCheck_(props);
    if (!check.send) return false;
    var to = check.to;
    var stay = item.property ? item.property + ", " + item.destination : (item.destination || "not given");
    var lines = qualified
      ? ["Qualified WhatsApp Lead",
         "",
         "The guest confirmed these details with the WhatsApp assistant. This is NOT a booking: availability and price have not been checked.",
         "",
         "Guest WhatsApp: " + item.phone,
         "Stay: " + stay,
         "Check-in: " + item.checkIn,
         "Check-out: " + item.checkOut + " (" + item.nights + (item.nights === 1 ? " night)" : " nights)"),
         "Guests: " + item.guests,
         "Requirements: " + (item.requirements || "None")]
      : ["WhatsApp guest handed to the team (NOT a qualified lead)",
         "",
         "Reason: " + (item.reason === "HUMAN_REQUESTED" ? "the guest asked for a team member" : "the assistant could not complete the details"),
         "",
         "Guest WhatsApp: " + item.phone,
         "Stay: " + stay,
         "Check-in: " + (item.checkIn || "not given"),
         "Check-out: " + (item.checkOut || "not given"),
         "Guests: " + (item.guests === null ? "not given" : item.guests),
         "Requirements: " + (item.requirements || "None")];
    if (qualified && notesText_(item.notes)) lines.push("Notes: " + notesText_(item.notes));
    lines.push(
      "Source: " + item.source + " (ref " + item.ref + ")",
      (qualified ? "Lead ID: " : "Handoff ID: ") + (qualified ? item.leadId : item.handoffId),
      (qualified ? "Confirmed at: " : "Handed off at: ") + item.timestamp,
      "",
      "The guest was told the team will continue with them on WhatsApp at " + item.handoffNumber + ".",
      "Sheet: " + sheetUrl);
    MailApp.sendEmail({
      to: to.join(","),
      subject: qualified ? "New Qualified WhatsApp Lead" : "WhatsApp guest needs a team member",
      body: lines.join("\n"),
    });
    return true;
  } catch (err) {
    return false;
  }
}

// ===================== Week 7: Guest Messages (team queue) and Guest Escalations =====================
//
// The website (lib/guest-messages) reads bookings from the Intellistay TEST server and posts, with its own secret:
//   type "guest_message"    -> "Guest Messages" tab: one row per Message ID (pre-arrival / check-in / checkout).
//                              The team reviews READY rows, sends the message themselves, and sets Status to SENT.
//                              NOTHING here contacts a guest.
//   type "guest_escalation" -> "Guest Escalations" tab + "Guest needs a team member" email.
// Both are idempotent: a known ID never creates a second row or email. A known message may only move forward
// automatically (QUEUED -> READY/SKIPPED/FAILED, READY -> SKIPPED, FAILED -> READY/SKIPPED); SENT and SKIPPED rows
// are never changed by the script.
// Every message carries a Send By date (the last day it may still be sent). Missed messages are never sent late:
// the digest lists a message only from its Scheduled Date to its Send By date, and each queue run marks QUEUED, READY
// or FAILED messages past their Send By date as SKIPPED (Reason "expired"). SENT rows are never touched.
//
// runGuestMessages (daily trigger, installed by setupGuestMessages) calls the website's /api/guest-messages/run,
// then emails one digest of messages that are due. OFF unless GUEST_MESSAGES_MODE is "dry_run" or "queue".
//
// Script Properties:
//   GUEST_MESSAGES_SINK_SECRET - same value as GUEST_MESSAGES_SINK_SECRET in Vercel (website -> this script)
//   GUEST_MESSAGES_MODE        - off (default) | dry_run (website plans only, nothing stored) | queue
//   GUEST_MESSAGES_ENDPOINT    - https://<site>/api/guest-messages/run
//   GUEST_MESSAGES_API_SECRET  - same value as GUEST_MESSAGES_API_SECRET in Vercel (this script -> website), 32+ chars

var GUEST_MESSAGES_SHEET = "Guest Messages";
var GUEST_MESSAGE_HEADERS = ["Created (IST)", "Message ID", "Status", "Type", "Scheduled Date", "Send By", "Booking ID", "Booking Code",
  "Check-in", "Check-out", "Nights", "Guests", "Property", "Guest", "Guest WhatsApp", "Special Request", "Booking Source",
  "Reason", "Message", "Status Updated (IST)"];
var GUEST_MESSAGE_STATUSES = ["QUEUED", "READY", "SENT", "SKIPPED", "FAILED"];
var GUEST_MESSAGE_TYPES = ["PRE_ARRIVAL", "CHECK_IN", "CHECKOUT"];
var GUEST_MESSAGE_TRANSITIONS = { "QUEUED": ["READY", "SKIPPED", "FAILED"], "READY": ["SKIPPED"], "FAILED": ["READY", "SKIPPED"] };
var GUEST_MESSAGE_TYPE_LABELS = { "PRE_ARRIVAL": "Pre-arrival", "CHECK_IN": "Check-in", "CHECKOUT": "Checkout" };

var GUEST_ESCALATIONS_SHEET = "Guest Escalations";
var GUEST_ESCALATION_HEADERS = ["Received (IST)", "Escalation ID", "Status", "Reason", "Question", "Guest WhatsApp", "Booking Code",
  "Topic", "Channel", "Received (UTC)", "Email Status", "Status Updated (IST)"];
var GUEST_ESCALATION_STATUSES = ["Open", "In progress", "Resolved"];
var GUEST_ESCALATION_REASONS = ["HUMAN_REQUESTED", "BOOKING_CHANGE", "CANCELLATION", "PAYMENT", "URGENT_ISSUE", "MISSING_INFORMATION", "UNSUPPORTED_QUESTION"];
var GUEST_ESCALATION_REASON_LABELS = {
  "HUMAN_REQUESTED": "the guest asked for a team member",
  "BOOKING_CHANGE": "a booking change (dates, guests, early check-in / late checkout...)",
  "CANCELLATION": "a cancellation",
  "PAYMENT": "a payment, refund or price question",
  "URGENT_ISSUE": "an urgent problem or complaint",
  "MISSING_INFORMATION": "a question the assistant has no configured answer for at this stay",
  "UNSUPPORTED_QUESTION": "a question the assistant does not cover"
};

var GUEST_MESSAGES_HANDLER = "runGuestMessages";
var GUEST_MESSAGES_TRIGGER_HOUR = 9; // about 09:00 in the project's time zone
var GUEST_MESSAGES_MIN_SECRET_LENGTH = 32;
var LAST_GUEST_DIGEST_PROPERTY = "LAST_GUEST_MESSAGE_DIGEST"; // date (India) of the last digest sent
var GUEST_MESSAGE_ID_RE = /^GM-[0-9A-F]{12}$/;
var GUEST_ESCALATION_ID_RE = /^E-[0-9A-F]{10}$/;

// Like cell_ (formula-safe), with a configurable length: message text can be longer than 300 characters.
function longCell_(v, max) {
  var s = v === undefined || v === null ? "" : String(v).slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function optStr_(v, max) {
  return v === null || v === undefined || (typeof v === "string" && v.length <= max);
}

// Each returns the NAME of the first invalid field (never its value), or "".
function guestMessageProblem_(m) {
  if (!m || typeof m !== "object") return "message";
  if (!GUEST_MESSAGE_ID_RE.test(String(m.messageId))) return "messageId";
  if (GUEST_MESSAGE_TYPES.indexOf(m.type) === -1) return "type";
  if (["QUEUED", "READY", "SKIPPED", "FAILED"].indexOf(m.status) === -1) return "status";
  if (!ISO_DATE.test(String(m.scheduledDate))) return "scheduledDate";
  if (!ISO_DATE.test(String(m.sendBy)) || String(m.sendBy) < String(m.scheduledDate)) return "sendBy";
  if (!/^\d{1,9}$/.test(String(m.bookingId))) return "bookingId";
  if (!ISO_DATE.test(String(m.checkIn)) || !ISO_DATE.test(String(m.checkOut))) return "dates";
  if (typeof m.nights !== "number" || m.nights % 1 !== 0 || m.nights < 0 || m.nights > 365) return "nights";
  if (m.guestPhone !== null && !PHONE_RE.test(String(m.guestPhone))) return "guestPhone";
  if (m.specialRequest !== "yes" && m.specialRequest !== "no") return "specialRequest";
  if (typeof m.message !== "string" || !m.message || m.message.length > 1500) return "message";
  if (!optStr_(m.reason, 40) || !optStr_(m.bookingCode, 40) || !optStr_(m.guests, 60) || !optStr_(m.property, 100) ||
      !optStr_(m.guestName, 40) || !optStr_(m.bookingSource, 60)) return "text";
  return "";
}

function guestEscalationProblem_(x) {
  if (!x || typeof x !== "object") return "escalation";
  if (!GUEST_ESCALATION_ID_RE.test(String(x.escalationId))) return "escalationId";
  if (GUEST_ESCALATION_REASONS.indexOf(x.reason) === -1) return "reason";
  if (typeof x.question !== "string" || !x.question || x.question.length > 500) return "question";
  if (x.guestPhone !== null && !PHONE_RE.test(String(x.guestPhone))) return "guestPhone";
  if (!optStr_(x.bookingCode, 40) || !optStr_(x.intent, 40) || !optStr_(x.channel, 20)) return "text";
  return "";
}

// The optional verified-booking block of a WhatsApp escalation (website: escalationLeadFor). "" when valid.
// Checked separately: a bad block only skips the Lead, it never stops the escalation from being stored.
function escalationLeadProblem_(l) {
  if (!l || typeof l !== "object") return "lead";
  if (!optStr_(l.guestName, 40) || !optStr_(l.property, 100) || !optStr_(l.destination, 60)) return "text";
  if (!ISO_DATE.test(String(l.checkIn)) || !ISO_DATE.test(String(l.checkOut))) return "dates";
  if (typeof l.nights !== "number" || l.nights % 1 !== 0 || l.nights < 0 || l.nights > 365) return "nights";
  if (l.guests !== null && (typeof l.guests !== "number" || l.guests % 1 !== 0 || l.guests < 0 || l.guests > 50)) return "guests";
  return "";
}

// ---------- Guest Escalation -> Lead ("Handoffs" tab) ----------
//
// A WhatsApp escalation for a VERIFIED booking (the website sends escalation.lead) also creates or updates the guest's
// Lead, so the request shows on the Hospitality OS Leads page. Handoffs, not Qualified Leads: it is a conversation
// handed to the team, and automatic WhatsApp follow-ups never run on Handoffs.
//   - Existing OPEN lead (Status New, Contacted or empty) on Handoffs with the same Phone AND Booking Code: that row is
//     updated (the new message is added to Requirements; empty Guest Name / Property / dates are filled). Its Status,
//     Score, Priority and follow-up dates are the team's and are left alone.
//   - Otherwise a new row, Handoff ID "H-" + the escalation's 10 hex digits (so a retried escalation never adds a
//     second row), Status New, Reason = the escalation reason, Source "guest-escalation", scored like any lead.
// Booking values come only from the verified booking; nothing is guessed from the message.
var ESCALATION_LEAD_SOURCE = "guest-escalation";
var ESCALATION_LEAD_HISTORY_MAX = 1500; // Requirements keeps the newest messages up to this length

function escalationLeadId_(escalationId) {
  return "H-" + String(escalationId).slice(2);
}

// Returns { outcome: "created"|"updated"|"duplicate"|"skipped", sheet, cols, row }.
function upsertEscalationLead_(ss, x, now, trace) {
  var l = x.lead;
  if (x.channel !== "whatsapp" || !x.guestPhone || !x.bookingCode || escalationLeadProblem_(l)) return { outcome: "skipped" };
  var tab = guestTab_(ss, HANDOFF_SHEET, HANDOFF_HEADERS, trace);
  var sheet = tab.sheet, cols = tab.cols;
  trace.stage = "lead_find";
  var id = escalationLeadId_(x.escalationId);
  var own = findRowById_(sheet, id);
  if (own > 0) return { outcome: "duplicate", sheet: sheet, cols: cols, row: own };

  var istNow = istText_(now);
  // Each message carries its escalation ID: the link to the Guest Escalations row, and what makes an update idempotent.
  var dated = "[" + istNow + " " + x.escalationId + "] " + x.question;
  var last = sheet.getLastRow();
  if (last >= 2) {
    var rows = sheet.getRange(2, 1, last - 1, cols.names.length).getValues();
    var get = function (r, name) { return cols.index[name] ? r[cols.index[name] - 1] : ""; };
    var code = String(x.bookingCode).trim().toLowerCase();
    for (var i = rows.length - 1; i >= 0; i--) { // newest first
      var r = rows[i];
      if (sheetText_(get(r, "Phone")).trim() !== x.guestPhone) continue;
      if (sheetText_(get(r, "Booking Code")).trim().toLowerCase() !== code) continue;
      var statusText = sheetText_(get(r, STATUS_HEADER)).trim();
      if (statusText && OPEN_LEAD_STATUSES.indexOf(canonicalStatus_(statusText)) === -1) continue;
      trace.stage = "lead_update";
      var rowIndex = i + 2;
      var before = String(get(r, "Requirements") === undefined || get(r, "Requirements") === null ? "" : get(r, "Requirements")).replace(/^'/, "").trim();
      if (before.indexOf(x.escalationId) !== -1) return { outcome: "duplicate", sheet: sheet, cols: cols, row: rowIndex };
      var history = before ? before + "\n" + dated : dated;
      if (history.length > ESCALATION_LEAD_HISTORY_MAX) history = history.slice(history.length - ESCALATION_LEAD_HISTORY_MAX);
      sheet.getRange(rowIndex, cols.index["Requirements"]).setValue(longCell_(history, ESCALATION_LEAD_HISTORY_MAX));
      var fill = { "Guest Name": l.guestName, "Property": l.property, "Destination": l.destination,
        "Check-in": l.checkIn, "Check-out": l.checkOut, "Nights": l.nights, "Guests": l.guests };
      Object.keys(fill).forEach(function (name) {
        if (!cols.index[name] || fill[name] === null || fill[name] === undefined || fill[name] === "") return;
        if (sheetText_(get(r, name)).trim() !== "") return; // never overwrite what is there
        sheet.getRange(rowIndex, cols.index[name]).setValue(cell_(fill[name]));
      });
      return { outcome: "updated", sheet: sheet, cols: cols, row: rowIndex };
    }
  }

  trace.stage = "lead_create";
  var scored = scoreLead_({ qualified: false, reason: x.reason, checkIn: l.checkIn, checkOut: l.checkOut,
    nights: l.nights, property: l.property, ref: "" }, istDateText_(now));
  var byName = {
    "Received (IST)": istNow, "Handoff ID": id, "Status": DEFAULT_LEAD_STATUS, "Reason": x.reason, "Phone": x.guestPhone,
    "Destination": l.destination, "Property": l.property, "Check-in": l.checkIn, "Check-out": l.checkOut, "Nights": l.nights,
    "Guests": l.guests, "Source": ESCALATION_LEAD_SOURCE, "Received (UTC)": x.receivedAt, "Email Status": "PENDING",
    "Status Updated (IST)": istNow, "Next Follow-up": nextFollowUpFor_(DEFAULT_LEAD_STATUS, now),
    "Score": scored.score, "Priority": scored.priority, "Guest Name": l.guestName, "Booking Code": x.bookingCode
  };
  var row = cols.names.map(function (name) {
    if (name === "Requirements") return longCell_(dated, ESCALATION_LEAD_HISTORY_MAX);
    return cell_(Object.prototype.hasOwnProperty.call(byName, name) && byName[name] !== null ? byName[name] : "");
  });
  sheet.appendRow(row);
  var created = sheet.getLastRow();
  applyStatusValidation_(sheet.getRange(created, cols.index[STATUS_HEADER]));
  return { outcome: "created", sheet: sheet, cols: cols, row: created };
}

function applyListValidation_(range, list, help) {
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).setHelpText(help).build());
}

function guestTab_(ss, name, headers, trace) {
  if (trace) trace.stage = "open_tab";
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (trace) trace.stage = "write_headers";
  return { sheet: sheet, cols: ensureLeadHeaders_(sheet, headers) };
}

function handleGuestRequest_(body, props) {
  var trace = { stage: "start" };
  var result;
  try {
    result = handleGuestRequestInner_(body, props, trace);
  } catch (err) {
    console.error("handleGuestRequest_ failed at " + trace.stage + ": " + (err && err.stack ? err.stack : err));
    result = { ok: false, error: "server_error", code: (err && err.diagCode) || "EXCEPTION", stage: trace.stage,
      errName: safeErrName_(err), errMsg: safeErrMsg_(err, props), where: errWhere_(err) };
  }
  return json_(result);
}

function handleGuestRequestInner_(body, props, trace) {
  trace.stage = "auth";
  var expected = props.getProperty("GUEST_MESSAGES_SINK_SECRET");
  if (!expected) return { ok: false, error: "rejected", code: "NO_SECRET_PROPERTY" };
  if (body.secret !== expected) return { ok: false, error: "rejected", code: "AUTH" };

  trace.stage = "validate";
  var isMessage = body.type === "guest_message";
  var item = isMessage ? body.message : body.escalation;
  var problem = isMessage ? guestMessageProblem_(item) : guestEscalationProblem_(item);
  if (problem) return { ok: false, error: "rejected", code: "INVALID", field: problem };
  trace.stage = "config";
  leadsSheetId_(props);

  trace.stage = "lock";
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: "busy", code: "BUSY" };
  var tab, rowIndex;
  var now = new Date();
  try {
    var ss = openLeadsSpreadsheet_(props, trace);
    tab = isMessage ? guestTab_(ss, GUEST_MESSAGES_SHEET, GUEST_MESSAGE_HEADERS, trace) : guestTab_(ss, GUEST_ESCALATIONS_SHEET, GUEST_ESCALATION_HEADERS, trace);
    var sheet = tab.sheet, cols = tab.cols;
    trace.stage = "find_id";
    var existing = findRowById_(sheet, isMessage ? item.messageId : item.escalationId);
    if (existing > 0) {
      if (!isMessage) {
        // A retry: the escalation row is already there. Its Lead step runs again (idempotent), so a Lead that failed
        // the first time can still be written; nothing else changes and no email is sent.
        var dupLead = escalationLeadStep_(ss, item, now, trace);
        return dupLead ? { ok: true, duplicate: true, lead: dupLead.outcome } : { ok: true, duplicate: true };
      }
      // Only allowed forward moves; the team's SENT/SKIPPED (and anything unexpected) is left exactly as it is.
      var current = sheetText_(sheet.getRange(existing, cols.index["Status"]).getValue()).trim().toUpperCase();
      var allowed = GUEST_MESSAGE_TRANSITIONS[current] || [];
      if (item.status === current || allowed.indexOf(item.status) === -1) return { ok: true, duplicate: true };
      trace.stage = "update_row";
      sheet.getRange(existing, cols.index["Status"]).setValue(item.status);
      sheet.getRange(existing, cols.index["Reason"]).setValue(cell_(item.reason || ""));
      sheet.getRange(existing, cols.index["Message"]).setValue(longCell_(item.message, 1500));
      sheet.getRange(existing, cols.index["Guest WhatsApp"]).setValue(cell_(item.guestPhone || ""));
      sheet.getRange(existing, cols.index["Send By"]).setValue(item.sendBy);
      sheet.getRange(existing, cols.index["Status Updated (IST)"]).setValue(istText_(now));
      return { ok: true, duplicate: true, updated: true };
    }
    trace.stage = "build_row";
    var byName = isMessage ? {
      "Created (IST)": istText_(now), "Message ID": item.messageId, "Status": item.status, "Type": item.type,
      "Scheduled Date": item.scheduledDate, "Send By": item.sendBy, "Booking ID": String(item.bookingId), "Booking Code": item.bookingCode,
      "Check-in": item.checkIn, "Check-out": item.checkOut, "Nights": item.nights, "Guests": item.guests,
      "Property": item.property, "Guest": item.guestName, "Guest WhatsApp": item.guestPhone,
      "Special Request": item.specialRequest, "Booking Source": item.bookingSource, "Reason": item.reason,
      "Status Updated (IST)": istText_(now)
    } : {
      "Received (IST)": istText_(now), "Escalation ID": item.escalationId, "Status": "Open", "Reason": item.reason,
      "Guest WhatsApp": item.guestPhone, "Booking Code": item.bookingCode, "Topic": item.intent, "Channel": item.channel,
      "Received (UTC)": item.receivedAt, "Email Status": "PENDING", "Status Updated (IST)": istText_(now)
    };
    var row = cols.names.map(function (name) {
      if (isMessage && name === "Message") return longCell_(item.message, 1500);
      if (!isMessage && name === "Question") return longCell_(item.question, 500);
      return cell_(Object.prototype.hasOwnProperty.call(byName, name) ? byName[name] : "");
    });
    trace.stage = "append_row";
    sheet.appendRow(row);
    rowIndex = sheet.getLastRow();
    trace.stage = "status_dropdown";
    if (isMessage) applyListValidation_(sheet.getRange(rowIndex, cols.index["Status"]), GUEST_MESSAGE_STATUSES, "QUEUED, READY, SENT, SKIPPED or FAILED. Set SENT once you have sent the message.");
    else applyListValidation_(sheet.getRange(rowIndex, cols.index["Status"]), GUEST_ESCALATION_STATUSES, "Open, In progress or Resolved.");
    // The escalation row is stored; only then the guest's Lead (verified WhatsApp escalations only).
    var lead = isMessage ? null : escalationLeadStep_(ss, item, now, trace);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  if (isMessage) return { ok: true, stored: true };

  // Escalation email after the lock is released. Its failure never undoes the stored row.
  trace.stage = "email";
  var emailStatus = sendGuestEscalationEmail_(item, props, tab.sheet.getParent().getUrl()) ? "SENT" : "FAILED";
  tab.sheet.getRange(rowIndex, tab.cols.index["Email Status"]).setValue(emailStatus);
  // A new Lead row shares the escalation's email (the team was told about this guest once).
  if (lead && lead.outcome === "created") {
    try { lead.sheet.getRange(lead.row, lead.cols.index[EMAIL_STATUS_HEADER]).setValue(emailStatus); } catch (err) { /* the Lead stays PENDING */ }
  }
  var out = { ok: true, stored: true, emailStatus: emailStatus };
  if (lead) out.lead = lead.outcome;
  return out;
}

// Runs upsertEscalationLead_ for an escalation that carries a verified-booking block. Never throws: a failure is
// logged and reported as "failed" (the escalation itself is already stored). Null when there is no Lead to write.
function escalationLeadStep_(ss, item, now, trace) {
  if (item.lead === undefined || item.lead === null) return null;
  var stage = trace.stage;
  try {
    return upsertEscalationLead_(ss, item, now, trace);
  } catch (err) {
    console.error("escalation lead failed at " + trace.stage + ": " + safeErrName_(err) + " " + errWhere_(err));
    return { outcome: "failed" };
  } finally {
    trace.stage = stage;
  }
}

function sendGuestEscalationEmail_(x, props, sheetUrl) {
  try {
    var check = teamMailCheck_(props);
    if (!check.send) return false;
    MailApp.sendEmail({
      to: check.to.join(","),
      subject: "Guest needs a team member" + (x.reason === "URGENT_ISSUE" ? " (urgent)" : ""),
      body: [
        "A guest message needs a team member.",
        "",
        "Why: " + (GUEST_ESCALATION_REASON_LABELS[x.reason] || x.reason),
        "Guest WhatsApp: " + (x.guestPhone || "not known"),
        "Booking: " + (x.bookingCode || "not identified"),
        "Message: " + x.question,
        "",
        "No booking has been changed. Reply to the guest yourself, then set Status on the Guest Escalations tab.",
        "Escalation ID: " + x.escalationId,
        "Sheet: " + String(sheetUrl).replace(/[?#].*$/, "")
      ].join("\n")
    });
    return true;
  } catch (err) {
    return false;
  }
}

function guestMessagesConfig_(props) {
  var mode = String(props.getProperty("GUEST_MESSAGES_MODE") || "off").trim().toLowerCase();
  if (mode !== "dry_run" && mode !== "queue") return { ok: false, mode: "off", reason: "GUEST_MESSAGES_MODE is off" };
  var endpoint = String(props.getProperty("GUEST_MESSAGES_ENDPOINT") || "").trim();
  if (!/^https:\/\/[^\s]+\/api\/guest-messages\/run$/.test(endpoint)) return { ok: false, mode: mode, reason: "GUEST_MESSAGES_ENDPOINT must be https://<site>/api/guest-messages/run" };
  var secret = String(props.getProperty("GUEST_MESSAGES_API_SECRET") || "").trim();
  if (secret.length < GUEST_MESSAGES_MIN_SECRET_LENGTH) return { ok: false, mode: mode, reason: "GUEST_MESSAGES_API_SECRET must be at least " + GUEST_MESSAGES_MIN_SECRET_LENGTH + " characters" };
  return { ok: true, mode: mode, endpoint: endpoint, secret: secret };
}

// Due messages for the digest: READY or FAILED, not yet handled, with Scheduled Date <= today (India) <= Send By.
// A message past its Send By date is never listed (it has lapsed; expireGuestMessages_ marks it SKIPPED/expired), and
// a row without a valid Send By is not listed either.
function collectDueGuestMessages_(ss, today) {
  var sheet = ss.getSheetByName(GUEST_MESSAGES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var h = readLeadHeaders_(sheet);
  var tz = ss.getSpreadsheetTimeZone();
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, h.names.length).getValues();
  var out = [];
  rows.forEach(function (r) {
    function v(name) { return h.index[name] ? r[h.index[name] - 1] : ""; }
    var status = sheetText_(v("Status")).trim().toUpperCase();
    if (status !== "READY" && status !== "FAILED") return;
    if (!GUEST_MESSAGE_ID_RE.test(sheetText_(v("Message ID")))) return;
    var scheduled = sheetDateText_(v("Scheduled Date"), tz);
    if (!ISO_DATE.test(scheduled) || scheduled > today) return;
    var sendBy = sheetDateText_(v("Send By"), tz);
    if (!ISO_DATE.test(sendBy) || sendBy < today) return;
    out.push({
      status: status, type: sheetText_(v("Type")), scheduled: scheduled, bookingCode: sheetText_(v("Booking Code")),
      guest: sheetText_(v("Guest")), phone: sheetText_(v("Guest WhatsApp")), property: sheetText_(v("Property")),
      reason: sheetText_(v("Reason")), message: sheetText_(v("Message"))
    });
  });
  out.sort(function (a, b) { return a.scheduled < b.scheduled ? -1 : a.scheduled > b.scheduled ? 1 : 0; });
  return out;
}

function guestDigestEmail_(items, today, sheetUrl) {
  var lines = ["Guest messages to send today (" + today + "). Nothing has been sent to any guest.", "",
    "Send each READY message to the guest yourself, then set its Status to SENT on the Guest Messages tab.", ""];
  items.forEach(function (it, i) {
    lines.push((i + 1) + ". " + (GUEST_MESSAGE_TYPE_LABELS[it.type] || it.type) + " - " + it.status + (it.scheduled < today ? " (scheduled " + it.scheduled + ")" : ""));
    lines.push("   Guest: " + (it.guest || "(name not available)") + ", WhatsApp: " + (it.phone || "not available - check Intellistay"));
    lines.push("   Booking: " + (it.bookingCode || "-") + (it.property ? ", " + it.property : ""));
    if (it.status === "FAILED") lines.push("   Problem: " + (it.reason || "see Sheet"));
    lines.push("   Message:");
    it.message.split("\n").forEach(function (l) { lines.push("   " + l); });
    lines.push("");
  });
  lines.push("Sheet: " + sheetUrl);
  return { subject: "Guest messages to send (" + items.length + ")", body: lines.join("\n") };
}

/**
 * Daily trigger (installed by setupGuestMessages). In queue mode it first expires messages whose Send By date has
 * passed (SKIPPED, reason "expired"). It then calls the website's /api/guest-messages/run in GUEST_MESSAGES_MODE
 * (dry_run or queue) and, in queue mode, emails one digest of due messages (once a day). Dry run changes nothing.
 * Never contacts a guest. Logs and returns counts and status codes only (no names, phones or message text).
 */
function runGuestMessages() {
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var today = istDateText_(now);
  var result = { today: today };
  var cfg = guestMessagesConfig_(props);
  result.mode = cfg.mode;
  if (!cfg.ok) {
    result.ran = false;
    result.reason = cfg.reason;
  } else {
    result.ran = true;
    // Queue mode: first expire messages whose Send By date has passed, so a lapsed message is never sent late.
    if (cfg.mode === "queue") {
      try {
        result.expired = expireGuestMessages_(openLeadsSpreadsheet_(props, null), today, now);
      } catch (err) {
        result.expired = "failed: " + safeErrName_(err);
      }
    }
    try {
      var res = UrlFetchApp.fetch(cfg.endpoint, {
        method: "post", contentType: "application/json", muteHttpExceptions: true, followRedirects: false,
        headers: { Authorization: "Bearer " + cfg.secret }, payload: JSON.stringify({ mode: cfg.mode })
      });
      result.http = res.getResponseCode();
      var reply = null;
      try { reply = JSON.parse(res.getContentText()); } catch (e) { reply = null; }
      if (reply && typeof reply === "object") {
        result.ok = reply.ok === true;
        if (reply.error) result.error = String(reply.error).slice(0, 40);
        if (reply.reason) result.errorReason = String(reply.reason).slice(0, 40);
        if (typeof reply.bookings === "number") result.bookings = reply.bookings;
        if (typeof reply.planned === "number") result.planned = reply.planned;
        if (reply.byStatus && typeof reply.byStatus === "object") result.byStatus = reply.byStatus;
        if (reply.deliveries && typeof reply.deliveries === "object") result.deliveries = reply.deliveries;
      } else {
        result.ok = false;
        result.error = "bad_response";
      }
    } catch (err) {
      result.ok = false;
      result.error = "fetch_failed: " + safeErrName_(err);
    }
    if (cfg.mode === "queue") result.digest = sendGuestMessageDigest_(props, now);
  }
  var text = "GUEST MESSAGES RUN | " + JSON.stringify(result);
  console.log(text);
  Logger.log(text);
  return result;
}

// Week 7: manual Status changes on the Guest Messages tab (called from onLeadStatusEdit, the existing installable
// "on edit" trigger). Stamps "Status Updated (IST)" for each edited row that has a Message ID and a valid status, and
// normalises the status's case ("sent" -> "SENT"). Ignores the header row, other columns, invalid values and
// re-selecting the value a cell already had. Never changes Reason, Send By, Message or any other column.
function guestMessageStatusEdit_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var cols = readLeadHeaders_(sheet);
  var statusCol = cols.index["Status"];
  var updatedCol = cols.index["Status Updated (IST)"];
  var idCol = cols.index["Message ID"];
  if (!statusCol || !updatedCol || !idCol) return;
  if (statusCol < range.getColumn() || statusCol > range.getLastColumn()) return;
  var first = Math.max(range.getRow(), 2);
  var last = range.getLastRow();
  if (last < first) return;
  var n = last - first + 1;
  var singleCell = range.getNumRows() === 1 && range.getNumColumns() === 1;
  var ids = sheet.getRange(first, idCol, n, 1).getValues();
  var statuses = sheet.getRange(first, statusCol, n, 1).getValues();
  var updated = sheet.getRange(first, updatedCol, n, 1).getValues();
  var stamp = istText_(new Date());
  var changed = false, recased = false;
  for (var i = 0; i < n; i++) {
    if (!GUEST_MESSAGE_ID_RE.test(sheetText_(ids[i][0]))) continue;
    var status = String(statuses[i][0] === null || statuses[i][0] === undefined ? "" : statuses[i][0]).trim().toUpperCase();
    if (GUEST_MESSAGE_STATUSES.indexOf(status) === -1) continue;
    if (singleCell && e.oldValue !== undefined && String(e.oldValue).trim().toUpperCase() === status) continue;
    if (statuses[i][0] !== status) { statuses[i][0] = status; recased = true; }
    updated[i][0] = stamp;
    changed = true;
  }
  if (!changed) return;
  if (recased) sheet.getRange(first, statusCol, n, 1).setValues(statuses);
  sheet.getRange(first, updatedCol, n, 1).setValues(updated);
}

// Marks every QUEUED, READY or FAILED message whose Send By date is before today (India) as SKIPPED with Reason
// "expired", and stamps Status Updated. Rows the team set to SENT or SKIPPED, rows of any other status and rows without
// a valid Send By date are never changed. Returns the number of rows expired (or a reason string).
var GUEST_MESSAGE_EXPIRABLE = ["QUEUED", "READY", "FAILED"];

function expireGuestMessages_(ss, today, now) {
  var sheet = ss.getSheetByName(GUEST_MESSAGES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return "busy";
  try {
    var h = readLeadHeaders_(sheet);
    if (!h.index["Status"] || !h.index["Send By"] || !h.index["Reason"]) return 0;
    var tz = ss.getSpreadsheetTimeZone();
    var last = sheet.getLastRow();
    var rows = sheet.getRange(2, 1, last - 1, h.names.length).getValues();
    var expired = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!GUEST_MESSAGE_ID_RE.test(sheetText_(r[h.index["Message ID"] - 1]))) continue;
      var status = sheetText_(r[h.index["Status"] - 1]).trim().toUpperCase();
      if (GUEST_MESSAGE_EXPIRABLE.indexOf(status) === -1) continue;
      var sendBy = sheetDateText_(r[h.index["Send By"] - 1], tz);
      if (!ISO_DATE.test(sendBy) || sendBy >= today) continue;
      var row = i + 2;
      sheet.getRange(row, h.index["Status"]).setValue("SKIPPED");
      sheet.getRange(row, h.index["Reason"]).setValue("expired");
      if (h.index["Status Updated (IST)"]) sheet.getRange(row, h.index["Status Updated (IST)"]).setValue(istText_(now));
      expired++;
    }
    if (expired) SpreadsheetApp.flush();
    return expired;
  } finally {
    lock.releaseLock();
  }
}

function sendGuestMessageDigest_(props, now) {
  var today = istDateText_(now);
  if (props.getProperty(LAST_GUEST_DIGEST_PROPERTY) === today) return { sent: false, reason: "already sent today" };
  var ss = openLeadsSpreadsheet_(props, null);
  var items = collectDueGuestMessages_(ss, today);
  if (!items.length) return { sent: false, reason: "nothing due", due: 0 };
  var check = teamMailCheck_(props);
  if (!check.send) return { sent: false, reason: check.reason, due: items.length };
  var email = guestDigestEmail_(items, today, String(ss.getUrl()).replace(/[?#].*$/, ""));
  try {
    MailApp.sendEmail({ to: check.to.join(","), subject: email.subject, body: email.body });
    props.setProperty(LAST_GUEST_DIGEST_PROPERTY, today);
    return { sent: true, due: items.length, recipients: check.to.length };
  } catch (err) {
    return { sent: false, reason: "send failed: " + safeErrName_(err), due: items.length };
  }
}

/**
 * Run ONCE from the Apps Script editor after deploying Week 7 (safe to run again). Creates the Guest Messages and
 * Guest Escalations tabs (headers only) and installs the daily runGuestMessages trigger at about 09:00. Never
 * creates a second trigger. Does not call the website and contacts nobody. Logs and returns a summary.
 */
function setupGuestMessages() {
  var props = PropertiesService.getScriptProperties();
  var ss = openLeadsSpreadsheet_(props, null);
  guestTab_(ss, GUEST_MESSAGES_SHEET, GUEST_MESSAGE_HEADERS, null);
  guestTab_(ss, GUEST_ESCALATIONS_SHEET, GUEST_ESCALATION_HEADERS, null);
  // Manual status changes are stamped by the existing Week 6 on-edit trigger (onLeadStatusEdit). Install it for the
  // leads Sheet only if setupLeadStatusTracking has not already done so (never a second copy).
  var hasEditTrigger = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === STATUS_EDIT_HANDLER && t.getTriggerSourceId() === ss.getId();
  });
  if (!hasEditTrigger) ScriptApp.newTrigger(STATUS_EDIT_HANDLER).forSpreadsheet(ss).onEdit().create();
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === GUEST_MESSAGES_HANDLER; });
  for (var i = 1; i < existing.length; i++) ScriptApp.deleteTrigger(existing[i]);
  var projectTz = Session.getScriptTimeZone();
  if (!existing.length) {
    var builder = ScriptApp.newTrigger(GUEST_MESSAGES_HANDLER).timeBased().atHour(GUEST_MESSAGES_TRIGGER_HOUR).nearMinute(0).everyDays(1);
    if (!projectTz) builder = builder.inTimezone(FOLLOW_UP_FALLBACK_TZ);
    builder.create();
  }
  var cfg = guestMessagesConfig_(props);
  var summary = {
    tabs: [GUEST_MESSAGES_SHEET, GUEST_ESCALATIONS_SHEET],
    trigger: existing.length ? "already installed" : "installed",
    duplicatesRemoved: Math.max(existing.length - 1, 0),
    runsAt: "daily, about 09:00 (" + (projectTz || FOLLOW_UP_FALLBACK_TZ) + ")",
    statusEditTrigger: hasEditTrigger ? "already installed" : "installed",
    mode: cfg.mode, ready: cfg.ok,
    props: {
      GUEST_MESSAGES_SINK_SECRET: !!props.getProperty("GUEST_MESSAGES_SINK_SECRET"),
      GUEST_MESSAGES_ENDPOINT: !!props.getProperty("GUEST_MESSAGES_ENDPOINT"),
      GUEST_MESSAGES_API_SECRET: !!props.getProperty("GUEST_MESSAGES_API_SECRET"),
      TEAM_EMAILS: !!String(props.getProperty("TEAM_EMAILS") || "").trim()
    }
  };
  if (!cfg.ok) summary.notReady = cfg.reason;
  var text = "GUEST MESSAGES SETUP | " + JSON.stringify(summary);
  console.log(text);
  Logger.log(text);
  return summary;
}

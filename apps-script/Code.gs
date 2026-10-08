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

function emailDecision_(props, cache) {
  var to = (props.getProperty("TEAM_EMAILS") || "").split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s; });
  if (!to.length) return { send: false, reason: "skipped: TEAM_EMAILS not set" };
  if (MailApp.getRemainingDailyQuota() < to.length) return { send: false, reason: "skipped: daily email quota" };
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
  "Received (UTC)", "Handoff Number", "Notes", "Email Status"];
var HANDOFF_SHEET = "Handoffs";
var HANDOFF_HEADERS = ["Received (IST)", "Handoff ID", "Status", "Reason", "Phone", "Destination", "Property", "Check-in",
  "Check-out", "Nights", "Guests", "Requirements", "Ref", "Source", "Conversation State", "Qualification Status", "Site",
  "Received (UTC)", "Handoff Number", "Email Status"];

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

var BOT_CODE_VERSION = "bot-v5.4-sheetid";

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
  var sheet, rowIndex;
  try {
    var ss = openLeadsSpreadsheet_(props, trace);
    trace.stage = "open_tab";
    sheet = ss.getSheetByName(tabName);
    if (!sheet) { trace.stage = "create_tab"; sheet = ss.insertSheet(tabName); }
    if (sheet.getLastRow() === 0) {
      trace.stage = "write_headers";
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
    trace.stage = "find_id";
    if (findRowById_(sheet, id) > 0) return { ok: true, duplicate: true }; // retry: no new row, no new email
    trace.stage = "build_row";
    var istNow = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
    var row = qualified
      ? [istNow, id, "New", item.phone, item.destination, item.property, item.checkIn, item.checkOut, item.nights, item.guests,
         item.requirements, item.ref, item.source, item.conversationState, item.qualificationStatus, item.site, item.receivedAt,
         item.handoffNumber, notesText_(item.notes), "PENDING"]
      : [istNow, id, "New", item.reason, item.phone, item.destination, item.property, item.checkIn, item.checkOut, item.nights,
         item.guests, item.requirements, item.ref, item.source, item.conversationState, item.qualificationStatus, item.site,
         item.receivedAt, item.handoffNumber, "PENDING"];
    row = row.map(cell_);
    trace.stage = "append_row";
    sheet.appendRow(row);
    trace.stage = "read_row_index";
    rowIndex = sheet.getLastRow();
    if (opts.dryRun) {
      trace.stage = "dry_run_cleanup";
      sheet.deleteRow(rowIndex);
    }
  } finally {
    lock.releaseLock();
  }
  if (opts.dryRun) return { ok: true, dryRun: true, wouldStore: true, v: BOT_CODE_VERSION };

  // The row is stored. Email failure does not undo it, and a retry finds the row and sends nothing again.
  trace.stage = "email";
  var emailStatus = sendBotLeadEmail_(item, qualified, props, sheet.getParent().getUrl()) ? "SENT" : "FAILED";
  trace.stage = "email_status";
  sheet.getRange(rowIndex, headers.length).setValue(emailStatus);
  return { ok: true, stored: true, emailStatus: emailStatus };
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
  ["QUALIFIED_LEAD_SINK_SECRET", "LEAD_SINK_SECRET", "DIAG_KEY", "TEAM_EMAILS", "LEADS_SHEET_ID"].forEach(function (k) {
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
  var to = (props.getProperty("TEAM_EMAILS") || "").split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  if (!to.length) return false;
  try {
    if (MailApp.getRemainingDailyQuota() < to.length) return false;
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

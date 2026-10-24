// Shared harness for the Apps Script tests: runs the real apps-script/Code.gs in a Node sandbox with small
// fakes of the Google services it uses (Sheets, Mail, Lock, Properties, Cache, Script triggers).
// No network, no real Google account, fake secrets only. Fixed clock: 2026-10-12 07:30:00 UTC = 13:00:00 IST.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

export const CODE = readFileSync(new URL("../../apps-script/Code.gs", import.meta.url), "utf8");
export const NOW_MS = Date.parse("2026-10-12T07:30:00Z");
export const IST_NOW = "2026-10-12 13:00:00";
export const IST_PLUS_1D = "2026-10-13 13:00:00";
export const IST_PLUS_2D = "2026-10-14 13:00:00";
export const SECRET = "fake-qualified-secret-for-tests";
export const SHEET_ID = "TESTSHEETID_0123456789abcdefghijkl";

export const OLD_QUALIFIED_HEADERS = ["Received (IST)", "Lead ID", "Status", "Phone", "Destination", "Property", "Check-in", "Check-out",
  "Nights", "Guests", "Requirements", "Ref", "Source", "Conversation State", "Qualification Status", "Site",
  "Received (UTC)", "Handoff Number", "Notes", "Email Status"];
export const OLD_HANDOFF_HEADERS = ["Received (IST)", "Handoff ID", "Status", "Reason", "Phone", "Destination", "Property", "Check-in",
  "Check-out", "Nights", "Guests", "Requirements", "Ref", "Source", "Conversation State", "Qualification Status", "Site",
  "Received (UTC)", "Handoff Number", "Email Status"];

// ---------- fakes ----------

export function formatDate(date, tz, pattern) {
  const offsetMin = tz === "Asia/Kolkata" ? 330 : 0;
  const d = new Date(date.getTime() + offsetMin * 60000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const parts = { yyyy: p(d.getUTCFullYear(), 4), MM: p(d.getUTCMonth() + 1), dd: p(d.getUTCDate()), HH: p(d.getUTCHours()), mm: p(d.getUTCMinutes()), ss: p(d.getUTCSeconds()) };
  return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, (t) => parts[t]);
}

export function createSheet(name, spreadsheet, sheetId = 0) {
  const data = []; // rows of cell values
  const validations = new Map(); // "row,col" -> rule
  const sheet = {
    data, validations, frozenRows: 0,
    getName: () => name,
    getSheetId: () => sheetId,
    getParent: () => spreadsheet,
    getLastRow() {
      for (let r = data.length; r >= 1; r--) if ((data[r - 1] || []).some((v) => v !== "" && v !== undefined && v !== null)) return r;
      return 0;
    },
    getLastColumn() {
      let max = 0;
      data.forEach((row) => row.forEach((v, i) => { if (v !== "" && v !== undefined && v !== null) max = Math.max(max, i + 1); }));
      return max;
    },
    getMaxRows: () => Math.max(1000, data.length),
    setFrozenRows(n) { sheet.frozenRows = n; },
    appendRow(values) {
      const at = sheet.getLastRow();
      data.length = at;
      data.push(values.slice());
    },
    deleteRow(r) { data.splice(r - 1, 1); },
    clearContents() { data.length = 0; },
    cell(r, c) { const row = data[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined ? "" : v; },
    setCell(r, c, v) { while (data.length < r) data.push([]); const row = data[r - 1]; while (row.length < c) row.push(""); row[c - 1] = v; },
    headers() { return (data[0] || []).slice(); },
    // Like Sheet.moveColumns: whole columns (values and data validation) move; destination is the 1-based index
    // before the move.
    moveColumns(range, destinationIndex) {
      const from = range.getColumn() - 1, n = range.getNumColumns();
      const width = Math.max(sheet.getLastColumn(), from + n);
      const order = Array.from({ length: width }, (_, i) => i);
      const moving = order.splice(from, n);
      const at = destinationIndex - 1 > from ? destinationIndex - 1 - n : destinationIndex - 1;
      order.splice(at, 0, ...moving);
      data.forEach((row, r) => { const old = row.slice(); data[r] = order.map((c) => (old[c] === undefined ? "" : old[c])); });
      const moved = new Map();
      validations.forEach((rule, key) => { const [r, c] = key.split(",").map(Number); moved.set(r + "," + (order.indexOf(c - 1) + 1), rule); });
      validations.clear();
      moved.forEach((rule, key) => validations.set(key, rule));
    },
    getRange(row, col, numRows = 1, numCols = 1) {
      const range = {
        getSheet: () => sheet,
        getRow: () => row, getColumn: () => col, getNumRows: () => numRows, getNumColumns: () => numCols,
        getLastRow: () => row + numRows - 1, getLastColumn: () => col + numCols - 1,
        getValues() { return Array.from({ length: numRows }, (_, i) => Array.from({ length: numCols }, (_, j) => sheet.cell(row + i, col + j))); },
        getValue() { return sheet.cell(row, col); },
        setValues(values) { values.forEach((r, i) => r.forEach((v, j) => sheet.setCell(row + i, col + j, v))); return range; },
        setValue(v) { for (let i = 0; i < numRows; i++) for (let j = 0; j < numCols; j++) sheet.setCell(row + i, col + j, v); return range; },
        setDataValidation(rule) { for (let i = 0; i < numRows; i++) for (let j = 0; j < numCols; j++) validations.set((row + i) + "," + (col + j), rule); return range; },
      };
      return range;
    },
  };
  return sheet;
}

// Options: urlFetch (Stretch 2) is opt-in: without it UrlFetchApp does not exist in the sandbox, so any other
// feature that tried to call the network would fail loudly. nowMs moves the fixed clock. tryLock overrides the lock.
export function createEnv({ props = {}, mailThrows = false, mailQuota = 100, scriptTimeZone = "Asia/Kolkata", urlFetch = null, nowMs = NOW_MS, tryLock = null } = {}) {
  const sheets = new Map();
  let nextSheetId = 1001;
  const spreadsheet = {
    getId: () => SHEET_ID,
    getUrl: () => "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/edit",
    getSpreadsheetTimeZone: () => "Asia/Kolkata",
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet(n) { const s = createSheet(n, spreadsheet, nextSheetId++); sheets.set(n, s); return s; },
    getSheets: () => Array.from(sheets.values()),
  };
  const store = Object.assign({ QUALIFIED_LEAD_SINK_SECRET: SECRET, LEAD_SINK_SECRET: "fake-click-secret-for-tests", TEAM_EMAILS: "team@example.com", LEADS_SHEET_ID: SHEET_ID }, props);
  const mails = [];
  const triggers = [];
  const cache = new Map();

  const clock = { ms: nowMs };
  class FakeDate extends Date {
    constructor(...args) { if (args.length === 0) super(clock.ms); else super(...args); }
    static now() { return clock.ms; }
  }

  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    Logger: { log() {} },
    Date: FakeDate,
    JSON, Math, String, Number, Object, Array, RegExp, Error, parseInt, isNaN, isFinite,
    SpreadsheetApp: {
      openById(id) { if (id !== SHEET_ID) throw new Error("not found"); return spreadsheet; },
      flush() {},
      newDataValidation() {
        const rule = {};
        const b = {
          requireValueInList(list, showDropdown) { rule.list = list.slice(); rule.showDropdown = showDropdown; return b; },
          setAllowInvalid(v) { rule.allowInvalid = v; return b; },
          setHelpText(t) { rule.helpText = t; return b; },
          build() { return rule; },
        };
        return b;
      },
    },
    Utilities: {
      formatDate,
      DigestAlgorithm: { MD5: "md5" },
      computeDigest(_alg, text) { return Array.from(createHash("md5").update(String(text)).digest()); },
      base64Encode(bytes) { return Buffer.from(bytes).toString("base64"); },
    },
    LockService: { getScriptLock: () => ({ tryLock: tryLock || (() => true), releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = v; }, deleteProperty: (k) => { delete store[k]; } }) },
    MailApp: {
      getRemainingDailyQuota: () => mailQuota,
      sendEmail(msg) { if (mailThrows) throw new Error("mail down"); mails.push(msg); },
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput(s) { const o = { setMimeType() { return o; }, getContent: () => s }; return o; },
    },
    Session: { getScriptTimeZone: () => scriptTimeZone },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger(t) { const i = triggers.indexOf(t); if (i !== -1) triggers.splice(i, 1); },
      newTrigger(handler) {
        let source = null, type = null;
        const clock = {};
        const b = {
          forSpreadsheet(ss) { source = ss.getId(); return b; },
          onEdit() { type = "ON_EDIT"; return b; },
          timeBased() { type = "CLOCK"; return b; },
          atHour(h) { clock.hour = h; return b; },
          nearMinute(m) { clock.minute = m; return b; },
          everyDays(n) { clock.everyDays = n; return b; },
          inTimezone(tz) { clock.timeZone = tz; return b; },
          create() { const t = { getHandlerFunction: () => handler, getTriggerSourceId: () => source, type, clock }; triggers.push(t); return t; },
        };
        return b;
      },
    },
  };
  const fetches = [];
  if (urlFetch) {
    sandbox.UrlFetchApp = {
      fetch(url, options) {
        fetches.push({ url, options });
        const r = urlFetch(url, options, fetches.length);
        if (r instanceof Error) throw r;
        return { getResponseCode: () => r.status, getContentText: () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)) };
      },
    };
  }
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox, { filename: "Code.gs" });
  // setNow(ms) moves the fake clock (e.g. to simulate a slow run).
  return { gs: sandbox, spreadsheet, sheets, mails, triggers, store, fetches, setNow: (ms) => { clock.ms = ms; } };
}

// ---------- fixtures ----------

export function qualifiedLead(overrides = {}) {
  return Object.assign({
    leadId: "L-ABCDEF0123", timestamp: "2026-10-12T07:29:50.000Z", phone: "+919000000001", destination: "Jaipur", property: null,
    checkIn: "2026-12-10", checkOut: "2026-12-13", nights: 3, guests: 2, requirements: "", ref: "DIRECT", source: "whatsapp-bot",
    conversationState: "HANDED_OFF", qualificationStatus: "QUALIFIED", site: "example.com",
    receivedAt: "2026-10-12T07:29:55.000Z", handoffNumber: "+91 9000000009", notes: [],
  }, overrides);
}

export function handoff(overrides = {}) {
  return Object.assign({
    handoffId: "H-ABCDEF0123", timestamp: "2026-10-12T07:29:50.000Z", phone: "+919000000002", reason: "HUMAN_REQUESTED",
    destination: null, property: null, checkIn: null, checkOut: null, nights: null, guests: null, requirements: null,
    ref: "W-FLOATING", source: "whatsapp-bot", conversationState: "HANDED_OFF", qualificationStatus: "NOT_QUALIFIED",
    site: "example.com", receivedAt: "2026-10-12T07:29:55.000Z", handoffNumber: "+91 9000000009",
  }, overrides);
}

export function post(env, body) {
  return JSON.parse(env.gs.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}

export function postLead(env, lead = qualifiedLead()) { return post(env, { secret: SECRET, type: "qualified_lead", lead }); }
export function postHandoff(env, h = handoff()) { return post(env, { secret: SECRET, type: "lead_handoff", handoff: h }); }

// Row as { header: value } using the tab's own header row.
export function rowObject(sheet, r) {
  const out = {};
  sheet.headers().forEach((h, i) => { out[h] = sheet.cell(r, i + 1); });
  return out;
}

export function col(sheet, name) { return sheet.headers().indexOf(name) + 1; }

export function editEvent(sheet, row, column, oldValue, numRows = 1, numCols = 1) {
  const e = { range: sheet.getRange(row, column, numRows, numCols) };
  if (oldValue !== undefined) e.oldValue = oldValue;
  return e;
}

// Pre-Week 6 tab: the 20 Week 5 headers and existing rows, as the live Sheet has them today.
export function oldLayoutTab(env, name, headers, rows) {
  const s = env.spreadsheet.insertSheet(name);
  s.appendRow(headers);
  rows.forEach((r) => s.appendRow(r));
  return s;
}

export function oldQualifiedRow(id, status, receivedIst, emailStatus = "SENT") {
  return [receivedIst, id, status, "+919000000003", "Jaipur", "", "2026-12-01", "2026-12-03", 2, 2, "", "DIRECT", "whatsapp-bot",
    "HANDED_OFF", "QUALIFIED", "example.com", "2026-10-08T18:00:00.000Z", "+91 9000000009", "", emailStatus];
}

// Week 6, Stretch 1: conversion report by Source and by Ref (generateConversionReport in apps-script/Code.gs).
// Harness (fake Google services, fixed clock 2026-10-12 13:00 IST): tests/helpers/apps-script-env.mjs.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { IST_NOW, createEnv } from "../helpers/apps-script-env.mjs";

const SOURCE_HEADERS = ["Source", "Total leads", "Qualified", "Handoffs", "Unique guests", "New", "Contacted", "Booked", "Lost",
  "Other status", "Open leads", "Booking conversion %", "Contact rate %", "Reached rate %"];
const REF_HEADERS = ["Ref", "Entry point", "Total leads", "Qualified", "Handoffs", "Unique guests", "New", "Contacted", "Booked", "Lost",
  "Other status", "Open leads", "Booking conversion %", "Contact rate %", "Reached rate %", "WhatsApp clicks", "Click → Lead % (approx.)"];

function tabs(env, { clicks = true } = {}) {
  const q = env.spreadsheet.insertSheet("Qualified Leads");
  q.appendRow(env.gs.QUALIFIED_HEADERS);
  const h = env.spreadsheet.insertSheet("Handoffs");
  h.appendRow(env.gs.HANDOFF_HEADERS);
  let c = null;
  if (clicks) { c = env.spreadsheet.insertSheet("WhatsApp Clicks"); c.appendRow(env.gs.HEADERS); }
  return { q, h, c };
}

function add(sheet, values) {
  sheet.appendRow(sheet.headers().map((name) => (name in values ? values[name] : "")));
}

let n = 0;
function hex(prefix) { n++; return prefix + "-" + n.toString(16).toUpperCase().padStart(10, "0"); }

function lead(sheet, status, extra = {}) {
  const id = sheet.getName() === "Handoffs" ? hex("H") : hex("L");
  const idCol = sheet.getName() === "Handoffs" ? "Handoff ID" : "Lead ID";
  add(sheet, Object.assign({ [idCol]: id, "Status": status, "Phone": "+91900000" + String(n).padStart(4, "0"), "Source": "whatsapp-bot", "Ref": "DIRECT" }, extra));
  return id;
}

function click(sheet, ref) { add(sheet, { "Received (IST)": "2026-10-10 10:00:00", "Status": "Lead Intent", "Ref": ref }); }

// The report section starting at its title, as { name -> { header -> value } } (the Total row included).
function section(env, title) {
  const s = env.sheets.get("Conversion Report");
  const rows = s.data.map((r) => r.slice());
  const start = rows.findIndex((r) => r[0] === title);
  assert.ok(start >= 0, "section " + title);
  let hdr = start + 1;
  while (rows[hdr][0] === "Note") hdr++;
  const headers = rows[hdr].filter((v) => v !== "");
  const out = { headers };
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((v) => v === "")) break;
    const obj = {};
    headers.forEach((h2, j) => { obj[h2] = r[j]; });
    out[r[0]] = obj;
    if (r[0] === "Total") break;
  }
  return out;
}

// ======================================================================
// Pure parts
// ======================================================================

test("percent text: one decimal, N/A when dividing by zero", () => {
  const { gs } = createEnv();
  assert.equal(gs.percentText_(1, 3), "33.3%");
  assert.equal(gs.percentText_(2, 3), "66.7%");
  assert.equal(gs.percentText_(1, 1), "100.0%");
  assert.equal(gs.percentText_(0, 5), "0.0%");
  assert.equal(gs.percentText_(3, 2), "150.0%"); // click -> lead can exceed 100%
  assert.equal(gs.percentText_(0, 0), "N/A");
  assert.equal(gs.percentText_(4, 0), "N/A");
});

test("entry point for every Ref the website produces", () => {
  const { gs } = createEnv();
  const cases = [["DIRECT", "Direct (no website Ref)"], ["(none)", "Direct (no website Ref)"], ["W-FLOATING", "Floating button"],
    ["W-CONTACT", "Contact page"], ["W-PROP-studio-925", "Property page"], ["W-HOME-AVAILABILITY", "Availability widget"],
    ["W-DEST-jaipur-AVAILABILITY", "Availability widget"], ["W-PAGE-stays-in-sariska-AVAILABILITY", "Availability widget"],
    ["W-JOURNAL-alwar-weekend-guide", "Other website link"], ["something", "Unknown"]];
  for (const [ref, ep] of cases) assert.equal(gs.refEntryPoint_(ref), ep, ref);
});

// ======================================================================
// Report layout
// ======================================================================

test("report tab: marker, generated time, definitions, exact column headers for both sections", () => {
  const env = createEnv();
  const { q } = tabs(env);
  lead(q, "New");
  env.gs.generateConversionReport();
  const s = env.sheets.get("Conversion Report");
  assert.equal(s.cell(1, 1), "Conversion Report");
  assert.equal(s.cell(2, 1), "Generated (IST)");
  assert.equal(s.cell(2, 2), IST_NOW);
  assert.equal(s.cell(3, 1), "Definitions");
  assert.match(s.cell(3, 2), /Reached rate = \(Contacted \+ Booked\) \/ Total/);
  assert.deepEqual(Array.from(section(env, "By Source").headers), SOURCE_HEADERS);
  assert.deepEqual(Array.from(section(env, "By Ref (website entry point)").headers), REF_HEADERS);
  assert.ok(s.data.some((r) => r[0] === "Note" && /APPROXIMATE/.test(r[1])), "click rate is labelled approximate");
});

// ======================================================================
// Counting
// ======================================================================

test("status counts, Other status, Open leads and all three rates", () => {
  const env = createEnv();
  const { q } = tabs(env);
  for (const st of ["New", "New", "", "Contacted", "Contacted", "Booked", "Lost", "Follow-up", "booked", "LOST"]) lead(q, st);
  env.gs.generateConversionReport();
  const row = section(env, "By Source")["whatsapp-bot"];
  assert.equal(row["Total leads"], 10);
  assert.equal(row["New"], 3); // two New + one empty
  assert.equal(row["Contacted"], 2);
  assert.equal(row["Booked"], 2); // "booked" counts as Booked
  assert.equal(row["Lost"], 2);
  assert.equal(row["Other status"], 1); // "Follow-up"
  assert.equal(row["Open leads"], 5);
  assert.equal(row["Booking conversion %"], "20.0%");
  assert.equal(row["Contact rate %"], "20.0%");
  assert.equal(row["Reached rate %"], "40.0%");
  assert.equal(row["New"] + row["Contacted"] + row["Booked"] + row["Lost"] + row["Other status"], row["Total leads"]);
});

test("Qualified Leads and Handoffs are combined; split shown; a repeated ID is counted once; invalid IDs are skipped", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  const id = lead(q, "Contacted");
  add(q, { "Lead ID": id, "Status": "Booked", "Source": "whatsapp-bot", "Ref": "DIRECT" }); // same ID copied: not counted again
  lead(q, "New");
  lead(h, "New");
  lead(h, "Booked");
  add(q, { "Lead ID": "L-123", "Status": "Booked", "Source": "whatsapp-bot" }); // invalid ID
  add(q, { "Lead ID": "H-0000000ABC", "Status": "Booked", "Source": "whatsapp-bot" }); // handoff ID on the leads tab
  add(q, { "Lead ID": "", "Status": "New", "Source": "whatsapp-bot" }); // no ID
  add(q, {}); // blank row: not even a skipped row
  const summary = env.gs.generateConversionReport();
  const total = section(env, "By Source")["Total"];
  assert.equal(total["Total leads"], 4);
  assert.equal(total["Qualified"], 2);
  assert.equal(total["Handoffs"], 2);
  assert.equal(total["Contacted"], 1); // the first row of the repeated ID wins
  assert.equal(total["Booked"], 1);
  assert.equal(summary.duplicateIds, 1);
  assert.equal(summary.skippedNoId, 3);
  const notes = env.sheets.get("Conversion Report").data.filter((r) => r[0] === "Note").map((r) => r[1]).join(" | ");
  assert.match(notes, /3 row\(s\) without a valid Lead\/Handoff ID/);
  assert.match(notes, /1 row\(s\) repeat a Lead\/Handoff ID/);
});

test("Unique guests: the same phone in both tabs is one guest but two leads", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  lead(q, "New", { "Phone": "+919000000777" });
  lead(h, "Contacted", { "Phone": "+919000000777" });
  lead(h, "New", { "Phone": "" }); // no phone: not a guest count
  env.gs.generateConversionReport();
  const total = section(env, "By Source")["Total"];
  assert.equal(total["Total leads"], 3);
  assert.equal(total["Unique guests"], 1);
});

test("By Source: one row per Source (sandbox tests kept apart), sorted by total, plus a Total row", () => {
  const env = createEnv();
  const { q, h } = tabs(env);
  lead(q, "Booked");
  lead(q, "New");
  lead(h, "Contacted");
  lead(q, "New", { "Source": "whatsapp-bot-sandbox" });
  lead(q, "Lost", { "Source": "" });
  env.gs.generateConversionReport();
  const sec = section(env, "By Source");
  assert.equal(sec["whatsapp-bot"]["Total leads"], 3);
  assert.equal(sec["whatsapp-bot"]["Booking conversion %"], "33.3%");
  assert.equal(sec["whatsapp-bot"]["Reached rate %"], "66.7%");
  assert.equal(sec["whatsapp-bot-sandbox"]["Total leads"], 1);
  assert.equal(sec["(none)"]["Lost"], 1);
  assert.equal(sec["Total"]["Total leads"], 5);
  const order = env.sheets.get("Conversion Report").data.map((r) => r[0]);
  assert.ok(order.indexOf("whatsapp-bot") < order.indexOf("whatsapp-bot-sandbox"));
});

test("By Ref: exact Ref rows with entry point, clicks by exact Ref, Click → Lead % approximate with N/A for no clicks", () => {
  const env = createEnv();
  const { q, h, c } = tabs(env);
  lead(q, "Booked", { "Ref": "W-PROP-studio-925" });
  lead(q, "Contacted", { "Ref": "W-PROP-studio-925" });
  lead(h, "New", { "Ref": "W-FLOATING" });
  lead(q, "New", { "Ref": "DIRECT" });
  for (let i = 0; i < 4; i++) click(c, "W-PROP-studio-925");
  for (let i = 0; i < 3; i++) click(c, "W-FLOATING");
  click(c, "W-PROP-studio-711"); // clicks but no lead yet
  click(c, "W-HOME-AVAILABILITY");
  click(c, "not a ref"); // ignored
  click(c, "");
  env.gs.generateConversionReport();
  const sec = section(env, "By Ref (website entry point)");
  const prop = sec["W-PROP-studio-925"];
  assert.equal(prop["Entry point"], "Property page");
  assert.equal(prop["Total leads"], 2);
  assert.equal(prop["WhatsApp clicks"], 4);
  assert.equal(prop["Click → Lead % (approx.)"], "50.0%");
  assert.equal(prop["Booking conversion %"], "50.0%");
  assert.equal(prop["Reached rate %"], "100.0%");
  assert.equal(sec["W-FLOATING"]["Entry point"], "Floating button");
  assert.equal(sec["W-FLOATING"]["Click → Lead % (approx.)"], "33.3%");
  assert.equal(sec["DIRECT"]["Entry point"], "Direct (no website Ref)");
  assert.equal(sec["DIRECT"]["WhatsApp clicks"], 0);
  assert.equal(sec["DIRECT"]["Click → Lead % (approx.)"], "N/A");
  const noLead = sec["W-PROP-studio-711"];
  assert.equal(noLead["Total leads"], 0);
  assert.equal(noLead["WhatsApp clicks"], 1);
  assert.equal(noLead["Click → Lead % (approx.)"], "0.0%");
  assert.equal(noLead["Booking conversion %"], "N/A");
  assert.equal(sec["W-HOME-AVAILABILITY"]["Entry point"], "Availability widget");
  // Total: all leads; click -> lead uses only leads that came from a website Ref (3) over all valid clicks (9).
  assert.equal(sec["Total"]["Entry point"], "All");
  assert.equal(sec["Total"]["Total leads"], 4);
  assert.equal(sec["Total"]["WhatsApp clicks"], 9);
  assert.equal(sec["Total"]["Click → Lead % (approx.)"], "33.3%");
});

test("no clicks at all: every Click → Lead % is N/A, nothing divides by zero", () => {
  const env = createEnv();
  const { q } = tabs(env);
  lead(q, "New", { "Ref": "W-CONTACT" });
  env.gs.generateConversionReport();
  const sec = section(env, "By Ref (website entry point)");
  assert.equal(sec["W-CONTACT"]["WhatsApp clicks"], 0);
  assert.equal(sec["W-CONTACT"]["Click → Lead % (approx.)"], "N/A");
  assert.equal(sec["Total"]["Click → Lead % (approx.)"], "N/A");
});

test("empty Sheet: report still builds; rates N/A; missing tabs are noted, not an error", () => {
  const env = createEnv();
  const summary = env.gs.generateConversionReport();
  assert.equal(summary.leads, 0);
  const total = section(env, "By Source")["Total"];
  assert.equal(total["Total leads"], 0);
  assert.equal(total["Booking conversion %"], "N/A");
  const notes = env.sheets.get("Conversion Report").data.filter((r) => r[0] === "Note").map((r) => r[1]).join(" | ");
  assert.match(notes, /Qualified Leads tab is missing/);
  assert.match(notes, /Handoffs tab is missing/);
  assert.match(notes, /WhatsApp Clicks tab is missing/);
});

// ======================================================================
// Safety
// ======================================================================

test("read-only on leads and clicks: no lead/click cell changes, no email, no trigger, no other tab touched", () => {
  const env = createEnv();
  const { q, h, c } = tabs(env);
  lead(q, "New", { "Ref": "W-FLOATING" });
  lead(h, "Booked");
  click(c, "W-FLOATING");
  const before = JSON.stringify([q.data, h.data, c.data]);
  env.gs.generateConversionReport();
  assert.equal(JSON.stringify([q.data, h.data, c.data]), before);
  assert.equal(env.mails.length, 0);
  assert.equal(env.triggers.length, 0);
  assert.deepEqual(Array.from(env.sheets.keys()).sort(), ["Conversion Report", "Handoffs", "Qualified Leads", "WhatsApp Clicks"]);
  assert.equal(env.store.LAST_FOLLOW_UP_DIGEST, undefined);
});

test("re-running rebuilds the report: same data gives the same report, and stale rows disappear", () => {
  const env = createEnv();
  const { q } = tabs(env);
  lead(q, "New", { "Ref": "W-FLOATING" });
  const extra = lead(q, "New", { "Ref": "W-CONTACT" });
  env.gs.generateConversionReport();
  const first = JSON.stringify(env.sheets.get("Conversion Report").data);
  env.gs.generateConversionReport();
  assert.equal(JSON.stringify(env.sheets.get("Conversion Report").data), first);
  // Delete the W-CONTACT lead row: the next report is one row shorter and must not keep the old last row.
  q.deleteRow(q.data.findIndex((row) => row[1] === extra) + 1);
  env.gs.generateConversionReport();
  const sec = section(env, "By Ref (website entry point)");
  assert.equal(sec["W-CONTACT"], undefined);
  assert.equal(sec["Total"]["Total leads"], 1);
  const data = env.sheets.get("Conversion Report").data;
  assert.ok(!data.some((row) => row[0] === "W-CONTACT"));
  assert.equal(data.filter((row) => row[0] === "Total").length, 2); // one per section, no leftovers
  assert.equal(data[data.length - 1][0], "Total"); // nothing below the last section
});

test("refuses to overwrite a Conversion Report tab it did not create; an empty one is reused", () => {
  const env = createEnv();
  tabs(env);
  const mine = env.spreadsheet.insertSheet("Conversion Report");
  mine.appendRow(["My own notes", "keep this"]);
  assert.throws(() => env.gs.generateConversionReport(), /already exists and was not created by this script/);
  assert.equal(mine.cell(1, 1), "My own notes");
  assert.equal(mine.cell(1, 2), "keep this");

  const env2 = createEnv();
  tabs(env2);
  env2.spreadsheet.insertSheet("Conversion Report"); // empty tab made by hand
  env2.gs.generateConversionReport();
  assert.equal(env2.sheets.get("Conversion Report").cell(1, 1), "Conversion Report");
});

test("text from the Sheet is never written back as a formula", () => {
  const env = createEnv();
  const { q } = tabs(env);
  lead(q, "New", { "Source": "=HYPERLINK(\"http://x\",\"y\")" });
  env.gs.generateConversionReport();
  const cells = env.sheets.get("Conversion Report").data.map((r) => r[0]);
  assert.ok(cells.includes("'=HYPERLINK(\"http://x\",\"y\")"));
  assert.ok(!cells.some((v) => typeof v === "string" && v.startsWith("=")));
});

test("log summary holds counts only", () => {
  const env = createEnv();
  const { q, c } = tabs(env);
  lead(q, "New", { "Phone": "+919000000123", "Ref": "W-FLOATING" });
  click(c, "W-FLOATING");
  const s = env.gs.generateConversionReport();
  assert.equal(JSON.stringify(s), JSON.stringify({ version: env.gs.BOT_CODE_VERSION, generatedAt: IST_NOW, leads: 1, qualified: 1,
    handoffs: 0, sources: 1, refs: 1, clicks: 1, skippedNoId: 0, duplicateIds: 0 }));
  assert.doesNotMatch(JSON.stringify(s), /\+91|L-0/);
});

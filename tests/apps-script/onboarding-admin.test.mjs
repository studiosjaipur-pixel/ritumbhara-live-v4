// Onboarding admin (apps-script/onboarding/Admin.gs) + its hooks in apps-script/onboarding/Code.gs.
// Runs the real .gs files in a Node sandbox with small fakes of Sheets, Drive, Docs, Mail, Cache, Lock, Properties.
// Run: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, createHmac, randomUUID } from "node:crypto";
import vm from "node:vm";

const DIR = new URL("../../apps-script/onboarding/", import.meta.url);
const CODE = readFileSync(new URL("Code.gs", DIR), "utf8") + "\n" + readFileSync(new URL("Admin.gs", DIR), "utf8");
const ADMIN_KEY = "test-admin-key-0123456789abcdef";
const TEMPLATE = [
  "SERVICE LEVEL AGREEMENT",
  "This agreement is made on the {{START_DAY}} day of {{START_MONTH_YEAR}} between {{OWNER_NAME}} (PAN {{OWNER_PAN}}), the Asset Owner,",
  "for the {{PROPERTY_TYPE}} known as {{PROPERTY_NAME}} at {{PROPERTY_ADDRESS}}.",
  "Revenue share: 70% to the Asset Owner. Term until {{END_DATE}}.",
  "Payouts to {{ACCOUNT_HOLDER}}, {{BANK_NAME}}, A/c {{ACCOUNT_NUMBER}}, IFSC {{IFSC}}.",
  "Asset Owner: {{OWNER_SIGNATURE}} Date: {{OWNER_SIGN_DATE}}",
  "Management Entity: {{COMPANY_SIGNATURE}} Date: {{COMPANY_SIGN_DATE}}"
];

// ---------------------------------------------------------------- fakes

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function formatDate(date, tz, pattern) {
  const d = new Date(date.getTime() + (tz === "Asia/Kolkata" ? 330 : 0) * 60000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const t = { yyyy: p(d.getUTCFullYear(), 4), MMMM: MONTHS[d.getUTCMonth()], MMM: MONTHS[d.getUTCMonth()].slice(0, 3), MM: p(d.getUTCMonth() + 1),
    dd: p(d.getUTCDate()), d: String(d.getUTCDate()), HH: p(d.getUTCHours()), mm: p(d.getUTCMinutes()), ss: p(d.getUTCSeconds()) };
  return pattern.replace(/yyyy|MMMM|MMM|MM|dd|d|HH|mm|ss/g, (k) => t[k]);
}
const toBytes = (buf) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));

function createEnv({ digio = false } = {}) {
  let clock = Date.parse("2026-10-26T05:30:00Z");
  const tick = () => (clock += 1000);
  const props = { ADMIN_KEY, AGREEMENT_TEMPLATE_ID: "TEMPLATEDOC0000000000000000000", OTP_SECRET: "otp-secret" };
  if (digio) Object.assign(props, { DIGIO_CLIENT_ID: "x", DIGIO_CLIENT_SECRET: "y" });
  const cache = new Map();
  const mails = [];
  const files = new Map(); // id -> file
  const folders = new Map();
  let idn = 0;
  const newId = (p) => (p + String(++idn).padStart(4, "0")).padEnd(30, "x");

  function folder(id, name) {
    const f = { id, name, kids: [], getId: () => id, getName: () => name, getUrl: () => "https://drive.google.com/drive/folders/" + id,
      createFolder(n) { const c = folder(newId("FOLDER"), n); folders.set(c.id, c); return c; },
      createFile(a, b) {
        const blob = typeof a === "string" ? { name: a, bytes: [...Buffer.from(b || "")] } : { name: a.getName(), bytes: a.getBytes() };
        const fl = file(newId("FILE"), blob.name, null, f); fl.bytes = blob.bytes; return fl;
      },
      getFiles() { const list = [...files.values()].filter((x) => x.parent === f && !x.trashed); let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; },
      getFoldersByName() { return { hasNext: () => false }; }
    };
    return f;
  }
  function file(id, name, paras, parent) {
    const fl = { id, name, paras, parent, trashed: false, updated: clock,
      getId: () => id, getName: () => fl.name, getUrl: () => (paras ? "https://docs.google.com/document/d/" : "https://drive.google.com/file/d/") + id + "/edit",
      getLastUpdated: () => new Date(fl.updated),
      makeCopy(n, dest) { tick(); return file(newId("DOC"), n, fl.paras.slice(), dest); },
      setTrashed(v) { fl.trashed = v; },
      getParents() { let done = false; return { hasNext: () => !done, next: () => { done = true; return fl.parent; } }; },
      getAs() { const text = fl.paras.join("\n"); return blob([...Buffer.from(text)], "application/pdf", fl.name + ".pdf"); },
      getBlob() { return blob(fl.bytes || [], "application/octet-stream", fl.name); }
    };
    files.set(id, fl);
    return fl;
  }
  function blob(bytes, type, name) {
    const b = { getBytes: () => bytes, getName: () => name, setName(n) { name = n; return b; }, copyBlob: () => blob(bytes, type, name),
      setContentType() { return b; }, getDataAsString: () => Buffer.from(bytes).toString() };
    return b;
  }
  const root = folder("ROOTFOLDER0000000000000000000", "root");
  const apps = folder("1zm6bAUmVXHonREEOIPg6BX44B8Tf4QPj", "Applications"); folders.set(apps.id, apps);
  file(props.AGREEMENT_TEMPLATE_ID, "Template", TEMPLATE.slice(), root);

  function docBody(fl) {
    const chain = () => { const c = { setHeading: () => c, setAlignment: () => c, editAsText: () => c, setBold: () => c, setFontSize: () => c, setItalic: () => c }; return c; };
    return {
      getNumChildren: () => fl.paras.length,
      getChild: (i) => ({ getType: () => "PARAGRAPH", asParagraph: () => ({ getText: () => fl.paras[i], getHeading: () => "NORMAL",
        editAsText: () => ({ isBold: () => false }), getAlignment: () => "LEFT" }) }),
      replaceText(re, s) { const r = new RegExp(re, "g"); fl.paras = fl.paras.map((p) => p.replace(r, s)); },
      appendParagraph(t) { fl.paras.push(t); return chain(); },
      appendPageBreak() {}
    };
  }

  // Sheets
  const sheets = new Map();
  function sheet(name) {
    const data = [];
    const sh = { name, data,
      getName: () => name,
      getLastRow() { for (let r = data.length; r >= 1; r--) if ((data[r - 1] || []).some((v) => v !== "" && v != null)) return r; return 0; },
      getLastColumn() { let m = 0; data.forEach((row) => row.forEach((v, i) => { if (v !== "" && v != null) m = Math.max(m, i + 1); })); return m; },
      setFrozenRows() {},
      appendRow(vals) { data.length = sh.getLastRow(); data.push(vals.slice()); },
      getRange(r, c, nr = 1, nc = 1) {
        const set = (rr, cc, v) => { while (data.length < rr) data.push([]); const row = data[rr - 1]; while (row.length < cc) row.push(""); row[cc - 1] = v; };
        return {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = (data[r - 1 + i] || [])[c - 1 + j]; return v === undefined ? "" : v; })),
          getValue: () => { const v = (data[r - 1] || [])[c - 1]; return v === undefined ? "" : v; },
          setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => set(r + i, c + j, v))); return this; },
          setValue(v) { set(r, c, v); return this; },
          setNumberFormat() { return this; }
        };
      }
    };
    sheets.set(name, sh);
    return sh;
  }
  sheet("Sheet1");
  const ss = { getSheetByName: (n) => sheets.get(n) || null, getSheets: () => [...sheets.values()], insertSheet: (n) => sheet(n) };

  const sandbox = {
    console: { log() {}, warn() {}, error: (...a) => process.env.GS_DEBUG && process.stderr.write(a.join(" ") + "\n") }, JSON, Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(clock); } static now() { return clock; } },
    Math, String, Number, Object, Array, RegExp, Error, encodeURIComponent,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ss },
    MailApp: { sendEmail: (m) => mails.push(m) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@script.test" }) },
    ScriptApp: { getService: () => ({ getUrl: () => "https://script.google.com/macros/s/TEST/exec" }) },
    ContentService: { createTextOutput: (t) => ({ setMimeType() { return this; }, getContent: () => t }), MimeType: { JSON: "json" } },
    MimeType: { PDF: "application/pdf" },
    DriveApp: {
      getFileById(id) { const f = files.get(id); if (!f) throw new Error("no file " + id); return f; },
      getFolderById(id) { const f = folders.get(id); if (!f) throw new Error("no folder " + id); return f; },
      getRootFolder: () => root
    },
    DocumentApp: {
      openById(id) { const fl = files.get(id); return { getBody: () => docBody(fl), saveAndClose() { fl.updated = tick(); } }; },
      ElementType: { PARAGRAPH: "PARAGRAPH", LIST_ITEM: "LIST_ITEM", TABLE: "TABLE" },
      ParagraphHeading: { TITLE: "TITLE", HEADING1: "HEADING1", NORMAL: "NORMAL", SUBTITLE: "SUBTITLE" },
      HorizontalAlignment: { CENTER: "CENTER", LEFT: "LEFT" }
    },
    Utilities: {
      getUuid: () => randomUUID(),
      formatDate,
      computeDigest: (alg, v) => toBytes(createHash("sha256").update(typeof v === "string" ? v : Buffer.from(v.map((b) => b & 255))).digest()),
      computeHmacSha256Signature: (v, k) => toBytes(createHmac("sha256", k).update(v).digest()),
      DigestAlgorithm: { SHA_256: "SHA_256" },
      base64Decode: (s) => toBytes(Buffer.from(s, "base64")),
      base64Encode: (b) => (typeof b === "string" ? Buffer.from(b) : Buffer.from(b.map((x) => x & 255))).toString("base64"),
      newBlob: (bytes, type, name) => blob(bytes, type, name)
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(CODE, sandbox);
  // Docs image placement isn't faked; swap in a version that checks the placeholder and marks where the image went.
  vm.runInContext(`insertSignature_ = function (body, placeholder) {
    body.replaceText(placeholder.replace(/[{}]/g, '\\\\$&'), '[SIGNATURE IMAGE]');
  };`, sandbox);

  const post = (body) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  const admin = (body) => post(Object.assign({ adminKey: ADMIN_KEY, adminName: "Shivam" }, body));
  return { sandbox, post, admin, files, folders, sheets, mails, props, editDoc(url, fn) { const fl = files.get(url.match(/[-\w]{25,}/)[0]); fl.paras = fn(fl.paras); fl.updated = tick(); }, tick };
}

const OWNER = {
  partnershipModel: "FOCO", ownerName: "Rakesh Sharma", ownerPhone: "+919876543210", ownerEmail: "Rakesh@Example.com",
  ownerPan: "abcde1234f", ownerAddress: "12 MI Road, Jaipur", propName: "Aravali Villa", propCity: "Alwar", propCityOther: "",
  propAddress: "Jeerota", propType: "Villa", propRooms: "4", propAmenities: "Pool", propStatus: "Vacant / ready to operate",
  bankName: "HDFC Bank", bankAccName: "Rakesh Sharma", bankAccNo: "0012345678", bankIfsc: "hdfc0001234", bankUpi: ""
};
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function otpToken(env, email) {
  env.post({ action: "sendOtp", email, name: "Rakesh" });
  const code = env.mails.at(-1).htmlBody.match(/>(\d{6})</)[1];
  return env.post({ action: "verifyOtp", email, code }).otpToken;
}
function ownerSubmission(env, invite, extra = {}) {
  const d = invite.data;
  return Object.assign({
    reference: invite.reference, partnershipModel: d.partnershipModel, ownerName: d.ownerName, phone: d.ownerPhone, email: d.ownerEmail,
    pan: d.ownerPan, ownerAddress: d.ownerAddress, propertyName: d.propName, city: d.propCity, propertyType: d.propType,
    bedrooms: d.propRooms, status: d.propStatus, amenities: d.propAmenities, propertyAddress: d.propAddress,
    accountHolder: d.bankAccName, bank: d.bankName, accountNumber: d.bankAccNo, ifsc: d.bankIfsc, upi: d.bankUpi,
    documents: "photos", files: [{ name: "Property photographs - front.jpg", mimeType: "image/jpeg", data: PNG }],
    signature: { name: d.ownerName, image: PNG, signedAt: "now", userAgent: "test" },
    otpToken: otpToken(env, d.ownerEmail), formVersion: 2, inviteToken: invite.token, inviteVersion: invite.version
  }, extra);
}
function mainRow(env, ref) {
  const sh = env.sheets.get("Sheet1");
  const head = sh.data[0];
  const row = sh.data.find((r) => r[head.indexOf("Reference")] === ref);
  return row && Object.fromEntries(head.map((h, i) => [h, row[i]]));
}
function prepared(env) {
  const saved = env.admin({ action: "adminSave", data: OWNER, notes: "met at site" });
  const prep = env.admin({ action: "adminPrepareAgreement", token: saved.item.token });
  return { token: saved.item.token, saved, prep };
}

// ---------------------------------------------------------------- tests

test("admin actions need the right key", () => {
  const env = createEnv();
  assert.equal(env.post({ action: "adminList", adminKey: "wrong" }).error, "unauthorized");
  assert.equal(env.post({ action: "adminList" }).error, "unauthorized");
  assert.equal(env.admin({ action: "adminPing" }).ok, true);
  delete env.props.ADMIN_KEY;
  assert.match(env.admin({ action: "adminPing" }).error, /ADMIN_KEY is not set/);
});

test("save creates a row and an application folder; prepare makes a draft doc with details filled and dates/signatures left", () => {
  const env = createEnv();
  const { token, saved, prep } = prepared(env);
  assert.equal(saved.ok, true);
  assert.match(saved.item.reference, /^RTB-A\d{7}$/);
  assert.equal(saved.item.status, "Draft");
  assert.equal(saved.data.ownerEmail, "rakesh@example.com");
  assert.ok([...env.folders.values()].some((f) => f.name.startsWith(saved.item.reference + " — Rakesh Sharma — Aravali Villa")));
  assert.equal(prep.ok, true, JSON.stringify(prep));
  const draft = env.files.get(prep.item.draftUrl.match(/[-\w]{25,}/)[0]);
  const text = draft.paras.join("\n");
  assert.match(draft.name, /^DRAFT — Ritumbhara SLA — Aravali Villa — RTB-A/);
  assert.match(text, /between Rakesh Sharma \(PAN ABCDE1234F\)/);
  assert.match(text, /villa known as Aravali Villa at Jeerota, Alwar/);
  assert.match(text, /IFSC HDFC0001234/);
  for (const k of ["{{START_DAY}}", "{{END_DATE}}", "{{OWNER_SIGNATURE}}", "{{OWNER_SIGN_DATE}}", "{{COMPANY_SIGNATURE}}"]) assert.ok(text.includes(k), k);
  assert.match(prep.preview.html, /Rakesh Sharma/);
  assert.deepEqual([...prep.preview.missingPlaceholders], []);
  assert.equal(prep.preview.stale, false);
  assert.equal(env.admin({ action: "adminList" }).items[0].token, token);
});

test("draft goes stale when details change; missing signature placeholder is flagged", () => {
  const env = createEnv();
  const { token, prep } = prepared(env);
  const after = env.admin({ action: "adminSave", token, data: Object.assign({}, OWNER, { propRooms: "5" }) });
  assert.equal(after.preview.stale, true);
  env.editDoc(prep.item.draftUrl, (p) => p.map((x) => x.replace("{{OWNER_SIGNATURE}}", "")));
  assert.deepEqual([...env.admin({ action: "adminPreview", token }).preview.missingPlaceholders], ["{{OWNER_SIGNATURE}}"]);
});

test("invite link works only after sending, then the owner signs a copy of the team-edited draft", () => {
  const env = createEnv();
  const { token, prep } = prepared(env);
  assert.equal(env.post({ action: "getInvite", token }).error, "invalid_link"); // still a draft

  env.editDoc(prep.item.draftUrl, (p) => p.map((x) => x.replace("70%", "75%")));
  const sent = env.admin({ action: "adminSend", token, message: "As discussed on our call." });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.equal(sent.link, "https://www.ritumbhara.com/partner-onboarding.html?invite=" + token);
  const mail = env.mails.at(-1);
  assert.equal(mail.to, "rakesh@example.com");
  assert.ok(mail.htmlBody.includes(sent.link) && mail.htmlBody.includes("As discussed on our call."));

  const inv = env.post({ action: "getInvite", token });
  assert.equal(inv.ok, true);
  assert.match(inv.html, /75% to the Asset Owner/);
  assert.equal(inv.data.ownerName, "Rakesh Sharma");
  assert.equal(inv.signMode, "drawn");

  const res = env.post(ownerSubmission(env, Object.assign({ token }, inv), { ownerName: "Someone Else" }));
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.agreementStatus, "awaiting_countersignature");
  assert.equal(res.reference, inv.reference);

  const row = mainRow(env, inv.reference);
  assert.equal(row["Owner Name"], "Rakesh Sharma"); // the team's saved details win over what the page sent
  assert.equal(row["Agreement Status"], "Awaiting countersignature");
  const signed = env.files.get(row["Agreement Doc"].match(/[-\w]{25,}/)[0]);
  const text = signed.paras.join("\n");
  assert.match(text, /75% to the Asset Owner/); // the edit made in the draft
  assert.match(text, /\[SIGNATURE IMAGE\]/);
  assert.match(text, /made on the 26th day of October, 2026/); // dates filled on signing
  assert.match(text, /Term until 26\.10\.2031/);
  assert.ok(!/\{\{(START|END|OWNER)_/.test(text));
  assert.ok(text.includes("{{COMPANY_SIGNATURE}}")); // left for the countersign step
  // Same folder as the admin application, no new folder per submission.
  assert.equal(row["Documents Folder"], prep.item.folderUrl);
  assert.equal(signed.parent.getUrl(), prep.item.folderUrl);
  assert.ok([...env.files.values()].some((f) => f.name === "Property photographs - front.jpg" && f.parent.getUrl() === prep.item.folderUrl));
  // The draft itself is untouched.
  assert.ok(env.files.get(prep.item.draftUrl.match(/[-\w]{25,}/)[0]).paras.join().includes("{{OWNER_SIGNATURE}}"));

  const item = env.admin({ action: "adminList" }).items[0];
  assert.equal(item.status, "Submitted");
  assert.equal(item.agreementStatus, "Awaiting countersignature");
  assert.equal(env.post({ action: "getInvite", token }).error, "already_submitted");
  // A retry of the same submission returns the duplicate, not a second row.
  const again = env.post(ownerSubmission(env, Object.assign({ token }, inv)));
  assert.equal(again.duplicate, true);
  assert.equal(env.sheets.get("Sheet1").data.filter((r) => r.includes(inv.reference)).length, 1);
  // Locked after submission.
  assert.match(env.admin({ action: "adminSave", token, data: OWNER }).error, /already submitted/);
});

test("if the team edits the draft after the owner opened it, signing is refused until they reload", () => {
  const env = createEnv();
  const { token, prep } = prepared(env);
  env.admin({ action: "adminSend", token, sendEmail: false });
  const inv = env.post({ action: "getInvite", token });
  env.editDoc(prep.item.draftUrl, (p) => p.concat(["New clause added later."]));
  const res = env.post(ownerSubmission(env, Object.assign({ token }, inv)));
  assert.equal(res.error, "agreement_changed");
  assert.equal(mainRow(env, inv.reference), undefined);
  const fresh = env.post({ action: "getInvite", token });
  assert.match(fresh.html, /New clause added later/);
  assert.equal(env.post(ownerSubmission(env, Object.assign({ token }, fresh))).ok, true);
});

test("archived or unknown invites can't be used; a page can't point signing at another doc", () => {
  const env = createEnv();
  const { token } = prepared(env);
  env.admin({ action: "adminSend", token, sendEmail: false });
  const inv = env.post({ action: "getInvite", token });
  env.admin({ action: "adminArchive", token });
  assert.equal(env.post({ action: "getInvite", token }).error, "invalid_link");
  assert.equal(env.post(ownerSubmission(env, Object.assign({ token }, inv))).error, "invalid_link");
  assert.equal(env.post({ action: "getInvite", token: "f".repeat(64) }).error, "invalid_link");

  // Plain website submission trying to inject a source doc: ignored, the template is used.
  const otherDoc = [...env.files.values()].find((f) => f.name.startsWith("DRAFT"));
  const sub = ownerSubmission(env, Object.assign({ token: "" }, inv), { reference: "RTB-12345678", inviteToken: undefined, _agreementSourceId: otherDoc.id, _folderUrl: "https://drive.google.com/drive/folders/" + otherDoc.parent.id });
  const res = env.post(sub);
  assert.equal(res.ok, true, JSON.stringify(res));
  const row = mainRow(env, "RTB-12345678");
  const signed = env.files.get(row["Agreement Doc"].match(/[-\w]{25,}/)[0]);
  assert.match(signed.paras.join("\n"), /70% to the Asset Owner/);
  assert.notEqual(row["Documents Folder"], "https://drive.google.com/drive/folders/" + otherDoc.parent.id);
});

test("normal website flow is unchanged: preview from the template", () => {
  const env = createEnv();
  const res = env.post({ action: "preview", data: { partnershipModel: "FOCO", ownerName: "Asha", propertyName: "Lake House", propertyType: "Homestay" } });
  assert.equal(res.ok, true);
  assert.match(res.html, /<b>homestay<\/b> known as <b>Lake House<\/b>/);
});

test("FOFO: no agreement to prepare, but the invite can still be sent and submitted", () => {
  const env = createEnv();
  const saved = env.admin({ action: "adminSave", data: Object.assign({}, OWNER, { partnershipModel: "FOFO" }) });
  const token = saved.item.token;
  assert.match(env.admin({ action: "adminPrepareAgreement", token }).error, /Only FOCO/);
  assert.equal(env.admin({ action: "adminSend", token, sendEmail: false }).ok, true);
  const inv = env.post({ action: "getInvite", token });
  assert.equal(inv.html, "");
  const sub = ownerSubmission(env, Object.assign({ token }, inv), { signature: undefined, otpToken: undefined });
  const res = env.post(sub);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.agreementStatus, "none");
});

test("Aadhaar mode: the Digio PDF is built from the edited draft", () => {
  const env = createEnv({ digio: true });
  const uploads = [];
  env.sandbox.UrlFetchApp = { fetch: (url, opts) => { uploads.push(JSON.parse(opts.payload)); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ id: "DID123", signing_parties: [{ identifier: "rakesh@example.com", authentication_url: "https://ext.digio.in:444/#/gateway/login/DID123" }] }) }; } };
  const { token, prep } = prepared(env);
  env.editDoc(prep.item.draftUrl, (p) => p.map((x) => x.replace("70%", "80%")));
  env.admin({ action: "adminSend", token, sendEmail: false });
  const inv = env.post({ action: "getInvite", token });
  assert.equal(inv.signMode, "aadhaar");
  const res = env.post(ownerSubmission(env, Object.assign({ token }, inv), { signature: undefined, otpToken: undefined, agreementAccepted: true }));
  assert.equal(res.agreementStatus, "awaiting_owner_esign", JSON.stringify(res));
  const pdfText = Buffer.from(uploads[0].file_data, "base64").toString();
  assert.match(pdfText, /80% to the Asset Owner/);
  assert.match(pdfText, /Asset Owner: Aadhaar eSign/);
});

/**
 * Ritumbhara — Onboarding admin (team fills an application, finalises the agreement, sends it to the owner).
 *
 * Lives in the same Apps Script project as Code.gs (add it as a second file called "Admin").
 * The team works from https://www.ritumbhara.com/admin-onboarding.html.
 *
 * Flow
 *   1. The team fills the owner's details in the admin page and saves  -> a row in the "Admin Applications" tab and
 *      an application folder in the Applications folder (same place website applications go).
 *   2. "Prepare agreement" copies the agreement template into that folder as a DRAFT Google Doc with the owner's
 *      details filled in. The team edits it in Google Docs (any wording, clauses, commercials).
 *      Dates and signatures stay as {{PLACEHOLDERS}}: they are filled when the owner signs, exactly as today.
 *   3. "Send to owner" emails the owner a link: /partner-onboarding.html?invite=<token>. The owner sees their details
 *      (locked), uploads documents, reads the edited agreement and signs (drawn + OTP, or Aadhaar via Digio).
 *   4. handleSubmission_ (Code.gs) then signs a copy of the DRAFT instead of the template. Countersigning, Digio,
 *      executed PDF and emails are unchanged. If the draft was edited after the owner opened it, the submission is
 *      refused ("agreement_changed") so the owner always signs exactly what they read.
 *
 * Script Properties
 *   ADMIN_KEY       - required. The shared team key for the admin page (use 24+ random characters).
 *   ONBOARDING_URL  - optional. Defaults to https://www.ritumbhara.com/partner-onboarding.html
 */

var ADMIN_SHEET_NAME = 'Admin Applications';
var ADMIN_HEADERS = ['Token', 'Reference', 'Status', 'Created (IST)', 'Updated (IST)', 'Created By', 'Owner Name',
  'Owner Email', 'Owner Phone', 'Property Name', 'City', 'Partnership Model', 'Agreement Draft', 'Draft Details Key',
  'Folder', 'Notes', 'Sent (IST)', 'Sent By', 'Submitted (IST)', 'Data JSON'];
var ADMIN_STATUS = { DRAFT: 'Draft', SENT: 'Sent', SUBMITTED: 'Submitted', ARCHIVED: 'Archived' };
var ADMIN_DATE_KEYS = ['START_DATE', 'END_DATE', 'START_DAY', 'START_MONTH_YEAR', 'END_DATE_LONG', 'OWNER_SIGN_DATE'];
var ADMIN_DATA_FIELDS = ['partnershipModel', 'ownerName', 'ownerPhone', 'ownerEmail', 'ownerPan', 'ownerAddress',
  'propName', 'propCity', 'propCityOther', 'propAddress', 'propType', 'propRooms', 'propAmenities', 'propStatus',
  'bankName', 'bankAccName', 'bankAccNo', 'bankIfsc', 'bankUpi'];

// ---------------------------------------------------------------- router (called from doPost in Code.gs)

function handleAdmin_(b) {
  var auth = checkAdminKey_(b.adminKey);
  if (!auth.ok) return auth;
  var who = String(b.adminName || '').trim().slice(0, 60);
  switch (b.action) {
    case 'adminPing': return { ok: true };
    case 'adminList': return adminList_();
    case 'adminGet': return adminGet_(b.token);
    case 'adminSave': return adminSave_(b, who);
    case 'adminPrepareAgreement': return adminPrepareAgreement_(b.token, who);
    case 'adminPreview': return adminPreview_(b.token);
    case 'adminSend': return adminSend_(b, who);
    case 'adminArchive': return adminSetStatus_(b.token, ADMIN_STATUS.ARCHIVED);
    case 'adminRestore': return adminSetStatus_(b.token, ADMIN_STATUS.DRAFT);
  }
  return { ok: false, error: 'unknown_action' };
}

function checkAdminKey_(key) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('admin_fails') || 0);
  if (fails >= 20) return { ok: false, error: 'Too many wrong keys. Try again in 15 minutes.' };
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!real) return { ok: false, error: 'ADMIN_KEY is not set in Script Properties yet.' };
  if (!key || sha256Hex_(String(key)) !== sha256Hex_(real)) {
    cache.put('admin_fails', String(fails + 1), 900);
    return { ok: false, error: 'unauthorized' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------- admin actions

function adminList_() {
  var a = adminSheet_();
  var main = mainStatusByRef_();
  var items = adminRows_(a).map(function (r) {
    var m = main[r['Reference']] || {};
    return adminItem_(r, m);
  });
  items.sort(function (x, y) { return String(y.updatedMs).localeCompare(String(x.updatedMs)); });
  return { ok: true, items: items };
}

function adminGet_(token) {
  var a = adminSheet_();
  var r = adminFind_(a, token);
  if (!r) return { ok: false, error: 'not_found' };
  var data = adminData_(r);
  var main = mainStatusByRef_()[r['Reference']] || {};
  return {
    ok: true,
    item: adminItem_(r, main),
    data: data,
    files: adminFiles_(r),
    preview: r['Agreement Draft'] ? draftPreview_(r, data) : null
  };
}

function adminSave_(b, who) {
  var d = cleanAdminData_(b.data || {});
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var a = adminSheet_();
    var r = b.token ? adminFind_(a, b.token) : null;
    if (b.token && !r) return { ok: false, error: 'not_found' };
    if (r && r['Status'] === ADMIN_STATUS.SUBMITTED) return { ok: false, error: 'The owner has already submitted this application, so it can’t be changed here.' };
    var now = new Date();
    var isNew = !r;
    if (isNew) {
      r = {
        _row: 0,
        'Token': Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''),
        'Reference': 'RTB-A' + String(now.getTime()).slice(-7),
        'Status': ADMIN_STATUS.DRAFT,
        'Created (IST)': fmt_(now, 'dd/MM/yyyy HH:mm:ss'),
        'Created By': who
      };
    }
    var folder = adminFolder_(r, d);
    (b.files || []).forEach(function (f) {
      if (!f || !f.data) return;
      folder.createFile(Utilities.newBlob(Utilities.base64Decode(f.data), f.mimeType || 'application/octet-stream',
        String(f.name || 'file').slice(0, 180)));
    });
    r['Updated (IST)'] = fmt_(now, 'dd/MM/yyyy HH:mm:ss');
    r['Owner Name'] = d.ownerName;
    r['Owner Email'] = d.ownerEmail;
    r['Owner Phone'] = d.ownerPhone;
    r['Property Name'] = d.propName;
    r['City'] = d.propCity === 'Other' ? d.propCityOther : d.propCity;
    r['Partnership Model'] = d.partnershipModel;
    r['Folder'] = folder.getUrl();
    r['Notes'] = String(b.notes || '').slice(0, 5000);
    r['Data JSON'] = JSON.stringify(d);
    adminWrite_(a, r);
  } finally {
    lock.releaseLock();
  }
  return adminGet_(r['Token']);
}

/** Creates (or re-creates) the draft agreement Google Doc from the template, filled with the saved details. */
function adminPrepareAgreement_(token, who) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var r;
  try {
    var a = adminSheet_();
    r = adminFind_(a, token);
    if (!r) return { ok: false, error: 'not_found' };
    if (r['Status'] === ADMIN_STATUS.SUBMITTED) return { ok: false, error: 'Already submitted by the owner.' };
    var d = adminData_(r);
    if (d.partnershipModel !== 'FOCO') return { ok: false, error: 'Only FOCO has an agreement template right now.' };
    var p = payloadFromAdminData_(d);
    var folder = adminFolder_(r, d);
    if (r['Agreement Draft']) {
      try { DriveApp.getFileById(idFromUrl_(r['Agreement Draft'])).setTrashed(true); } catch (err) { /* already gone */ }
    }
    var name = 'DRAFT — Ritumbhara SLA — ' + clean_(d.propName || 'Property') + ' — ' + r['Reference'];
    var file = DriveApp.getFileById(templateId_()).makeCopy(name, folder);
    var doc = DocumentApp.openById(file.getId());
    var v = buildValues_(p, new Date());
    ADMIN_DATE_KEYS.forEach(function (k) { delete v[k]; }); // dates are set on the day the owner signs
    fillPlaceholders_(doc.getBody(), v);
    doc.saveAndClose();
    r['Agreement Draft'] = file.getUrl();
    r['Draft Details Key'] = detailsKey_(d);
    r['Updated (IST)'] = fmt_(new Date(), 'dd/MM/yyyy HH:mm:ss');
    adminWrite_(a, r);
  } finally {
    lock.releaseLock();
  }
  return adminGet_(token);
}

function adminPreview_(token) {
  var r = adminFind_(adminSheet_(), token);
  if (!r) return { ok: false, error: 'not_found' };
  if (!r['Agreement Draft']) return { ok: false, error: 'No agreement prepared yet.' };
  return { ok: true, preview: draftPreview_(r, adminData_(r)) };
}

function adminSend_(b, who) {
  var a = adminSheet_();
  var r = adminFind_(a, b.token);
  if (!r) return { ok: false, error: 'not_found' };
  if (r['Status'] === ADMIN_STATUS.SUBMITTED) return { ok: false, error: 'Already submitted by the owner.' };
  var d = adminData_(r);
  var missing = adminMissing_(d);
  if (missing.length) return { ok: false, error: 'Missing: ' + missing.join(', ') };
  if (d.partnershipModel === 'FOCO' && !r['Agreement Draft']) return { ok: false, error: 'Prepare the agreement before sending.' };

  var link = onboardingUrl_() + '?invite=' + r['Token'];
  if (b.sendEmail !== false) {
    var first = String(d.ownerName || 'there').trim().split(/\s+/)[0];
    var msg = String(b.message || '').trim().slice(0, 2000);
    MailApp.sendEmail({
      to: d.ownerEmail,
      name: 'Ritumbhara Partnerships',
      replyTo: teamEmails_().split(',')[0],
      subject: d.partnershipModel === 'FOCO'
        ? 'Your Ritumbhara partnership agreement is ready to sign (' + r['Reference'] + ')'
        : 'Your Ritumbhara onboarding application (' + r['Reference'] + ')',
      htmlBody: '<p>Hi ' + esc_(first) + ',</p>' +
        (msg ? '<p>' + esc_(msg).replace(/\n/g, '<br>') + '</p>' : '<p>We’ve filled in your onboarding details for <b>' +
          esc_(d.propName) + '</b>' + (d.partnershipModel === 'FOCO' ? ' and prepared your partnership agreement' : '') + '.</p>') +
        '<p>Please check your details, upload any pending documents' +
        (d.partnershipModel === 'FOCO' ? ', then read and sign the agreement' : ' and submit') + ':</p>' +
        '<p><a href="' + link + '" style="background:#BF2542;color:#fff;padding:10px 18px;text-decoration:none;border-radius:2px">' +
        (d.partnershipModel === 'FOCO' ? 'Review and sign' : 'Review and submit') + '</a></p>' +
        '<p>If anything looks wrong, just reply to this email before signing.</p><p>Reference: ' + esc_(r['Reference']) +
        '</p><p>— Team Ritumbhara</p>'
    });
  }
  r['Status'] = ADMIN_STATUS.SENT;
  r['Sent (IST)'] = fmt_(new Date(), 'dd/MM/yyyy HH:mm:ss');
  r['Sent By'] = who;
  r['Updated (IST)'] = r['Sent (IST)'];
  adminWrite_(a, r);
  return { ok: true, link: link, item: adminItem_(r, {}) };
}

function adminSetStatus_(token, status) {
  var a = adminSheet_();
  var r = adminFind_(a, token);
  if (!r) return { ok: false, error: 'not_found' };
  if (r['Status'] === ADMIN_STATUS.SUBMITTED) return { ok: false, error: 'Already submitted by the owner.' };
  r['Status'] = status;
  r['Updated (IST)'] = fmt_(new Date(), 'dd/MM/yyyy HH:mm:ss');
  adminWrite_(a, r);
  return { ok: true, item: adminItem_(r, {}) };
}

// ---------------------------------------------------------------- owner side (public)

/** The owner's invite link loads this: their details + the edited agreement. */
function getInvite_(token) {
  var r = /^[a-f0-9]{64}$/.test(String(token || '')) ? adminFind_(adminSheet_(), token) : null;
  if (!r || r['Status'] === ADMIN_STATUS.DRAFT || r['Status'] === ADMIN_STATUS.ARCHIVED) return { ok: false, error: 'invalid_link' };
  if (r['Status'] === ADMIN_STATUS.SUBMITTED) return { ok: false, error: 'already_submitted', reference: r['Reference'] };
  var d = adminData_(r);
  var out = { ok: true, reference: r['Reference'], data: d, html: '', version: '', signMode: digioOn_() ? 'aadhaar' : 'drawn' };
  if (d.partnershipModel === 'FOCO') {
    var pv = draftPreview_(r, d);
    out.html = pv.html;
    out.version = pv.version;
  }
  return out;
}

/**
 * Called by handleSubmission_ when the page sends inviteToken. Returns { ok, p } where p has the owner's details
 * replaced by the ones the team saved (the page locks them anyway), the invite's reference, and the draft doc to sign.
 */
function inviteSubmission_(p) {
  var a = adminSheet_();
  var r = /^[a-f0-9]{64}$/.test(String(p.inviteToken || '')) ? adminFind_(a, p.inviteToken) : null;
  if (!r || r['Status'] === ADMIN_STATUS.DRAFT || r['Status'] === ADMIN_STATUS.ARCHIVED) return { ok: false, error: 'invalid_link' };
  var d = adminData_(r);
  var out = Object.assign({}, p, payloadFromAdminData_(d), { reference: r['Reference'] });
  if (r['Status'] === ADMIN_STATUS.SUBMITTED) return { ok: true, p: out, row: r, already: true }; // retry: Code.gs returns the duplicate
  if (d.partnershipModel === 'FOCO') {
    if (!r['Agreement Draft']) return { ok: false, error: 'invalid_link' };
    var draftId = idFromUrl_(r['Agreement Draft']);
    if (String(DriveApp.getFileById(draftId).getLastUpdated().getTime()) !== String(p.inviteVersion || '')) {
      return { ok: false, error: 'agreement_changed' };
    }
    out._agreementSourceId = draftId;
  }
  out._folderUrl = r['Folder'];
  return { ok: true, p: out, row: r };
}

function markInviteSubmitted_(token) {
  var a = adminSheet_();
  var r = adminFind_(a, token);
  if (!r) return;
  r['Status'] = ADMIN_STATUS.SUBMITTED;
  r['Submitted (IST)'] = fmt_(new Date(), 'dd/MM/yyyy HH:mm:ss');
  r['Updated (IST)'] = r['Submitted (IST)'];
  adminWrite_(a, r);
}

// ---------------------------------------------------------------- helpers

function draftPreview_(r, d) {
  var id = idFromUrl_(r['Agreement Draft']);
  var file = DriveApp.getFileById(id);
  var blocks = docBlocks_(id);
  var html = renderBlocks_(blocks, buildValues_(payloadFromAdminData_(d), new Date()));
  var raw = JSON.stringify(blocks);
  // Placeholders the signing step needs. If the team deletes one, signing would fail, so the admin page warns.
  var needed = digioOn_() ? [] : ['{{OWNER_SIGNATURE}}', '{{COMPANY_SIGNATURE}}'];
  var left = (raw.match(/\{\{[A-Z_]+\}\}/g) || []).filter(function (x) {
    var k = x.slice(2, -2);
    return !/SIGNATURE$|SIGN_DATE$/.test(k) && ADMIN_DATE_KEYS.indexOf(k) === -1;
  });
  return {
    html: html,
    version: String(file.getLastUpdated().getTime()),
    docUrl: r['Agreement Draft'],
    stale: !!r['Draft Details Key'] && r['Draft Details Key'] !== detailsKey_(d),
    leftovers: left.filter(function (x, i) { return left.indexOf(x) === i; }),
    missingPlaceholders: needed.filter(function (x) { return raw.indexOf(x) === -1; })
  };
}

/** Same field mapping as previewPayload() in partner-onboarding.html. */
function payloadFromAdminData_(d) {
  return {
    partnershipModel: d.partnershipModel || '',
    ownerName: d.ownerName || '', phone: d.ownerPhone || '', email: d.ownerEmail || '', pan: d.ownerPan || '',
    ownerAddress: d.ownerAddress || '',
    propertyName: d.propName || '', city: d.propCity === 'Other' ? (d.propCityOther || '') : (d.propCity || ''),
    propertyType: d.propType || '', bedrooms: d.propRooms || '', status: d.propStatus || '',
    amenities: d.propAmenities || '', propertyAddress: d.propAddress || '',
    accountHolder: d.bankAccName || '', bank: d.bankName || '', accountNumber: d.bankAccNo || '', ifsc: d.bankIfsc || '',
    upi: d.bankUpi || ''
  };
}

function cleanAdminData_(raw) {
  var d = {};
  ADMIN_DATA_FIELDS.forEach(function (k) { d[k] = String(raw[k] === undefined || raw[k] === null ? '' : raw[k]).slice(0, 1000).trim(); });
  if (d.partnershipModel !== 'FOCO' && d.partnershipModel !== 'FOFO') d.partnershipModel = '';
  d.ownerEmail = normEmail_(d.ownerEmail);
  return d;
}

function adminMissing_(d) {
  var req = [['partnershipModel', 'Partnership model'], ['ownerName', 'Owner name'], ['ownerPhone', 'Phone'],
    ['ownerEmail', 'Email'], ['ownerPan', 'PAN'], ['ownerAddress', 'Owner address'], ['propName', 'Property name'],
    ['propCity', 'City'], ['propAddress', 'Property address'], ['propType', 'Property type'], ['propRooms', 'Bedrooms'],
    ['propStatus', 'Property status'], ['bankAccName', 'Account holder'], ['bankName', 'Bank'],
    ['bankAccNo', 'Account number'], ['bankIfsc', 'IFSC']];
  var out = req.filter(function (x) { return !d[x[0]]; }).map(function (x) { return x[1]; });
  if (d.propCity === 'Other' && !d.propCityOther) out.push('City name');
  if (d.ownerEmail && !validEmail_(d.ownerEmail)) out.push('a valid email');
  return out;
}

function detailsKey_(d) { return sha256Hex_(JSON.stringify(payloadFromAdminData_(d))).slice(0, 16); }

function onboardingUrl_() {
  return PropertiesService.getScriptProperties().getProperty('ONBOARDING_URL') || 'https://www.ritumbhara.com/partner-onboarding.html';
}

function adminFolder_(r, d) {
  if (r['Folder']) {
    try { return DriveApp.getFolderById(idFromUrl_(r['Folder'])); } catch (err) { /* recreate below */ }
  }
  var parent = DriveApp.getFolderById(cfg_('APPLICATIONS_FOLDER_ID'));
  var f = parent.createFolder(r['Reference'] + ' — ' + clean_(d.ownerName || 'Owner') + ' — ' + clean_(d.propName || 'Property'));
  r['Folder'] = f.getUrl();
  return f;
}

function adminFiles_(r) {
  if (!r['Folder']) return [];
  var out = [];
  try {
    var draftId = r['Agreement Draft'] ? idFromUrl_(r['Agreement Draft']) : '';
    var it = DriveApp.getFolderById(idFromUrl_(r['Folder'])).getFiles();
    while (it.hasNext()) {
      var f = it.next();
      if (f.getId() !== draftId) out.push({ name: f.getName(), url: f.getUrl() });
    }
  } catch (err) { /* folder removed */ }
  return out;
}

function adminItem_(r, m) {
  return {
    token: r['Token'], reference: r['Reference'], status: r['Status'], ownerName: r['Owner Name'],
    ownerEmail: r['Owner Email'], ownerPhone: r['Owner Phone'], propertyName: r['Property Name'], city: r['City'],
    model: r['Partnership Model'], createdBy: r['Created By'], created: r['Created (IST)'], updated: r['Updated (IST)'],
    updatedMs: istToSortable_(r['Updated (IST)']), sent: r['Sent (IST)'], sentBy: r['Sent By'],
    submitted: r['Submitted (IST)'], notes: r['Notes'], folderUrl: r['Folder'], draftUrl: r['Agreement Draft'],
    agreementStatus: m.status || '', ownerSignedPdf: m.ownerPdf || '', executedPdf: m.executedPdf || ''
  };
}

function istToSortable_(s) {
  var m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  return m ? m[3] + m[2] + m[1] + m[4] + m[5] + m[6] : '';
}

/** Agreement status of website/invite submissions, by reference, from the main applications sheet. */
function mainStatusByRef_() {
  var sh = sheet_();
  var cols = ensureHeaders_(sh);
  var last = sh.getLastRow();
  var out = {};
  if (last < 2) return out;
  var width = sh.getLastColumn();
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  vals.forEach(function (row) {
    var ref = String(row[cols['Reference'] - 1] || '');
    if (ref.indexOf('RTB-A') !== 0) return;
    out[ref] = {
      status: String(row[cols['Agreement Status'] - 1] || ''),
      ownerPdf: String(row[cols['Owner-signed PDF'] - 1] || ''),
      executedPdf: String(row[cols['Executed PDF'] - 1] || '')
    };
  });
  return out;
}

function adminSheet_() {
  var ss = SpreadsheetApp.openById(cfg_('SHEET_ID'));
  var sh = ss.getSheetByName(ADMIN_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(ADMIN_SHEET_NAME);
    sh.getRange(1, 1, 1, ADMIN_HEADERS.length).setValues([ADMIN_HEADERS]);
    sh.setFrozenRows(1);
  }
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  ADMIN_HEADERS.forEach(function (h) {
    if (head.indexOf(h) === -1) { head.push(h); sh.getRange(1, head.length).setValue(h); }
  });
  return { sh: sh, head: head };
}

function adminRows_(a) {
  var last = a.sh.getLastRow();
  if (last < 2) return [];
  var vals = a.sh.getRange(2, 1, last - 1, a.head.length).getValues();
  return vals.map(function (row, i) {
    var o = { _row: i + 2 };
    a.head.forEach(function (h, j) { o[h] = row[j] instanceof Date ? fmt_(row[j], 'dd/MM/yyyy HH:mm:ss') : String(row[j] === undefined ? '' : row[j]); });
    return o;
  }).filter(function (o) { return o['Token']; });
}

function adminFind_(a, token) {
  if (!token) return null;
  var rows = adminRows_(a);
  for (var i = 0; i < rows.length; i++) if (rows[i]['Token'] === String(token)) return rows[i];
  return null;
}

function adminData_(r) {
  try { return cleanAdminData_(JSON.parse(r['Data JSON'] || '{}')); } catch (err) { return cleanAdminData_({}); }
}

function adminWrite_(a, r) {
  var vals = a.head.map(function (h) { return r[h] === undefined || r[h] === null ? '' : String(r[h]); });
  var row = r._row || a.sh.getLastRow() + 1;
  var range = a.sh.getRange(row, 1, 1, vals.length);
  range.setNumberFormat('@'); // keep phones, dates and JSON as plain text
  range.setValues([vals]);
  r._row = row;
}

/**
 * Ritumbhara — Asset Owner Onboarding web app, with an e-signed partnership agreement (SLA).
 *
 * The website's /partner-onboarding.html posts to this web app.
 *
 *   1. action "preview"  -> returns the agreement, filled with the owner's details, for the owner to read.
 *   2. submission        -> saves the row + documents (as before). For FOCO with a signature it also:
 *                           copies the agreement template into the application folder, fills it in,
 *                           places the owner's signature, exports "(owner signed).pdf",
 *                           emails the team a countersign link, and emails the owner an acknowledgement.
 *   3. countersign page  -> (doGet ?action=countersign&ref=..&t=..) the team signs; the script places the
 *                           company signature, exports "(executed).pdf", emails it to the owner and the team,
 *                           and marks the row "Executed".
 *
 * Aadhaar eSign (Digio): once DIGIO_CLIENT_ID and DIGIO_CLIENT_SECRET are set, FOCO agreements are signed with
 * Aadhaar OTP instead of a drawn signature. The filled agreement PDF is sent to Digio with two signers in order:
 * the owner, then Ritumbhara (DIGIO_COMPANY_SIGNER). The owner is sent straight to Digio's signing page from the
 * website; Digio emails Ritumbhara's signer after the owner signs. When both have signed (Digio webhook, or the
 * 30-minute sync), the signed PDF is saved, emailed to the owner and the team, and the row is marked "Executed".
 * Without the Digio keys, the drawn-signature + countersign-page flow above is used.
 *
 * FOFO applications have no template yet: they are saved and emailed to the team as before (no signing).
 *
 * One-time setup: run setupAgreementTemplate() from the editor (see README.md in this folder).
 *
 * Script Properties (all optional; defaults below):
 *   SHEET_ID, SHEET_NAME, APPLICATIONS_FOLDER_ID, SAMPLE_AGREEMENT_ID,
 *   AGREEMENT_TEMPLATE_ID  - set automatically by setupAgreementTemplate()
 *   TEAM_EMAILS            - comma-separated; defaults to shivam@ritumbhara.com
 *   WEB_APP_URL            - only if the countersign link in emails is wrong (defaults to this deployment's URL)
 *   DIGIO_CLIENT_ID, DIGIO_CLIENT_SECRET - from the Digio dashboard; turn on Aadhaar eSign
 *   DIGIO_ENV              - "sandbox" (default) or "production"
 *   DIGIO_COMPANY_SIGNER   - email of the person who signs for Ritumbhara; defaults to shivam@ritumbhara.com
 *   DIGIO_COMPANY_SIGNER_NAME - defaults to "Shivam Lohiya"
 */

var DEFAULTS = {
  SHEET_ID: '1LpcbRxep-l52UlGzJ5RzlWwnFWaXAM9LhFPoKvIR5KU',
  SHEET_NAME: 'Sheet1',
  APPLICATIONS_FOLDER_ID: '1zm6bAUmVXHonREEOIPg6BX44B8Tf4QPj',
  SAMPLE_AGREEMENT_ID: '1-z6ZYlg8bjZrELFvIXO0teuD2ny5ea7WiRws3DNHjQY',
  AGREEMENT_TEMPLATE_ID: '',
  TEAM_EMAILS: 'shivam@ritumbhara.com',
  WEB_APP_URL: '',
  DIGIO_CLIENT_ID: '',
  DIGIO_CLIENT_SECRET: '',
  DIGIO_ENV: 'sandbox',
  DIGIO_COMPANY_SIGNER: 'shivam@ritumbhara.com',
  DIGIO_COMPANY_SIGNER_NAME: 'Shivam Lohiya'
};
var TZ = 'Asia/Kolkata';
var TERM_YEARS = 5;
var COMPANY_SIGNATORY = 'Shivam Lohiya, Director, LilacMosaic Technologies Pvt. Ltd.';

var BASE_HEADERS = ['Timestamp', 'Reference', 'Owner Name', 'Phone', 'Email', 'PAN', 'Owner Address', 'Property Name',
  'City', 'Property Type', 'Bedrooms', 'Status', 'Amenities', 'Property Address', 'Account Holder', 'Bank',
  'Account Number', 'IFSC', 'UPI', 'Documents Confirmed', 'Documents Folder'];
var AGREEMENT_HEADERS = ['Partnership Model', 'Agreement Status', 'Agreement Doc', 'Owner-signed PDF',
  'Owner Signed (IST)', 'Owner Typed Name', 'Countersigned (IST)', 'Countersigned By', 'Executed PDF', 'Agreement Token',
  'Sign Method', 'Digio Document ID', 'Owner Sign Link', 'Owner Aadhaar Name'];
var STATUS = {
  AWAITING: 'Awaiting countersignature',
  EXECUTED: 'Executed',
  NOT_SIGNED: 'Not signed',
  NO_TEMPLATE: 'No agreement (FOFO)',
  FAILED: 'Agreement generation failed',
  OWNER_AADHAAR: 'Awaiting owner Aadhaar eSign',
  COMPANY_AADHAAR: 'Awaiting Ritumbhara Aadhaar eSign',
  ESIGN_EXPIRED: 'Aadhaar eSign expired',
  ESIGN_FAILED: 'Aadhaar eSign failed or rejected'
};

// ---------------------------------------------------------------- web entry points

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }
  try {
    if (body && body.action === 'preview') return json_(previewAgreement_(body.data || {}));
    if (body && body.payload && body.payload.document) return json_(handleDigioWebhook_(body));
    return json_(handleSubmission_(body || {}));
  } catch (err) {
    console.error('doPost failed: ' + (err && err.stack || err));
    return json_({ ok: false, error: 'server_error' });
  }
}

function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.action === 'countersign') {
    var t = HtmlService.createTemplateFromFile('Countersign');
    t.ref = String(q.ref || '');
    t.token = String(q.t || '');
    t.info = countersignInfo_(t.ref, t.token);
    return t.evaluate()
      .setTitle('Countersign agreement — Ritumbhara')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return ContentService.createTextOutput('Ritumbhara onboarding endpoint');
}

// ---------------------------------------------------------------- preview

function previewAgreement_(d) {
  if (String(d.partnershipModel || '') !== 'FOCO') return { ok: false, error: 'no_template_for_model' };
  var v = buildValues_(d, new Date());
  var html = renderBlocks_(templateBlocks_(), v);
  return { ok: true, html: html, effectiveDate: v.START_DATE, signMode: digioOn_() ? 'aadhaar' : 'drawn' };
}

/** The template as simple blocks, cached per template version. */
function templateBlocks_() {
  var id = templateId_();
  var ver = DriveApp.getFileById(id).getLastUpdated().getTime();
  var key = 'tpl_' + id + '_' + ver;
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var body = DocumentApp.openById(id).getBody();
  var blocks = [];
  for (var i = 0; i < body.getNumChildren(); i++) {
    var el = body.getChild(i);
    var type = el.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var p = el.asParagraph();
      var text = p.getText();
      if (!text.trim()) continue;
      var h = p.getHeading();
      var kind = 'p';
      if (h === DocumentApp.ParagraphHeading.TITLE || h === DocumentApp.ParagraphHeading.HEADING1) kind = 'h1';
      else if (h !== DocumentApp.ParagraphHeading.NORMAL && h !== DocumentApp.ParagraphHeading.SUBTITLE) kind = 'h2';
      blocks.push({
        k: kind,
        t: text,
        b: p.editAsText().isBold() === true,
        c: p.getAlignment() === DocumentApp.HorizontalAlignment.CENTER
      });
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      blocks.push({ k: 'li', t: el.asListItem().getText() });
    } else if (type === DocumentApp.ElementType.TABLE) {
      var tb = el.asTable();
      var rows = [];
      for (var r = 0; r < tb.getNumRows(); r++) {
        var row = tb.getRow(r);
        var cells = [];
        for (var c = 0; c < row.getNumCells(); c++) cells.push(row.getCell(c).getText());
        rows.push(cells);
      }
      blocks.push({ k: 'table', rows: rows });
    }
  }
  try { cache.put(key, JSON.stringify(blocks), 21600); } catch (err) { /* too large to cache: fine */ }
  return blocks;
}

function renderBlocks_(blocks, v) {
  var fill = function (s) {
    var out = esc_(s).replace(/\{\{([A-Z_]+)\}\}/g, function (m, k) {
      if (/SIGNATURE$/.test(k)) return '<span class="sig-line"></span>';
      if (/SIGN_DATE$/.test(k)) return '<span class="date-line"></span>';
      return v[k] !== undefined ? '<b>' + esc_(v[k]) + '</b>' : '';
    });
    return out.replace(/\r\n|\r|\n|\u000b/g, '<br>');
  };
  var html = [];
  var inList = false;
  blocks.forEach(function (b) {
    if (b.k !== 'li' && inList) { html.push('</ul>'); inList = false; }
    if (b.k === 'li') {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push('<li>' + fill(b.t) + '</li>');
    } else if (b.k === 'table') {
      html.push('<table>' + b.rows.map(function (cells) {
        return '<tr>' + cells.map(function (c) { return '<td>' + fill(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table>');
    } else if (b.k === 'h1' || b.k === 'h2') {
      html.push('<' + (b.k === 'h1' ? 'h3' : 'h4') + '>' + fill(b.t) + '</' + (b.k === 'h1' ? 'h3' : 'h4') + '>');
    } else {
      var cls = (b.c ? ' class="c"' : '');
      html.push('<p' + cls + '>' + (b.b ? '<b>' + fill(b.t) + '</b>' : fill(b.t)) + '</p>');
    }
  });
  if (inList) html.push('</ul>');
  return html.join('');
}

// ---------------------------------------------------------------- submission

function handleSubmission_(p) {
  var ref = String(p.reference || '');
  if (!/^RTB-[A-Za-z0-9]{4,24}$/.test(ref)) return { ok: false, error: 'bad_reference' };

  var model = String(p.partnershipModel || '');
  var sig = p.signature || null;
  var aadhaar = model === 'FOCO' && digioOn_() && (p.agreementAccepted === true || !!sig);
  var wantsAgreement = aadhaar || !!(model === 'FOCO' && sig && sig.image && String(sig.image).length < 700000 &&
    String(sig.name || '').trim());
  var now = new Date();
  var sh, cols, rowNum, folder;

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sh = sheet_();
    cols = ensureHeaders_(sh);
    var existing = findRowByRef_(sh, cols, ref);
    if (existing) {
      var st = String(sh.getRange(existing, cols['Agreement Status']).getValue() || '');
      var link = String(sh.getRange(existing, cols['Owner Sign Link']).getValue() || '');
      return { ok: true, reference: ref, duplicate: true, signUrl: st === STATUS.OWNER_AADHAAR ? link : '',
        agreementStatus: st === STATUS.OWNER_AADHAAR ? 'awaiting_owner_esign' : st };
    }
    folder = saveDocuments_(p, ref);
    var row = {
      'Timestamp': now,
      'Reference': ref,
      'Owner Name': p.ownerName, 'Phone': p.phone, 'Email': p.email, 'PAN': p.pan, 'Owner Address': p.ownerAddress,
      'Property Name': p.propertyName, 'City': p.city, 'Property Type': p.propertyType, 'Bedrooms': p.bedrooms,
      'Status': p.status, 'Amenities': p.amenities, 'Property Address': p.propertyAddress,
      'Account Holder': p.accountHolder, 'Bank': p.bank, 'Account Number': p.accountNumber, 'IFSC': p.ifsc, 'UPI': p.upi,
      'Documents Confirmed': p.documents, 'Documents Folder': folder.getUrl(),
      'Partnership Model': model,
      'Agreement Status': wantsAgreement ? 'Generating' : (model === 'FOCO' ? STATUS.NOT_SIGNED : STATUS.NO_TEMPLATE)
    };
    appendRow_(sh, cols, row);
    rowNum = sh.getLastRow();
    // Keep account numbers as text (no scientific notation / lost leading zeros).
    sh.getRange(rowNum, cols['Account Number']).setNumberFormat('@').setValue(String(p.accountNumber || ''));
    sh.getRange(rowNum, cols['Phone']).setNumberFormat('@').setValue(String(p.phone || ''));
  } finally {
    lock.releaseLock();
  }

  if (!wantsAgreement) {
    notifyTeamApplication_(p, ref, folder, model === 'FOCO' ? STATUS.NOT_SIGNED : STATUS.NO_TEMPLATE);
    return { ok: true, reference: ref, agreementStatus: model === 'FOCO' ? 'not_signed' : 'none' };
  }

  if (aadhaar) {
    try {
      var d = sendForAadhaarEsign_(p, ref, folder, now);
      setCells_(sh, cols, rowNum, {
        'Agreement Status': STATUS.OWNER_AADHAAR,
        'Sign Method': 'Aadhaar eSign (Digio)',
        'Agreement Doc': d.docUrl,
        'Digio Document ID': d.digioId,
        'Owner Sign Link': d.signUrl
      });
      notifyTeamAadhaarSent_(p, ref, folder, d);
      notifyOwnerSignLink_(p, ref, d.signUrl);
      return { ok: true, reference: ref, agreementStatus: 'awaiting_owner_esign', signUrl: d.signUrl };
    } catch (err) {
      console.error('Aadhaar eSign request failed for ' + ref + ': ' + (err && err.stack || err));
      setCells_(sh, cols, rowNum, { 'Agreement Status': STATUS.FAILED, 'Sign Method': 'Aadhaar eSign (Digio)' });
      notifyTeamApplication_(p, ref, folder, STATUS.FAILED + ' — ' + (err && err.message || err));
      return { ok: true, reference: ref, agreementStatus: 'failed' };
    }
  }

  try {
    var a = createOwnerSignedAgreement_(p, ref, folder, now);
    var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    setCells_(sh, cols, rowNum, {
      'Agreement Status': STATUS.AWAITING,
      'Agreement Doc': a.docUrl,
      'Owner-signed PDF': a.pdfUrl,
      'Owner Signed (IST)': fmt_(now, 'dd/MM/yyyy HH:mm:ss'),
      'Owner Typed Name': String(sig.name).trim(),
      'Agreement Token': token,
      'Sign Method': 'Drawn e-signature'
    });
    notifyTeamToCountersign_(p, ref, folder, a, token);
    notifyOwnerReceived_(p, ref);
    return { ok: true, reference: ref, agreementStatus: 'awaiting_countersignature' };
  } catch (err) {
    console.error('Agreement generation failed for ' + ref + ': ' + (err && err.stack || err));
    setCells_(sh, cols, rowNum, { 'Agreement Status': STATUS.FAILED });
    notifyTeamApplication_(p, ref, folder, STATUS.FAILED + ' — ' + (err && err.message || err));
    return { ok: true, reference: ref, agreementStatus: 'failed' };
  }
}

function saveDocuments_(p, ref) {
  var parent = DriveApp.getFolderById(cfg_('APPLICATIONS_FOLDER_ID'));
  var folder = parent.createFolder(ref + ' — ' + clean_(p.ownerName || 'Owner') + ' — ' + clean_(p.propertyName || 'Property'));
  (p.files || []).forEach(function (f) {
    if (!f || !f.data) return;
    try {
      var blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.mimeType || 'application/octet-stream',
        String(f.name || 'file').slice(0, 180));
      folder.createFile(blob);
    } catch (err) {
      console.warn('Could not save a document for ' + ref + ': ' + err);
    }
  });
  return folder;
}

function createOwnerSignedAgreement_(p, ref, folder, signedAt) {
  var name = 'Ritumbhara SLA — ' + clean_(p.propertyName || 'Property') + ' — ' + ref;
  var file = DriveApp.getFileById(templateId_()).makeCopy(name, folder);
  var doc = DocumentApp.openById(file.getId());
  var body = doc.getBody();

  insertSignature_(body, '{{OWNER_SIGNATURE}}', p.signature.image);
  fillPlaceholders_(body, buildValues_(p, signedAt));
  appendAudit_(body, true, 'Signed electronically by the Asset Owner, ' + String(p.signature.name).trim() +
    ' (' + (p.email || '') + '), on ' + fmt_(signedAt, 'dd MMM yyyy, HH:mm:ss') + ' IST, through the Ritumbhara ' +
    'asset owner onboarding form (reference ' + ref + '). Device: ' + String(p.signature.userAgent || 'not recorded').slice(0, 200) + '.');
  doc.saveAndClose();

  var pdf = folder.createFile(file.getAs(MimeType.PDF).setName(name + ' (owner signed).pdf'));
  return { docId: file.getId(), docUrl: file.getUrl(), pdfId: pdf.getId(), pdfUrl: pdf.getUrl(), name: name };
}

// ---------------------------------------------------------------- countersign

function countersignInfo_(ref, token) {
  var found = findByToken_(ref, token);
  if (!found) return { ok: false, error: 'This countersign link is not valid.' };
  var g = function (h) { return String(found.sh.getRange(found.row, found.cols[h]).getValue() || ''); };
  return {
    ok: true,
    ref: ref,
    status: g('Agreement Status'),
    ownerName: g('Owner Name'),
    ownerEmail: g('Email'),
    propertyName: g('Property Name'),
    city: g('City'),
    signedAt: g('Owner Signed (IST)'),
    typedName: g('Owner Typed Name'),
    docUrl: g('Agreement Doc'),
    pdfUrl: g('Owner-signed PDF'),
    executedUrl: g('Executed PDF')
  };
}

/** Called from Countersign.html via google.script.run. */
function countersign(ref, token, signatureImage, signerName) {
  if (!signatureImage || String(signatureImage).length > 700000) return { ok: false, error: 'Please draw a signature.' };
  if (!String(signerName || '').trim()) return { ok: false, error: 'Please type your name.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var found = findByToken_(ref, token);
    if (!found) return { ok: false, error: 'This countersign link is not valid.' };
    var sh = found.sh, cols = found.cols, row = found.row;
    var g = function (h) { return String(sh.getRange(row, cols[h]).getValue() || ''); };
    if (g('Agreement Status') === STATUS.EXECUTED) return { ok: true, already: true, pdfUrl: g('Executed PDF') };
    if (g('Agreement Status') !== STATUS.AWAITING) return { ok: false, error: 'This agreement is not awaiting countersignature (status: ' + g('Agreement Status') + ').' };

    var docId = idFromUrl_(g('Agreement Doc'));
    var file = DriveApp.getFileById(docId);
    var doc = DocumentApp.openById(docId);
    var body = doc.getBody();
    var now = new Date();
    insertSignature_(body, '{{COMPANY_SIGNATURE}}', signatureImage);
    body.replaceText('\\{\\{COMPANY_SIGN_DATE\\}\\}', fmt_(now, 'dd.MM.yyyy'));
    appendAudit_(body, false, 'Countersigned electronically for the Management Entity by ' + String(signerName).trim() +
      ' on ' + fmt_(now, 'dd MMM yyyy, HH:mm:ss') + ' IST.');
    doc.saveAndClose();

    var folder = file.getParents().hasNext() ? file.getParents().next() : DriveApp.getRootFolder();
    var baseName = file.getName();
    var pdf = folder.createFile(file.getAs(MimeType.PDF).setName(baseName + ' (executed).pdf'));
    setCells_(sh, cols, row, {
      'Agreement Status': STATUS.EXECUTED,
      'Countersigned (IST)': fmt_(now, 'dd/MM/yyyy HH:mm:ss'),
      'Countersigned By': String(signerName).trim(),
      'Executed PDF': pdf.getUrl()
    });

    var owner = { name: g('Owner Name'), email: g('Email'), property: g('Property Name') };
    sendExecutedCopy_(owner, ref, pdf);
    return { ok: true, pdfUrl: pdf.getUrl() };
  } finally {
    lock.releaseLock();
  }
}

function findByToken_(ref, token) {
  if (!/^RTB-[A-Za-z0-9]{4,24}$/.test(String(ref || '')) || !/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  var sh = sheet_();
  var cols = ensureHeaders_(sh);
  var row = findRowByRef_(sh, cols, ref);
  if (!row) return null;
  var saved = String(sh.getRange(row, cols['Agreement Token']).getValue() || '');
  if (!saved || saved !== token) return null;
  return { sh: sh, cols: cols, row: row };
}

// ---------------------------------------------------------------- Aadhaar eSign (Digio)

function digioOn_() { return !!(cfg_('DIGIO_CLIENT_ID') && cfg_('DIGIO_CLIENT_SECRET')); }

function digioBase_() {
  return String(cfg_('DIGIO_ENV')).toLowerCase() === 'production' ? 'https://api.digio.in' : 'https://ext.digio.in:444';
}

/** Calls the Digio API. Returns parsed JSON, or the raw blob when asBlob is true. */
function digio_(method, path, payload, asBlob) {
  var opts = {
    method: method,
    muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(cfg_('DIGIO_CLIENT_ID') + ':' + cfg_('DIGIO_CLIENT_SECRET')) }
  };
  if (payload) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch(digioBase_() + path, opts);
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('Digio ' + method + ' ' + path + ' -> ' + code + ': ' + res.getContentText().slice(0, 400));
  return asBlob ? res.getBlob() : JSON.parse(res.getContentText() || '{}');
}

function companySigner_() { return cfg_('DIGIO_COMPANY_SIGNER') || Session.getEffectiveUser().getEmail(); }

/** Fills the agreement (no drawn signatures), uploads the PDF to Digio with owner -> Ritumbhara signing order. */
function sendForAadhaarEsign_(p, ref, folder, now) {
  var name = 'Ritumbhara SLA — ' + clean_(p.propertyName || 'Property') + ' — ' + ref;
  var file = DriveApp.getFileById(templateId_()).makeCopy(name, folder);
  var doc = DocumentApp.openById(file.getId());
  var body = doc.getBody();
  var v = buildValues_(p, now);
  v.OWNER_SIGNATURE = 'Aadhaar eSign (signature page)';
  v.COMPANY_SIGNATURE = 'Aadhaar eSign (signature page)';
  v.OWNER_SIGN_DATE = 'As per Aadhaar eSign';
  v.COMPANY_SIGN_DATE = 'As per Aadhaar eSign';
  fillPlaceholders_(body, v);
  appendAudit_(body, true, 'Agreement reviewed and accepted online by the Asset Owner, ' + v.OWNER_NAME + ' (' +
    (p.email || '') + '), on ' + fmt_(now, 'dd MMM yyyy, HH:mm:ss') + ' IST, through the Ritumbhara asset owner ' +
    'onboarding form (reference ' + ref + '). Executed by both Parties using Aadhaar eSign through Digio, a ' +
    'licensed eSign Service Provider. The Aadhaar eSign signatures appear on the signature page below.');
  body.appendPageBreak();
  body.appendParagraph('Signature page — Aadhaar eSign')
    .setHeading(DocumentApp.ParagraphHeading.NORMAL)
    .setAlignment(DocumentApp.HorizontalAlignment.LEFT)
    .editAsText().setBold(true).setFontSize(11);
  body.appendParagraph('Asset Owner: ' + v.OWNER_NAME + '      Management Entity: ' + cfg_('DIGIO_COMPANY_SIGNER_NAME') +
    ', Director, LilacMosaic Technologies Pvt. Ltd.')
    .setHeading(DocumentApp.ParagraphHeading.NORMAL)
    .editAsText().setBold(false).setFontSize(9);
  doc.saveAndClose();

  var pdf = file.getAs(MimeType.PDF).setName(name + '.pdf');
  folder.createFile(pdf.copyBlob().setName(name + ' (sent for Aadhaar eSign).pdf'));

  var res = digio_('post', '/v2/client/document/uploadpdf', {
    file_name: name + '.pdf',
    file_data: Utilities.base64Encode(pdf.getBytes()),
    signers: [
      { identifier: String(p.email || '').trim(), name: v.OWNER_NAME, sign_type: 'aadhaar',
        reason: 'Asset Owner, Ritumbhara partnership agreement ' + ref },
      { identifier: companySigner_(), name: cfg_('DIGIO_COMPANY_SIGNER_NAME'), sign_type: 'aadhaar',
        reason: 'For LilacMosaic Technologies Pvt. Ltd. (Management Entity)' }
    ],
    sequential: true,
    expire_in_days: 15,
    display_on_page: 'last',
    notify_signers: true,
    send_sign_link: true,
    include_authentication_url: true,
    callback: ref,
    reference_id: ref,
    comment: 'Please sign your Ritumbhara partnership agreement with Aadhaar.'
  });
  if (!res.id) throw new Error('Digio returned no document id: ' + JSON.stringify(res).slice(0, 300));
  return { digioId: res.id, signUrl: ownerSignUrl_(res, String(p.email || '').trim()), docUrl: file.getUrl() };
}

/** Finds the owner's signing link in Digio's response (it sits on the signing party). */
function ownerSignUrl_(res, ownerId) {
  var parties = res.signing_parties || [];
  for (var i = 0; i < parties.length; i++) {
    if (parties[i].authentication_url && String(parties[i].identifier || '').toLowerCase() === ownerId.toLowerCase()) {
      return parties[i].authentication_url;
    }
  }
  if (parties[0] && parties[0].authentication_url) return parties[0].authentication_url;
  return res.authentication_url || '';
}

/** Digio webhook: never trusts the payload; it only tells us which document to re-check with the Digio API. */
function handleDigioWebhook_(body) {
  var id = String((body.payload.document && body.payload.document.id) || '');
  if (!/^DID[A-Za-z0-9]+$/.test(id)) return { ok: false };
  var sh = sheet_();
  var cols = ensureHeaders_(sh);
  var row = findRowByValue_(sh, cols['Digio Document ID'], id);
  if (row) syncDigioRow_(sh, cols, row);
  return { ok: true };
}

/** Time-driven fallback (installed by setupDigioSync): re-checks every pending Aadhaar eSign. */
function syncPendingDigio() {
  if (!digioOn_()) return;
  var sh = sheet_();
  var cols = ensureHeaders_(sh);
  var last = sh.getLastRow();
  if (last < 2) return;
  var statuses = sh.getRange(2, cols['Agreement Status'], last - 1, 1).getValues();
  for (var i = 0; i < statuses.length; i++) {
    var st = String(statuses[i][0]);
    if (st === STATUS.OWNER_AADHAAR || st === STATUS.COMPANY_AADHAAR) {
      try { syncDigioRow_(sh, cols, i + 2); } catch (err) { console.warn('Sync failed for row ' + (i + 2) + ': ' + err); }
    }
  }
}

function syncDigioRow_(sh, cols, row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var g = function (h) { return String(sh.getRange(row, cols[h]).getValue() || ''); };
    var before = g('Agreement Status');
    if (before !== STATUS.OWNER_AADHAAR && before !== STATUS.COMPANY_AADHAAR) return before;
    var id = g('Digio Document ID');
    var d = digio_('get', '/v2/client/document/' + encodeURIComponent(id));
    var parties = d.signing_parties || [];
    var ownerEmail = g('Email').trim().toLowerCase();
    var owner = parties.filter(function (x) { return String(x.identifier || '').toLowerCase() === ownerEmail; })[0] || parties[0] || {};
    var ref = g('Reference');
    var info = { name: g('Owner Name'), email: g('Email'), property: g('Property Name') };
    var updates = {};
    if (owner.status === 'signed') {
      var pki = owner.pki_signature_details || {};
      if (!g('Owner Signed (IST)')) updates['Owner Signed (IST)'] = fmt_(owner.updated_at ? new Date(Number(owner.updated_at)) : new Date(), 'dd/MM/yyyy HH:mm:ss');
      if (pki.name && !g('Owner Aadhaar Name')) updates['Owner Aadhaar Name'] = pki.name + (pki.name_validation_score !== undefined ? ' (name match ' + pki.name_validation_score + ')' : '');
    }
    var status = String(d.agreement_status || '');
    if (status === 'completed') {
      var file = DriveApp.getFileById(idFromUrl_(g('Agreement Doc')));
      var folder = file.getParents().hasNext() ? file.getParents().next() : DriveApp.getRootFolder();
      var blob = digio_('get', '/v2/client/document/download?document_id=' + encodeURIComponent(id), null, true);
      var pdf = folder.createFile(blob.setName(file.getName() + ' (executed, Aadhaar eSigned).pdf').setContentType('application/pdf'));
      var co = parties.filter(function (x) { return x !== owner; })[0] || {};
      updates['Agreement Status'] = STATUS.EXECUTED;
      updates['Countersigned (IST)'] = fmt_(co.updated_at ? new Date(Number(co.updated_at)) : new Date(), 'dd/MM/yyyy HH:mm:ss');
      updates['Countersigned By'] = cfg_('DIGIO_COMPANY_SIGNER_NAME') + ' (Aadhaar eSign)';
      updates['Executed PDF'] = pdf.getUrl();
      setCells_(sh, cols, row, updates);
      sendExecutedCopy_(info, ref, pdf);
      return STATUS.EXECUTED;
    }
    if (status === 'expired' || status === 'failed') {
      updates['Agreement Status'] = status === 'expired' ? STATUS.ESIGN_EXPIRED : STATUS.ESIGN_FAILED;
      setCells_(sh, cols, row, updates);
      MailApp.sendEmail({ to: teamEmails_(), subject: 'Aadhaar eSign ' + status + ' — ' + info.property + ' (' + ref + ')',
        htmlBody: '<p>The Aadhaar eSign request for <b>' + esc_(info.property) + '</b> (' + esc_(info.name) + ') is ' + esc_(status) + '. Please follow up with the owner.</p>' });
      return updates['Agreement Status'];
    }
    if (owner.status === 'signed' && before === STATUS.OWNER_AADHAAR) {
      updates['Agreement Status'] = STATUS.COMPANY_AADHAAR;
      setCells_(sh, cols, row, updates);
      MailApp.sendEmail({ to: teamEmails_(), subject: 'Your Aadhaar eSign needed — ' + info.property + ' (' + ref + ')',
        htmlBody: '<p><b>' + esc_(info.name) + '</b> has signed the agreement for <b>' + esc_(info.property) + '</b> with Aadhaar' +
          (updates['Owner Aadhaar Name'] ? ' (Aadhaar name: ' + esc_(updates['Owner Aadhaar Name']) + ')' : '') +
          '.</p><p>Digio has emailed ' + esc_(companySigner_()) + ' a link to sign for Ritumbhara. Once you sign, the executed copy goes to the owner automatically.</p>' +
          '<p><a href="' + g('Agreement Doc') + '">Agreement doc</a></p>' });
      return STATUS.COMPANY_AADHAAR;
    }
    if (Object.keys(updates).length) setCells_(sh, cols, row, updates);
    return before;
  } finally {
    lock.releaseLock();
  }
}

/** Run once after adding the Digio keys: installs the 30-minute status sync. */
function setupDigioSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncPendingDigio') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncPendingDigio').timeBased().everyMinutes(30).create();
  console.log('Digio sync installed (' + (digioOn_() ? 'keys found, env ' + cfg_('DIGIO_ENV') : 'NO KEYS YET') + ').');
}

/** Optional: run from the editor to check the Digio keys (no document is created). */
function testDigioKeys() {
  try {
    digio_('get', '/v2/client/document/DID000000000000000000000');
    console.log('Unexpected success');
  } catch (err) {
    var m = String(err.message);
    console.log(/-> 401|-> 403/.test(m) ? 'Keys REJECTED by Digio: ' + m : 'Keys accepted (a "not found" error is expected): ' + m);
  }
}

// ---------------------------------------------------------------- document helpers

function buildValues_(d, date) {
  var trim = function (s) { return String(s || '').replace(/[\r\n]+/g, ', ').replace(/\s+/g, ' ').trim(); };
  var end = new Date(date.getTime());
  end.setFullYear(end.getFullYear() + TERM_YEARS);
  var city = trim(d.city);
  var addr = trim(d.propertyAddress);
  if (city && addr.toLowerCase().indexOf(city.toLowerCase()) === -1) addr = addr + ', ' + city;
  var statusText = {
    'Vacant / ready to operate': 'vacant and ready to operate',
    'Currently self-managed': 'self-managed',
    'Currently listed elsewhere': 'listed on other platforms',
    'Under construction': 'under construction'
  }[String(d.status || '')] || trim(d.status).toLowerCase() || 'ready to operate';
  var day = Number(fmt_(date, 'd'));
  var endDay = Number(fmt_(end, 'd'));
  return {
    OWNER_NAME: trim(d.ownerName),
    OWNER_PHONE: trim(d.phone),
    OWNER_EMAIL: trim(d.email),
    OWNER_PAN: trim(d.pan).toUpperCase(),
    OWNER_ADDRESS: trim(d.ownerAddress),
    PROPERTY_NAME: trim(d.propertyName),
    PROPERTY_ADDRESS: addr,
    PROPERTY_STATUS: statusText,
    AMENITIES: trim(d.amenities) || 'those described in the Asset Owner’s onboarding application',
    ACCOUNT_HOLDER: trim(d.accountHolder),
    BANK_NAME: trim(d.bank),
    ACCOUNT_NUMBER: trim(d.accountNumber),
    IFSC: trim(d.ifsc).toUpperCase(),
    UPI: trim(d.upi) || '—',
    START_DATE: fmt_(date, 'dd.MM.yyyy'),
    END_DATE: fmt_(end, 'dd.MM.yyyy'),
    START_DAY: ordinal_(day),
    START_MONTH_YEAR: fmt_(date, 'MMMM, yyyy'),
    END_DATE_LONG: ordinal_(endDay) + ' ' + fmt_(end, 'MMMM, yyyy'),
    OWNER_SIGN_DATE: fmt_(date, 'dd.MM.yyyy')
  };
}

function fillPlaceholders_(body, v) {
  Object.keys(v).forEach(function (k) {
    body.replaceText('\\{\\{' + k + '\\}\\}', String(v[k]).replace(/[\\$]/g, ''));
  });
}

/** Replaces the placeholder text with an inline signature image, keeping the text around it. */
function insertSignature_(body, placeholder, base64Png) {
  var b64 = String(base64Png || '').replace(/^data:image\/png;base64,/, '');
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', 'signature.png');
  var pattern = placeholder.replace(/[{}]/g, '\\$&');
  var range = body.findText(pattern);
  if (!range) throw new Error('Placeholder ' + placeholder + ' not found in the agreement template');
  var textEl = range.getElement().asText();
  var start = range.getStartOffset();
  var endInc = range.getEndOffsetInclusive();
  var para = textEl.getParent();
  var idx = para.getChildIndex(textEl);
  var len = textEl.getText().length;

  var tail = null;
  if (endInc < len - 1) {
    tail = textEl.copy();
    tail.deleteText(0, endInc);
  }
  textEl.deleteText(start, len - 1);
  var img = para.insertInlineImage(idx + 1, blob);
  var w = img.getWidth(), h = img.getHeight();
  if (w > 0) { img.setWidth(170); img.setHeight(Math.round(170 * h / w)); }
  if (tail) para.insertText(idx + 2, tail);
}

function appendAudit_(body, withHeading, line) {
  if (withHeading) {
    body.appendParagraph('Electronic execution record')
      .setHeading(DocumentApp.ParagraphHeading.NORMAL)
      .setAlignment(DocumentApp.HorizontalAlignment.LEFT)
      .editAsText().setBold(true).setFontSize(10);
  }
  body.appendParagraph(line)
    .setHeading(DocumentApp.ParagraphHeading.NORMAL)
    .setAlignment(DocumentApp.HorizontalAlignment.LEFT)
    .editAsText().setBold(false).setItalic(false).setFontSize(9);
}

// ---------------------------------------------------------------- one-time template setup

/**
 * Run once from the editor. Copies the sample agreement (the Amar Bagh SLA) and swaps that owner's details for
 * {{PLACEHOLDERS}}, so the formatting stays exactly as in the sample. Saves the new template's ID in
 * AGREEMENT_TEMPLATE_ID and logs its link. Open it and check it before going live.
 * To change fixed terms later (revenue share, cost cap, lock-in...), edit the template doc directly and
 * leave the {{PLACEHOLDERS}} as they are.
 */
function setupAgreementTemplate() {
  var src = DriveApp.getFileById(cfg_('SAMPLE_AGREEMENT_ID'));
  var parents = src.getParents();
  var copy = src.makeCopy('Ritumbhara_SLA_WEBSITE_TEMPLATE (keep the {{PLACEHOLDERS}})',
    parents.hasNext() ? parents.next() : DriveApp.getRootFolder());
  var doc = DocumentApp.openById(copy.getId());
  var body = doc.getBody();
  var warnings = [];

  // 1. Label/value tables (cover summary and bank details).
  var labelMap = {
    'property': '{{PROPERTY_NAME}}, {{PROPERTY_ADDRESS}}',
    'asset owner': '{{OWNER_NAME}}',
    'effective date': '{{START_DATE}}',
    'term': TERM_YEARS + ' Years ({{START_DATE}} to {{END_DATE}})',
    'bank': '{{BANK_NAME}}',
    'account number': '{{ACCOUNT_NUMBER}}',
    'ifsc code': '{{IFSC}}',
    'upi id': '{{UPI}}'
  };
  var tables = body.getTables();
  tables.forEach(function (tb) {
    var bankRow = -1;
    for (var r = 0; r < tb.getNumRows(); r++) {
      var row = tb.getRow(r);
      if (row.getNumCells() < 2) continue;
      var label = row.getCell(0).getText().replace(/\s+/g, ' ').trim().toLowerCase();
      if (labelMap[label]) setCellText_(row.getCell(1), labelMap[label]);
      if (label === 'bank') bankRow = r;
    }
    if (bankRow >= 0) {
      tb.insertTableRow(bankRow + 1, tb.getRow(bankRow).copy());
      var nr = tb.getRow(bankRow + 1);
      setCellText_(nr.getCell(0), 'Account Holder');
      setCellText_(nr.getCell(1), '{{ACCOUNT_HOLDER}}');
    }
  });

  // 2. Signature table (the last table): signature + date lines.
  var sigTable = tables[tables.length - 1];
  if (sigTable && sigTable.getNumRows() && sigTable.getRow(0).getNumCells() >= 2) {
    var ownerCell = sigTable.getRow(0).getCell(0);
    var coCell = sigTable.getRow(0).getCell(1);
    ownerCell.replaceText('Signature:\\s*_+', 'Signature: {{OWNER_SIGNATURE}}');
    ownerCell.replaceText('Date:\\s*_+', 'Date: {{OWNER_SIGN_DATE}}');
    coCell.replaceText('Signature:\\s*_+', 'Signature: {{COMPANY_SIGNATURE}}');
    coCell.replaceText('Date:\\s*_+', 'Date: {{COMPANY_SIGN_DATE}}');
  } else {
    warnings.push('Signature table not found');
  }

  // 3. Running text. Order matters (most specific first).
  var ADDR = 'Amar Bagh, Kharsa number 877 village Raniwas Tashil Jawaramghar, jaipur';
  var swaps = [
    ['Address:\\s*' + lit_(ADDR), 'Address: {{OWNER_ADDRESS}}'],
    ['located at\\s*' + lit_(ADDR), 'located at {{PROPERTY_ADDRESS}}'],
    [lit_(ADDR), '{{PROPERTY_NAME}}, {{PROPERTY_ADDRESS}}'],
    ['AMAR BAGH', '{{PROPERTY_NAME}}'],
    ['AMAR SINGH', '{{OWNER_NAME}}'],
    ['9829455833', '{{OWNER_PHONE}}'],
    [lit_('amarbagh86@gmail.com'), '{{OWNER_EMAIL}}'],
    ['AJXPS1040A', '{{OWNER_PAN}}'],
    ['currently self-managed,\\s*and features amenities including\\s*Pool,\\s*lawn,\\s*parking\\.?',
      'currently {{PROPERTY_STATUS}}, and features amenities including {{AMENITIES}}.'],
    ['25th\\s*day of\\s*Oct\\s*,\\s*2026\\s*', '{{START_DAY}} day of {{START_MONTH_YEAR}} '],
    ['36 months\\s*,\\s*25th\\s*Oct\\s*,\\s*2026', '36 months'],
    ['25th\\s*Oct\\s*,\\s*2031', '{{END_DATE_LONG}}'],
    ['25/10/2026', '{{START_DATE}}'],
    ['25\\.10\\.2031', '{{END_DATE}}'],
    ['25\\.10\\.2026', '{{START_DATE}}']
  ];
  swaps.forEach(function (s) {
    if (!body.findText(s[0])) { warnings.push('Not found (may already be fine): ' + s[0]); return; }
    body.replaceText(s[0], s[1]);
  });

  // 4. Placeholders must not inherit superscript etc. from the text they replaced.
  var r = body.findText('\\{\\{[A-Z_]+\\}\\}');
  while (r) {
    r.getElement().asText().setTextAlignment(r.getStartOffset(), r.getEndOffsetInclusive(), DocumentApp.TextAlignment.NORMAL);
    r = body.findText('\\{\\{[A-Z_]+\\}\\}', r);
  }

  // 5. Checks.
  var text = body.getText();
  ['OWNER_NAME', 'OWNER_PHONE', 'OWNER_EMAIL', 'OWNER_PAN', 'OWNER_ADDRESS', 'PROPERTY_NAME', 'PROPERTY_ADDRESS',
    'PROPERTY_STATUS', 'AMENITIES', 'ACCOUNT_HOLDER', 'BANK_NAME', 'ACCOUNT_NUMBER', 'IFSC', 'UPI', 'START_DATE',
    'END_DATE', 'START_DAY', 'START_MONTH_YEAR', 'END_DATE_LONG', 'OWNER_SIGNATURE', 'OWNER_SIGN_DATE',
    'COMPANY_SIGNATURE', 'COMPANY_SIGN_DATE'].forEach(function (k) {
    if (text.indexOf('{{' + k + '}}') === -1) warnings.push('Missing placeholder {{' + k + '}}');
  });
  [/amar/i, /9829455833/, /SBIN0016290/, /51029165188/, /25\.10\.20/, /\bOct\b/].forEach(function (re) {
    if (re.test(text)) warnings.push('Sample value still in the template: ' + re);
  });

  doc.saveAndClose();
  PropertiesService.getScriptProperties().setProperty('AGREEMENT_TEMPLATE_ID', copy.getId());
  console.log('Template created: ' + copy.getUrl());
  console.log(warnings.length ? 'CHECK THESE:\n- ' + warnings.join('\n- ') : 'All placeholders in place.');
  return copy.getUrl();
}

/** Optional: run from the editor to send yourself a test agreement end to end (uses your own email). */
function testOwnerSignedAgreement() {
  var me = Session.getEffectiveUser().getEmail();
  // 1x1 transparent PNG as a stand-in signature.
  var px = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  var res = handleSubmission_({
    reference: 'RTB-TEST' + Date.now().toString().slice(-6), partnershipModel: 'FOCO',
    ownerName: 'Test Owner', phone: '9999900000', email: me, pan: 'ABCDE1234F', ownerAddress: '1 Test Street, Jaipur',
    propertyName: 'Test Villa', city: 'Jaipur', propertyType: 'Villa', bedrooms: '3', status: 'Currently self-managed',
    amenities: 'Pool, lawn', propertyAddress: '2 Test Road', accountHolder: 'Test Owner', bank: 'HDFC Bank',
    accountNumber: '0012345678', ifsc: 'HDFC0001234', upi: '', documents: '', files: [],
    signature: { name: 'Test Owner', image: px, userAgent: 'Apps Script test' }
  });
  console.log(JSON.stringify(res));
}

// ---------------------------------------------------------------- emails

function teamEmails_() {
  var v = cfg_('TEAM_EMAILS');
  return v ? v : Session.getEffectiveUser().getEmail();
}

function webAppUrl_() {
  return cfg_('WEB_APP_URL') || ScriptApp.getService().getUrl();
}

function detailsHtml_(p, ref) {
  var rows = [['Reference', ref], ['Model', p.partnershipModel], ['Owner', p.ownerName], ['Phone', p.phone],
    ['Email', p.email], ['Property', p.propertyName], ['City', p.city], ['Type', p.propertyType],
    ['Bedrooms', p.bedrooms], ['Status', p.status], ['Documents', p.documents || 'None uploaded']];
  return '<table cellpadding="4" style="border-collapse:collapse;font-size:13px">' + rows.map(function (r) {
    return '<tr><td style="color:#777">' + esc_(r[0]) + '</td><td>' + esc_(r[1] || '—') + '</td></tr>';
  }).join('') + '</table>';
}

function notifyTeamApplication_(p, ref, folder, note) {
  MailApp.sendEmail({
    to: teamEmails_(),
    subject: 'New asset owner application — ' + (p.propertyName || '') + ' (' + ref + ')',
    htmlBody: '<p>A new asset owner application came in. Agreement: <b>' + esc_(note) + '</b>.</p>' +
      detailsHtml_(p, ref) + '<p><a href="' + folder.getUrl() + '">Open the application folder</a></p>'
  });
}

function notifyTeamToCountersign_(p, ref, folder, a, token) {
  var link = webAppUrl_() + '?action=countersign&ref=' + encodeURIComponent(ref) + '&t=' + token;
  MailApp.sendEmail({
    to: teamEmails_(),
    subject: 'Countersign needed — ' + (p.propertyName || '') + ' (' + ref + ')',
    htmlBody: '<p><b>' + esc_(p.ownerName) + '</b> has signed the partnership agreement for <b>' +
      esc_(p.propertyName) + '</b>. Please review and countersign. Once you sign, the executed copy is emailed to the owner automatically.</p>' +
      '<p><a href="' + link + '" style="background:#BF2542;color:#fff;padding:10px 18px;text-decoration:none;border-radius:2px">Review and countersign</a></p>' +
      detailsHtml_(p, ref) +
      '<p><a href="' + a.pdfUrl + '">Owner-signed PDF</a> · <a href="' + a.docUrl + '">Agreement doc</a> · <a href="' + folder.getUrl() + '">Application folder</a></p>' +
      '<p style="color:#777;font-size:12px">Anyone with the countersign link can sign for Ritumbhara. Don’t forward this email.</p>'
  });
}

function notifyTeamAadhaarSent_(p, ref, folder, d) {
  MailApp.sendEmail({
    to: teamEmails_(),
    subject: 'Aadhaar eSign started — ' + (p.propertyName || '') + ' (' + ref + ')',
    htmlBody: '<p><b>' + esc_(p.ownerName) + '</b> accepted the partnership agreement for <b>' + esc_(p.propertyName) +
      '</b> and is signing it with Aadhaar. After they sign, Digio will email ' + esc_(companySigner_()) +
      ' to sign for Ritumbhara.</p>' + detailsHtml_(p, ref) +
      '<p><a href="' + d.docUrl + '">Agreement doc</a> · <a href="' + folder.getUrl() + '">Application folder</a> · Digio ID ' + esc_(d.digioId) + '</p>'
  });
}

function notifyOwnerSignLink_(p, ref, signUrl) {
  if (!p.email) return;
  var first = String(p.ownerName || 'there').trim().split(/\s+/)[0];
  MailApp.sendEmail({
    to: p.email,
    name: 'Ritumbhara Partnerships',
    replyTo: teamEmails_().split(',')[0],
    subject: 'Sign your Ritumbhara partnership agreement with Aadhaar (' + ref + ')',
    htmlBody: '<p>Hi ' + esc_(first) + ',</p><p>Thanks for accepting the Ritumbhara partnership agreement for <b>' +
      esc_(p.propertyName) + '</b>. Please sign it with Aadhaar. You’ll get an OTP on your Aadhaar-linked mobile.</p>' +
      (signUrl ? '<p><a href="' + signUrl + '" style="background:#BF2542;color:#fff;padding:10px 18px;text-decoration:none;border-radius:2px">Sign with Aadhaar</a></p>' : '<p>Digio (our eSign provider) will email you the signing link.</p>') +
      '<p>Once Ritumbhara also signs, we’ll email you the final signed copy.</p><p>Reference: ' + esc_(ref) + '</p><p>— Team Ritumbhara</p>'
  });
}

function notifyOwnerReceived_(p, ref) {
  if (!p.email) return;
  var first = String(p.ownerName || 'there').trim().split(/\s+/)[0];
  MailApp.sendEmail({
    to: p.email,
    name: 'Ritumbhara Partnerships',
    replyTo: teamEmails_().split(',')[0],
    subject: 'We’ve received your signed agreement (' + ref + ')',
    htmlBody: '<p>Hi ' + esc_(first) + ',</p><p>Thanks for signing the Ritumbhara partnership agreement for <b>' +
      esc_(p.propertyName) + '</b>. Our team will review and countersign it, and we’ll email you the final signed copy.</p>' +
      '<p>Reference: ' + esc_(ref) + '</p><p>— Team Ritumbhara</p>'
  });
}

function sendExecutedCopy_(owner, ref, pdf) {
  var blob = pdf.getBlob();
  if (owner.email) {
    var first = String(owner.name || 'there').trim().split(/\s+/)[0];
    MailApp.sendEmail({
      to: owner.email,
      name: 'Ritumbhara Partnerships',
      replyTo: teamEmails_().split(',')[0],
      subject: 'Your signed Ritumbhara partnership agreement (' + ref + ')',
      htmlBody: '<p>Hi ' + esc_(first) + ',</p><p>Your partnership agreement for <b>' + esc_(owner.property) +
        '</b> is now signed by both parties. Your copy is attached — please keep it for your records.</p>' +
        '<p>We’ll be in touch about the next onboarding steps.</p><p>— Team Ritumbhara</p>',
      attachments: [blob]
    });
  }
  MailApp.sendEmail({
    to: teamEmails_(),
    subject: 'Agreement executed — ' + owner.property + ' (' + ref + ')',
    htmlBody: '<p>The agreement for <b>' + esc_(owner.property) + '</b> is executed and the copy was emailed to ' +
      esc_(owner.email || '(no email on file)') + '.</p><p><a href="' + pdf.getUrl() + '">Executed PDF</a></p>',
    attachments: [blob]
  });
}

// ---------------------------------------------------------------- sheet helpers

function sheet_() {
  var ss = SpreadsheetApp.openById(cfg_('SHEET_ID'));
  return ss.getSheetByName(cfg_('SHEET_NAME')) || ss.getSheets()[0];
}

function ensureHeaders_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  if (!head.some(function (h) { return h; })) {
    sh.getRange(1, 1, 1, BASE_HEADERS.length).setValues([BASE_HEADERS]);
    head = BASE_HEADERS.slice();
  }
  BASE_HEADERS.concat(AGREEMENT_HEADERS).forEach(function (h) {
    if (head.indexOf(h) === -1) {
      head.push(h);
      sh.getRange(1, head.length).setValue(h);
    }
  });
  var map = {};
  head.forEach(function (h, i) { if (h && !map[h]) map[h] = i + 1; });
  return map;
}

function findRowByRef_(sh, cols, ref) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, cols['Reference'], last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]) === ref) return i + 2;
  return 0;
}

function findRowByValue_(sh, col, value) {
  var last = sh.getLastRow();
  if (last < 2 || !col) return 0;
  var vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]) === value) return i + 2;
  return 0;
}

function appendRow_(sh, cols, obj) {
  var width = Math.max.apply(null, Object.keys(cols).map(function (k) { return cols[k]; }));
  var arr = new Array(width).fill('');
  Object.keys(obj).forEach(function (k) { if (cols[k]) arr[cols[k] - 1] = obj[k] === undefined ? '' : obj[k]; });
  sh.appendRow(arr);
}

function setCells_(sh, cols, row, obj) {
  Object.keys(obj).forEach(function (k) { if (cols[k]) sh.getRange(row, cols[k]).setValue(obj[k]); });
}

// ---------------------------------------------------------------- small utils

function cfg_(k) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return (v === null || v === '') ? DEFAULTS[k] : v;
}

function templateId_() {
  var id = cfg_('AGREEMENT_TEMPLATE_ID');
  if (!id) throw new Error('AGREEMENT_TEMPLATE_ID is not set. Run setupAgreementTemplate() once.');
  return id;
}

/** Sets a cell's text, keeping the bold/size of its first character. */
function setCellText_(cell, text) {
  var t = cell.editAsText();
  var cur = t.getText();
  var bold = cur.length ? t.isBold(0) : null;
  var size = cur.length ? t.getFontSize(0) : null;
  while (cell.getNumChildren() > 1) cell.removeChild(cell.getChild(cell.getNumChildren() - 1));
  var p = cell.getChild(0).asParagraph();
  p.setText(text);
  var pt = p.editAsText();
  if (bold !== null) pt.setBold(bold);
  if (size) pt.setFontSize(size);
}

function lit_(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
}

function ordinal_(n) {
  var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmt_(d, pattern) { return Utilities.formatDate(d, TZ, pattern); }

function idFromUrl_(url) {
  var m = String(url || '').match(/[-\w]{25,}/);
  if (!m) throw new Error('No document ID in ' + url);
  return m[0];
}

function clean_(s) { return String(s || '').replace(/[\r\n\/\\]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); }

function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

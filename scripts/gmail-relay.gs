/**
 * Tosinfinity Academy — Gmail relay (Google Apps Script)
 * ======================================================
 * Sends the platform's emails (activation links, invoices, reminders, announcements,
 * newsletter) through the Gmail account that owns this script.
 *
 * The website POSTs JSON to this script's web-app URL:
 *   { secret, template, to, subject, html, text, from }
 * and receives JSON back: { ok: true } or { ok: false, error: "..." }.
 *
 * SETUP (about five minutes)
 *  1. Sign in to the Gmail account that should send the academy's email.
 *  2. Open https://script.google.com → New project. Name it "Tosinfinity Mail Relay".
 *  3. Delete the sample code and paste this whole file. Save.
 *  4. Project Settings (gear icon) → Script properties → Add script property:
 *        RELAY_SECRET   a long random password you invent (40+ characters)
 *     Optional properties:
 *        SENDER_NAME    name shown to recipients     (default: Tosinfinity Academy)
 *        REPLY_TO       address replies should go to (default: this Gmail account)
 *        SEND_AS        a verified Gmail "Send mail as" alias to send from
 *        LOG_SHEET_ID   ID of a Google Sheet for a delivery log (see step 8)
 *        DAILY_LIMIT    stop sending after this many emails per day (default 90)
 *  5. In the editor choose the function "testSend" and press Run. Approve the
 *     permissions Google asks for. You should receive a test email.
 *  6. Deploy → New deployment → type "Web app".
 *        Execute as:      Me
 *        Who has access:  Anyone
 *     Deploy, then copy the Web app URL (it ends in /exec).
 *  7. On the website's server (Vercel → Settings → Environment Variables, and
 *     .env.local on your computer) set:
 *        EMAIL_PROVIDER=relay
 *        EMAIL_RELAY_URL=<the /exec URL>
 *        EMAIL_RELAY_SECRET=<the same RELAY_SECRET>
 *     Redeploy the website.
 *  8. Optional log: create a Google Sheet, copy the ID from its address
 *     (the part between /d/ and /edit) into LOG_SHEET_ID. Each send adds a row with
 *     the time, template, recipient and result. Message text is never logged.
 *
 * AFTER EDITING THIS SCRIPT you must publish it again:
 *     Deploy → Manage deployments → pencil icon → Version: New version → Deploy.
 *     (The URL stays the same.)
 *
 * LIMITS: Google allows roughly 100 recipients a day on a free Gmail account and
 * 1,500 on Google Workspace. The script refuses politely once the limit is near, and
 * the website shows that the email was not sent.
 *
 * SECURITY: "Anyone" access is required so the website can reach the script, so the
 * secret is what protects it. Keep it long, never share it, and change it in both
 * places if you think it has leaked. Wrong-secret attempts are counted and the
 * script locks itself for ten minutes after repeated failures.
 */

var DEFAULTS = { SENDER_NAME: 'Tosinfinity Academy', DAILY_LIMIT: 90 };
var MAX_SUBJECT = 200;
var MAX_BODY = 200000; // characters of HTML
var EMAIL_PATTERN = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]{2,}$/;

/** Web-app entry point. The website calls this for every email. */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  try {
    if (cache.get('locked')) return reply_(false, 'temporarily locked');

    var data;
    try {
      data = JSON.parse((e && e.postData && e.postData.contents) || '');
    } catch (parseError) {
      return reply_(false, 'invalid json');
    }

    // --- Authentication ---------------------------------------------------
    var expected = props.getProperty('RELAY_SECRET');
    if (!expected || expected.length < 20) return reply_(false, 'relay secret is not set');
    if (!data || !safeEqual_(String(data.secret || ''), expected)) {
      noteFailure_(cache);
      return reply_(false, 'unauthorised');
    }

    // --- Validation -------------------------------------------------------
    var to = String(data.to || '').trim();
    var subject = String(data.subject || '').replace(/[\r\n]+/g, ' ').trim(); // no header injection
    var html = String(data.html || '');
    var text = String(data.text || '');
    var template = String(data.template || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);

    if (!EMAIL_PATTERN.test(to) || to.length > 254) return reply_(false, 'invalid recipient');
    if (!subject || subject.length > MAX_SUBJECT) return reply_(false, 'invalid subject');
    if (!html && !text) return reply_(false, 'empty message');
    if (html.length > MAX_BODY || text.length > MAX_BODY) return reply_(false, 'message too large');

    // --- Daily limits -----------------------------------------------------
    var limit = Number(props.getProperty('DAILY_LIMIT')) || DEFAULTS.DAILY_LIMIT;
    var sentToday = countToday_(props, 0);
    if (sentToday >= limit) {
      log_(props, template, to, 'refused: daily limit reached');
      return reply_(false, 'daily limit reached');
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      log_(props, template, to, 'refused: Gmail quota used up');
      return reply_(false, 'gmail quota used up');
    }

    // --- Send -------------------------------------------------------------
    var options = {
      name: props.getProperty('SENDER_NAME') || DEFAULTS.SENDER_NAME,
      htmlBody: html || undefined,
    };
    var replyTo = props.getProperty('REPLY_TO');
    if (replyTo && EMAIL_PATTERN.test(replyTo)) options.replyTo = replyTo;

    var alias = props.getProperty('SEND_AS');
    if (alias && GmailApp.getAliases().indexOf(alias) !== -1) options.from = alias;

    GmailApp.sendEmail(to, subject, text || stripHtml_(html), options);

    countToday_(props, 1);
    log_(props, template, to, 'sent');
    return reply_(true);
  } catch (err) {
    // The error is returned to the website (which records a short reason) and written
    // to the Apps Script execution log. No message content is included.
    console.error('Relay error: ' + (err && err.message ? err.message : err));
    return reply_(false, 'send failed');
  }
}

/** Opening the URL in a browser shows that the relay is alive. It reveals nothing else. */
function doGet() {
  return reply_(true, undefined, { service: 'Tosinfinity mail relay', status: 'running' });
}

/** Run this once from the editor to grant permissions and check delivery to yourself. */
function testSend() {
  var me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, 'Tosinfinity mail relay: test', 'If you can read this, the relay can send email from this account.', {
    name: PropertiesService.getScriptProperties().getProperty('SENDER_NAME') || DEFAULTS.SENDER_NAME,
    htmlBody: '<p>If you can read this, the relay can send email from this account.</p>',
  });
  Logger.log('Test email sent to ' + me + '. Remaining quota today: ' + MailApp.getRemainingDailyQuota());
}

/** Run from the editor to see today's count and Gmail's remaining quota. */
function showStatus() {
  var props = PropertiesService.getScriptProperties();
  Logger.log('Sent today by this relay: ' + countToday_(props, 0));
  Logger.log('Gmail quota remaining today: ' + MailApp.getRemainingDailyQuota());
  Logger.log('Secret set: ' + Boolean(props.getProperty('RELAY_SECRET')));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reply_(ok, error, extra) {
  var body = extra || {};
  body.ok = ok;
  if (error) body.error = error;
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

/** Compares every character so the time taken does not reveal how much matched. */
function safeEqual_(a, b) {
  var diff = a.length === b.length ? 0 : 1;
  for (var i = 0; i < b.length; i++) {
    diff |= (a.charCodeAt(i % Math.max(a.length, 1)) || 0) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** After 10 wrong secrets within ten minutes, refuse everything for ten minutes. */
function noteFailure_(cache) {
  var n = Number(cache.get('failures') || 0) + 1;
  cache.put('failures', String(n), 600);
  if (n >= 10) cache.put('locked', '1', 600);
}

/** Reads (add = 0) or increases today's send count, safely when calls overlap. */
function countToday_(props, add) {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (!add) {
    return props.getProperty('COUNT_DAY') === today ? Number(props.getProperty('COUNT') || 0) : 0;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var current = props.getProperty('COUNT_DAY') === today ? Number(props.getProperty('COUNT') || 0) : 0;
    props.setProperties({ COUNT_DAY: today, COUNT: String(current + add) });
    return current + add;
  } finally {
    lock.releaseLock();
  }
}

/** Optional delivery log. Records who and when, never the message. */
function log_(props, template, to, result) {
  var sheetId = props.getProperty('LOG_SHEET_ID');
  if (!sheetId) return;
  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Template', 'Recipient', 'Result']);
    // A leading apostrophe stops a spreadsheet treating the value as a formula.
    sheet.appendRow([new Date(), template, "'" + to, result]);
  } catch (err) {
    console.error('Log sheet error: ' + (err && err.message ? err.message : err));
  }
}

/** Plain-text fallback for mail clients that do not show HTML. */
function stripHtml_(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

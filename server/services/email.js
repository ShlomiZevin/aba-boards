const nodemailer = require('nodemailer');

// Outgoing mail, sent through Google's SMTP as SMTP_USER (a Workspace mailbox
// with an app password). Everything here is best-effort: a mail problem must
// never fail or slow down the request that triggered it.
//
//   SMTP_USER        the sending mailbox, e.g. shlomi@boostart.io
//   SMTP_PASS        a Google app password for that mailbox (not the login password)
//   FORM_NOTIFY_TO   who hears about new session forms in the super admin's centre
//   PUBLIC_SITE_URL  optional; the site mail links point to (default https://startdoing.co.il)

const SEND_TIMEOUT_MS = 8000;
const SUPER_ADMIN_ID = 'michal-super-admin';

let transport = null;

function isConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
  }
  return transport;
}

/** For tests: swap in a transport that doesn't touch the network. */
function setTransportForTests(t) {
  transport = t;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  const d = value && value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', year: 'numeric' });
}

/** Who should hear about a new form for this centre, or null for nobody. */
function formNotifyRecipient(adminId) {
  // Only the super admin's own centre for now — other centres haven't asked for mail.
  if (adminId !== SUPER_ADMIN_ID) return null;
  return process.env.FORM_NOTIFY_TO || null;
}

/**
 * Links in mail always point at the public site. Deliberately not APP_BASE_URL:
 * that one is shared with local development and has been a localhost address
 * in production — a mail link must work from anyone's inbox.
 */
function appBase() {
  return (process.env.PUBLIC_SITE_URL || 'https://startdoing.co.il').replace(/\/$/, '');
}

function mailButton(href, label, primary) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 0 8px 8px;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:15px;${
    primary ? 'background:#6c63e0;color:#ffffff;' : 'background:#eeebfc;color:#4b43b8;'
  }">${escapeHtml(label)}</a>`;
}

/** The one mail layout: heading, a sentence (already escaped HTML), buttons, footnote. */
function renderMail({ heading, sentenceHtml, buttons, footnote }) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<body style="margin:0;padding:24px;background:#f5f7fc;font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;color:#1f2544;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px;">
    <div style="font-size:13px;color:#8a90ab;margin-bottom:6px;">Doing · מרכז הטיפול</div>
    <h1 style="margin:0 0 14px;font-size:21px;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${sentenceHtml}</p>
    <div>
      ${buttons.map(([href, label], i) => mailButton(href, label, i === 0)).join('\n      ')}
    </div>
    <p style="margin:22px 0 0;font-size:12px;color:#8a90ab;line-height:1.5;">${escapeHtml(footnote)}</p>
  </div>
</body>
</html>`;
}

/**
 * The message for "a session form was filed". Names, date and links only —
 * the form's clinical content stays inside the app, behind login.
 */
function buildFormNotification({ kidId, kidName, practitionerName, sessionDate, formId }) {
  const formUrl = `${appBase()}/therapy/form/${encodeURIComponent(formId)}/view`;
  const kidUrl = `${appBase()}/therapy/kid/${encodeURIComponent(kidId)}`;
  const date = formatDate(sessionDate);
  const who = practitionerName || 'איש צוות';
  const kid = kidName || 'ילד';

  const subject = `טופס טיפול חדש — ${kid}${date ? ` · ${date}` : ''}`;
  const text = [
    `${who} מילא/ה טופס טיפול עבור ${kid}${date ? ` (טיפול מתאריך ${date})` : ''}.`,
    '',
    `לצפייה בטופס: ${formUrl}`,
    `לעמוד של ${kid}: ${kidUrl}`,
  ].join('\n');
  const html = renderMail({
    heading: 'טופס טיפול חדש',
    sentenceHtml: `<strong>${escapeHtml(who)}</strong> מילא/ה טופס טיפול עבור <strong>${escapeHtml(kid)}</strong>${
      date ? ` (טיפול מתאריך ${escapeHtml(date)})` : ''
    }.`,
    buttons: [[formUrl, 'לצפייה בטופס'], [kidUrl, `לעמוד של ${kid}`]],
    footnote: 'תוכן הטופס אינו מצורף למייל — הוא זמין רק לאחר כניסה למערכת.',
  });
  return { subject, text, html };
}

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * "A daily report was opened for this day". Sent once, when the day's report
 * is first created — it fills in through the day, so the link shows it live.
 */
function buildDailyReportNotification({ kidId, kidName, reporter, date }) {
  const reportUrl = `${appBase()}/therapy/kid/${encodeURIComponent(kidId)}/daily-reports/${date}`;
  const kidUrl = `${appBase()}/therapy/kid/${encodeURIComponent(kidId)}`;
  const [y, m, d] = date.split('-').map(Number);
  const day = `יום ${HE_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d}.${m}.${y}`;
  const who = reporter || 'איש צוות';
  const kid = kidName || 'ילד';

  const subject = `דיווח יומי חדש — ${kid} · ${d}.${m}.${y}`;
  const text = [
    `${who} פתח/ה דיווח יומי עבור ${kid} ל${day}.`,
    'הדיווח מתעדכן במהלך היום — הקישור תמיד מציג את המצב העדכני.',
    '',
    `לצפייה בדיווח: ${reportUrl}`,
    `לעמוד של ${kid}: ${kidUrl}`,
  ].join('\n');
  const html = renderMail({
    heading: 'דיווח יומי חדש',
    sentenceHtml: `<strong>${escapeHtml(who)}</strong> פתח/ה דיווח יומי עבור <strong>${escapeHtml(kid)}</strong> ל${escapeHtml(day)}.<br>הדיווח מתעדכן במהלך היום — הקישור תמיד מציג את המצב העדכני.`,
    buttons: [[reportUrl, 'לצפייה בדיווח'], [kidUrl, `לעמוד של ${kid}`]],
    footnote: 'תוכן הדיווח אינו מצורף למייל — הוא זמין רק לאחר כניסה למערכת.',
  });
  return { subject, text, html };
}

/**
 * Sends and resolves to true/false — never throws. Awaited by the caller with
 * a hard time limit, because Cloud Run may freeze the instance as soon as the
 * response goes out, which would strand a fire-and-forget send.
 */
async function sendMail({ to, subject, text, html, replyTo }) {
  if (!to) return false;
  if (!isConfigured()) {
    console.log('[email] not configured (SMTP_USER / SMTP_PASS) — skipped:', subject);
    return false;
  }
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timed out')), SEND_TIMEOUT_MS);
    });
    await Promise.race([
      getTransport().sendMail({ from: `Doing <${process.env.SMTP_USER}>`, to, subject, text, html, ...(replyTo ? { replyTo } : {}) }),
      timeout,
    ]);
    console.log('[email] sent:', subject);
    return true;
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The treatment agreement, sent to one parent with their family's link to read
 * and sign it. The link is the family's own portal (/p/:kidId), so the mail
 * says plainly not to forward it.
 */
function buildAgreementInvite({ kidId, kidName, parentName, senderName }) {
  const link = `${appBase()}/therapy/p/${encodeURIComponent(kidId)}/agreement`;
  const kid = kidName || 'ילדכם';
  const sender = senderName || 'צוות המרכז';
  const hello = parentName ? `שלום ${parentName},` : 'שלום,';

  const subject = `הסכם הטיפול של ${kid} ממתין לחתימתכם`;
  const text = [
    hello,
    '',
    `${sender} שלח/ה אליכם את הסכם ההתקשרות לטיפול עבור ${kid}.`,
    'ניתן לעיין בהסכם ולחתום עליו ישירות מהטלפון, בקישור הבא:',
    link,
    '',
    'הקישור אישי למשפחתכם — נא לא להעביר אותו לאחרים.',
  ].join('\n');
  const html = renderMail({
    heading: 'הסכם הטיפול ממתין לחתימתכם',
    sentenceHtml: `${escapeHtml(hello)}<br><br><strong>${escapeHtml(sender)}</strong> שלח/ה אליכם את הסכם ההתקשרות לטיפול עבור <strong>${escapeHtml(kid)}</strong>.<br>ניתן לעיין בהסכם ולחתום עליו ישירות מהטלפון.`,
    buttons: [[link, 'לעיון ולחתימה על ההסכם']],
    footnote: 'הקישור אישי למשפחתכם — נא לא להעביר אותו לאחרים.',
  });
  return { subject, text, html, link };
}

/** "A parent signed the agreement" — to the centre's manager, with a link to it. */
function buildAgreementSignedNotification({ kidId, kidName, signerName, fullySigned }) {
  const agreementUrl = `${appBase()}/therapy/kid/${encodeURIComponent(kidId)}/agreement`;
  const kid = kidName || 'ילד';
  const who = signerName || 'הורה';
  const subject = `${who} חתם/ה על הסכם הטיפול של ${kid}`;
  const status = fullySigned ? 'כל הצדדים חתמו — ההסכם מלא.' : 'ההסכם עדיין ממתין לחתימות נוספות.';
  const text = [`${who} חתם/ה על הסכם הטיפול של ${kid}.`, status, '', `לצפייה בהסכם החתום: ${agreementUrl}`].join('\n');
  const html = renderMail({
    heading: 'חתימה חדשה על הסכם הטיפול',
    sentenceHtml: `<strong>${escapeHtml(who)}</strong> חתם/ה על הסכם הטיפול של <strong>${escapeHtml(kid)}</strong>.<br>${escapeHtml(status)}`,
    buttons: [[agreementUrl, 'לצפייה בהסכם החתום']],
    footnote: 'החתימה עצמה שמורה במערכת ומוצגת בעמוד ההסכם.',
  });
  return { subject, text, html };
}

module.exports = {
  isConfigured,
  formNotifyRecipient,
  buildFormNotification,
  buildDailyReportNotification,
  buildAgreementInvite,
  buildAgreementSignedNotification,
  sendMail,
  setTransportForTests,
};

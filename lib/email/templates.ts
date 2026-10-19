import { brandColors } from '@/lib/design-tokens';

export type WeeklyReportData = {
  name: string; // the recipient
  studentName: string;
  forParent: boolean;
  weekLabel: string; // e.g. "12 – 18 October 2026"
  lessons: { attended: number; total: number; items: Array<{ title: string; when: string; status: string }> };
  handedIn: string[];
  marked: Array<{ title: string; score: string }>;
  overdue: string[];
  merits: Array<{ category: string; points: number; kind: 'merit' | 'concern' }>;
  nextLessons: Array<{ title: string; when: string }>;
  dueSoon: Array<{ title: string; due: string }>;
  balance?: string | null; // parents only
};

export type TemplateData = {
  applicationReceived: { guardianName: string; studentName: string };
  applicationNotifyOwner: { studentName: string; guardianName: string; subjects: string[]; delivery: string };
  applicationRejected: { guardianName: string; studentName: string; reason: string };
  accountActivation: { name: string; link: string; studentCode?: string; role: 'student' | 'parent'; email?: string; childNames?: string[] };
  passwordRecovery: { link: string };
  upcomingClass: { name: string; title: string; when: string; where: string; childName?: string };
  assignmentSet: { name: string; title: string; due: string };
  assignmentDue: { name: string; title: string; due: string; childName?: string };
  assignmentGraded: { name: string; title: string };
  newMessage: { name: string };
  newAnnouncement: { name: string; title: string };
  invoiceIssued: { name: string; number: string; amount: string; due: string };
  paymentReminder: { name: string; number: string; amount: string; due: string; overdue: boolean };
  paymentReceipt: { name: string; number: string; amount: string; reference: string };
  weeklyReport: WeeklyReportData;
  testEmail: { provider: string };
  blogPublished: { title: string; excerpt: string; slug: string; unsubscribeToken: string };
  newsletterVerify: { token: string };
};
export type TemplateName = keyof TemplateData;

export type Rendered = { subject: string; html: string; text: string };

/** Where sendEmail puts the "manage email preferences" link for optional emails. */
export const MANAGE_MARKER = '<!--manage-->';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const C = brandColors;

/** A content block: HTML (built only from escaped values) plus its plain-text twin. */
type Block = { html: string; text: string };

function para(s: string): Block {
  return { html: `<p style="margin:0 0 14px;line-height:1.6">${esc(s)}</p>`, text: s };
}

/** A row of figures, e.g. lessons attended / work handed in. */
function stats(items: Array<[label: string, value: string]>): Block {
  const cells = items
    .map(([l, v]) => `<td style="padding:12px;background:${C.cloud};border-radius:12px;text-align:center"><div style="font-size:22px;font-weight:700;color:${C.navy}">${esc(v)}</div><div style="font-size:12px;color:${C.muted}">${esc(l)}</div></td>`)
    .join('<td style="width:8px"></td>');
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr>${cells}</tr></table>`,
    text: items.map(([l, v]) => `${l}: ${v}`).join(' · '),
  };
}

/** Label and value rows (values wrap, so long email addresses fit on a phone). */
function details(rows: Array<[label: string, value: string]>): Block {
  if (!rows.length) return { html: '', text: '' };
  const tr = rows
    .map(([l, v]) => `<tr><td style="padding:10px 14px;font-size:13px;color:${C.muted};white-space:nowrap;vertical-align:top">${esc(l)}</td><td style="padding:10px 14px;font-size:16px;font-weight:700;color:${C.navy};word-break:break-all">${esc(v)}</td></tr>`)
    .join('');
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:${C.cloud};border-radius:12px">${tr}</table>`,
    text: rows.map(([l, v]) => `${l}: ${v}`).join('\n'),
  };
}

/** A titled list. Empty lists are skipped. */
function list(title: string, items: string[], empty?: string): Block {
  if (!items.length && !empty) return { html: '', text: '' };
  const body = items.length
    ? `<ul style="margin:0 0 18px;padding-left:20px;line-height:1.6">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 18px;color:${C.muted}">${esc(empty!)}</p>`;
  return {
    html: `<h3 style="margin:0 0 6px;font-size:15px;color:${C.navy}">${esc(title)}</h3>${body}`,
    text: `${title}\n${items.length ? items.map((i) => `- ${i}`).join('\n') : empty}`,
  };
}

function layout(subject: string, blocks: Array<string | Block>, opts: { cta?: { label: string; href: string }; preheader?: string; footer?: string } = {}): Rendered {
  const parts = blocks.map((b) => (typeof b === 'string' ? para(b) : b)).filter((b) => b.html || b.text);
  const button = opts.cta
    ? `<p style="margin:24px 0"><a href="${esc(opts.cta.href)}" style="background:${C.orange};color:${C.navy};font-weight:700;text-decoration:none;padding:13px 24px;border-radius:12px;display:inline-block">${esc(opts.cta.label)}</a></p>`
    : '';
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>` : '';
  const html = `<!doctype html><html><head><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:${C.cloud};font-family:Arial,Helvetica,sans-serif;color:${C.ink}">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:18px;overflow:hidden;border:1px solid ${C.line}">
<tr><td style="background:${C.navy};padding:20px 24px;color:#fff;font-weight:700;font-size:18px">Tosinfinity <span style="color:${C.gold}">Academy</span></td></tr>
<tr><td style="padding:26px 24px;font-size:15px">${parts.map((p) => p.html).join('')}${button}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${C.line};font-size:12px;line-height:1.5;color:${C.muted}">${opts.footer ?? 'You are receiving this email because of your relationship with Tosinfinity Academy.'}${MANAGE_MARKER}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [...parts.map((p) => p.text), opts.cta ? `${opts.cta.label}: ${opts.cta.href}` : ''].filter(Boolean).join('\n\n');
  return { subject, html, text };
}

export const templates: { [K in TemplateName]: (d: TemplateData[K], siteUrl: string) => Rendered } = {
  applicationReceived: (d) =>
    layout('We have received your tutoring application', [
      `Dear ${d.guardianName},`,
      `Thank you for applying for tutoring for ${d.studentName}. Your application has been received.`,
      'We will review it and contact you to discuss the next steps. No payment is required at this stage.',
    ], { preheader: `Application received for ${d.studentName}` }),
  applicationNotifyOwner: (d, site) =>
    layout(
      `New tutoring application: ${d.studentName}`,
      [`${d.guardianName} has applied for ${d.delivery} tutoring for ${d.studentName}.`, `Subjects: ${d.subjects.join(', ') || 'not specified'}.`],
      { cta: { label: 'Review application', href: `${site}/owner/applications` } },
    ),
  applicationRejected: (d) =>
    layout('Update on your tutoring application', [
      `Dear ${d.guardianName},`,
      `Thank you for your interest in tutoring for ${d.studentName}. We are unable to offer a place at this time.`,
      d.reason,
    ]),
  // Sign-up details. Never contains a password: the learner or parent chooses one with the one-time link.
  accountActivation: (d, site) => {
    const student = d.role === 'student';
    return layout(
      student ? 'Welcome to Tosinfinity Academy: your sign-in details' : 'Welcome to Tosinfinity Academy: your parent account',
      [
        `Hello ${d.name},`,
        student
          ? 'Welcome! Your student account is ready. Here is everything you need to get started.'
          : `Welcome! Your parent account is ready${d.childNames?.length ? ` and linked to ${d.childNames.join(' and ')}` : ''}. You can follow classes, progress, reports and invoices in one place.`,
        details([
          ...(student && d.studentCode ? [['Student ID', d.studentCode] as [string, string]] : []),
          ...(d.email ? [['Sign-in email', d.email] as [string, string]] : []),
        ]),
        list('Get started', [
          'Press the button below and choose your password (the link works once and expires).',
          `Sign in at ${site}/login${student && d.studentCode ? ' with your student ID or your email' : ' with your email'}.`,
          student
            ? 'Open your timetable to join lessons, then try your assignments and Learn with AI.'
            : 'You will receive a short progress email every Friday, and reminders before lessons.',
        ]),
        'If the link has expired, use “Forgot password” on the sign-in page. We will never ask for your password by email or phone.',
      ],
      { cta: { label: 'Set my password', href: d.link }, preheader: student && d.studentCode ? `Your student ID is ${d.studentCode}` : 'Your account is ready' },
    );
  },
  passwordRecovery: (d) =>
    layout('Reset your password', ['We received a request to reset your password. If this was not you, you can ignore this email.'], {
      cta: { label: 'Choose a new password', href: d.link },
    }),
  upcomingClass: (d, site) =>
    layout(
      `Class reminder: ${d.title}`,
      [`Hello ${d.name},`, d.childName ? `${d.childName} has a class: ${d.title}, ${d.when}.` : `${d.title} is scheduled for ${d.when}.`, d.where],
      { cta: { label: 'Open timetable', href: `${site}/login` }, preheader: `${d.title}, ${d.when}` },
    ),
  assignmentSet: (d, site) =>
    layout(`New work: ${d.title}`, [`Hello ${d.name},`, `New work has been set: “${d.title}”. It is due ${d.due}.`], {
      cta: { label: 'Open assignment', href: `${site}/login` }, preheader: `Due ${d.due}`,
    }),
  assignmentDue: (d, site) =>
    layout(
      `Due soon: ${d.title}`,
      [`Hello ${d.name},`, d.childName ? `${d.childName} has work due ${d.due}: “${d.title}”. It has not been handed in yet.` : `“${d.title}” is due ${d.due} and has not been handed in yet.`],
      { cta: { label: 'Open assignment', href: `${site}/login` }, preheader: `Due ${d.due}` },
    ),
  assignmentGraded: (d, site) =>
    layout(`Marked: ${d.title}`, [`Hello ${d.name},`, `“${d.title}” has been marked. Sign in to see the result and feedback.`], {
      cta: { label: 'View result', href: `${site}/login` },
    }),
  newMessage: (d, site) =>
    layout('You have a new message', [`Hello ${d.name},`, 'You have a new message from Tosinfinity Academy. For privacy, the message is only shown inside your account.'], {
      cta: { label: 'Read message', href: `${site}/login` },
    }),
  newAnnouncement: (d, site) =>
    layout(`Announcement: ${d.title}`, [`Hello ${d.name},`, `A new announcement has been posted: ${d.title}.`], {
      cta: { label: 'Read announcement', href: `${site}/login` },
    }),
  invoiceIssued: (d, site) =>
    layout(`Invoice ${d.number}`, [`Hello ${d.name},`, `Invoice ${d.number} for ${d.amount} has been issued. It is due on ${d.due}.`], {
      cta: { label: 'View invoice', href: `${site}/login` },
    }),
  paymentReminder: (d, site) =>
    layout(
      d.overdue ? `Overdue: invoice ${d.number}` : `Reminder: invoice ${d.number}`,
      [
        `Hello ${d.name},`,
        d.overdue
          ? `Invoice ${d.number} has an outstanding balance of ${d.amount} and was due on ${d.due}.`
          : `Invoice ${d.number} has an outstanding balance of ${d.amount}, due on ${d.due}.`,
        'If you have already paid, please disregard this reminder.',
      ],
      { cta: { label: 'View invoice', href: `${site}/login` } },
    ),
  paymentReceipt: (d, site) =>
    layout(`Payment received for ${d.number}`, [`Hello ${d.name},`, `We have received ${d.amount} towards invoice ${d.number}.`, `Reference: ${d.reference}`], {
      cta: { label: 'View receipt', href: `${site}/login` },
    }),
  weeklyReport: (d, site) => {
    const who = d.forParent ? d.studentName.split(' ')[0]! : 'you';
    const merits = d.merits.filter((m) => m.kind === 'merit');
    const concerns = d.merits.filter((m) => m.kind === 'concern');
    return layout(
      d.forParent ? `${d.studentName}: weekly update (${d.weekLabel})` : `Your week at Tosinfinity Academy (${d.weekLabel})`,
      [
        `Hello ${d.name},`,
        d.forParent ? `Here is ${who}’s week at a glance.` : 'Here is your week at a glance. Keep it up!',
        stats([
          ['Lessons attended', `${d.lessons.attended}/${d.lessons.total}`],
          ['Work handed in', String(d.handedIn.length)],
          ['Merit points', String(merits.reduce((s, m) => s + m.points, 0))],
        ]),
        list('Lessons this week', d.lessons.items.map((l) => `${l.title}, ${l.when}: ${l.status}`), 'No lessons this week.'),
        list('Marked this week', d.marked.map((m) => `${m.title}: ${m.score}`)),
        list('Overdue work', d.overdue.map((t) => `${t} (not handed in)`)),
        list('Merits', merits.map((m) => `${m.category} (+${m.points})`)),
        list('Things to work on', concerns.map((m) => m.category)),
        list('Coming up next week', [...d.nextLessons.map((l) => `${l.title}, ${l.when}`), ...d.dueSoon.map((w) => `Due ${w.due}: ${w.title}`)], 'Nothing scheduled yet.'),
        ...(d.forParent && d.balance ? [para(`Balance due on invoices: ${d.balance}.`)] : []),
      ],
      { cta: { label: d.forParent ? 'Open the parent portal' : 'Open my portal', href: `${site}/login` }, preheader: `${d.lessons.attended} of ${d.lessons.total} lessons attended this week` },
    );
  },
  testEmail: (d) =>
    layout('Test email from Tosinfinity Academy', [
      'This is a test sent from the Email centre.',
      `If you can read it, email delivery through “${d.provider}” is working. Check that it arrived in the inbox rather than spam.`,
    ]),
  blogPublished: (d, site) =>
    layout(d.title, [d.excerpt], {
      cta: { label: 'Read the article', href: `${site}/blog/${d.slug}` },
      footer: `You subscribed to Tosinfinity Academy articles. <a href="${site}/api/newsletter/unsubscribe?token=${esc(d.unsubscribeToken)}">Unsubscribe</a>`,
    }),
  newsletterVerify: (d, site) =>
    layout(
      'Confirm your subscription',
      ['Please confirm that you would like to receive new articles from Tosinfinity Academy. If you did not request this, ignore this email.'],
      { cta: { label: 'Confirm subscription', href: `${site}/api/newsletter/verify?token=${d.token}` } },
    ),
};

/**
 * Which emails can be switched off. Essential ones (sign-in, billing, applications)
 * are always sent. The newsletter has its own unsubscribe.
 */
export const CATEGORY: Record<TemplateName, 'essential' | 'reminders' | 'updates' | 'reports'> = {
  applicationReceived: 'essential',
  applicationNotifyOwner: 'essential',
  applicationRejected: 'essential',
  accountActivation: 'essential',
  passwordRecovery: 'essential',
  invoiceIssued: 'essential',
  paymentReminder: 'essential',
  paymentReceipt: 'essential',
  testEmail: 'essential',
  newsletterVerify: 'essential',
  blogPublished: 'essential',
  upcomingClass: 'reminders',
  assignmentSet: 'updates',
  assignmentDue: 'reminders',
  assignmentGraded: 'updates',
  newMessage: 'updates',
  newAnnouncement: 'updates',
  weeklyReport: 'reports',
};

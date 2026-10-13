import { brandColors } from '@/lib/design-tokens';

export type TemplateData = {
  applicationReceived: { guardianName: string; studentName: string };
  applicationNotifyOwner: { studentName: string; guardianName: string; subjects: string[]; delivery: string };
  applicationRejected: { guardianName: string; studentName: string; reason: string };
  accountActivation: { name: string; link: string; studentCode?: string; role: 'student' | 'parent' };
  passwordRecovery: { link: string };
  upcomingClass: { name: string; title: string; when: string; where: string };
  assignmentDue: { name: string; title: string; due: string };
  assignmentGraded: { name: string; title: string };
  newMessage: { name: string };
  newAnnouncement: { name: string; title: string };
  invoiceIssued: { name: string; number: string; amount: string; due: string };
  paymentReminder: { name: string; number: string; amount: string; due: string; overdue: boolean };
  paymentReceipt: { name: string; number: string; amount: string; reference: string };
  blogPublished: { title: string; excerpt: string; slug: string; unsubscribeToken: string };
  newsletterVerify: { token: string };
};
export type TemplateName = keyof TemplateData;

type Rendered = { subject: string; html: string; text: string };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

function layout(subject: string, paragraphs: string[], cta?: { label: string; href: string }, footer?: string): Rendered {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p)}</p>`).join('');
  const button = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta.href)}" style="background:${brandColors.orange};color:${brandColors.navy};font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;display:inline-block">${esc(cta.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:${brandColors.cloud};font-family:Arial,Helvetica,sans-serif;color:${brandColors.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid ${brandColors.line}">
<tr><td style="background:${brandColors.navy};padding:18px 24px;color:#fff;font-weight:700;font-size:18px">Tosinfinity <span style="color:${brandColors.gold}">Academy</span></td></tr>
<tr><td style="padding:24px;font-size:15px">${body}${button}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${brandColors.line};font-size:12px;color:${brandColors.muted}">${footer ?? 'You are receiving this email because of your relationship with Tosinfinity Academy.'}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [...paragraphs, cta ? `${cta.label}: ${cta.href}` : ''].filter(Boolean).join('\n\n');
  return { subject, html, text };
}

export const templates: { [K in TemplateName]: (d: TemplateData[K], siteUrl: string) => Rendered } = {
  applicationReceived: (d) =>
    layout('We have received your tutoring application', [
      `Dear ${d.guardianName},`,
      `Thank you for applying for tutoring for ${d.studentName}. Your application has been received.`,
      'We will review it and contact you to discuss the next steps. No payment is required at this stage.',
    ]),
  applicationNotifyOwner: (d, site) =>
    layout(
      `New tutoring application: ${d.studentName}`,
      [
        `${d.guardianName} has applied for ${d.delivery} tutoring for ${d.studentName}.`,
        `Subjects: ${d.subjects.join(', ') || 'not specified'}.`,
      ],
      { label: 'Review application', href: `${site}/owner/applications` },
    ),
  applicationRejected: (d) =>
    layout('Update on your tutoring application', [
      `Dear ${d.guardianName},`,
      `Thank you for your interest in tutoring for ${d.studentName}. We are unable to offer a place at this time.`,
      d.reason,
    ]),
  accountActivation: (d) =>
    layout(
      'Activate your Tosinfinity Academy account',
      [
        `Hello ${d.name},`,
        d.role === 'student'
          ? `Your student account is ready.${d.studentCode ? ` Your student ID is ${d.studentCode}.` : ''}`
          : 'Your parent account is ready. You will be able to follow your child’s classes, progress and invoices.',
        'Use the button below to choose your password. For your security the link expires and can be used once. If it has expired, use “Forgot password” on the sign-in page.',
      ],
      { label: 'Set my password', href: d.link },
    ),
  passwordRecovery: (d) =>
    layout(
      'Reset your password',
      ['We received a request to reset your password. If this was not you, you can ignore this email.'],
      { label: 'Choose a new password', href: d.link },
    ),
  upcomingClass: (d, site) =>
    layout(
      `Class reminder: ${d.title}`,
      [`Hello ${d.name},`, `${d.title} is scheduled for ${d.when}.`, d.where],
      { label: 'Open timetable', href: `${site}/login` },
    ),
  assignmentDue: (d, site) =>
    layout(`Assignment due: ${d.title}`, [`Hello ${d.name},`, `"${d.title}" is due ${d.due}.`], {
      label: 'Open assignment',
      href: `${site}/login`,
    }),
  assignmentGraded: (d, site) =>
    layout(`Marked: ${d.title}`, [`Hello ${d.name},`, `"${d.title}" has been marked. Sign in to see the result and feedback.`], {
      label: 'View result',
      href: `${site}/login`,
    }),
  newMessage: (d, site) =>
    layout('You have a new message', [`Hello ${d.name},`, 'You have a new message from Tosinfinity Academy. For privacy, the message is only shown inside your account.'], {
      label: 'Read message',
      href: `${site}/login`,
    }),
  newAnnouncement: (d, site) =>
    layout(`Announcement: ${d.title}`, [`Hello ${d.name},`, `A new announcement has been posted: ${d.title}.`], {
      label: 'Read announcement',
      href: `${site}/login`,
    }),
  invoiceIssued: (d, site) =>
    layout(`Invoice ${d.number}`, [`Hello ${d.name},`, `Invoice ${d.number} for ${d.amount} has been issued. It is due on ${d.due}.`], {
      label: 'View invoice',
      href: `${site}/login`,
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
      { label: 'View invoice', href: `${site}/login` },
    ),
  paymentReceipt: (d, site) =>
    layout(`Payment received for ${d.number}`, [`Hello ${d.name},`, `We have received ${d.amount} towards invoice ${d.number}.`, `Reference: ${d.reference}`], {
      label: 'View receipt',
      href: `${site}/login`,
    }),
  blogPublished: (d, site) =>
    layout(
      d.title,
      [d.excerpt],
      { label: 'Read the article', href: `${site}/blog/${d.slug}` },
      `You subscribed to Tosinfinity Academy articles. <a href="${site}/api/newsletter/unsubscribe?token=${esc(d.unsubscribeToken)}">Unsubscribe</a>`,
    ),
  newsletterVerify: (d, site) =>
    layout(
      'Confirm your subscription',
      ['Please confirm that you would like to receive new articles from Tosinfinity Academy. If you did not request this, ignore this email.'],
      { label: 'Confirm subscription', href: `${site}/api/newsletter/verify?token=${d.token}` },
    ),
};

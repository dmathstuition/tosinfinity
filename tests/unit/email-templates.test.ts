import { describe, expect, it } from 'vitest';
import { CATEGORY, MANAGE_MARKER, templates, type TemplateName, type WeeklyReportData } from '@/lib/email/templates';
import { attendanceLabel, isEmptyReport, weekLabel } from '@/lib/weekly-report';

const SITE = 'https://academy.example.test';

const report: WeeklyReportData = {
  name: 'Ada', studentName: 'Tobi <b>Ade</b>', forParent: true, weekLabel: '12 – 18 Oct 2026',
  lessons: { attended: 2, total: 3, items: [{ title: 'Algebra <script>', when: 'Mon 12 Oct', status: 'attended' }] },
  handedIn: ['Fractions sheet'], marked: [{ title: 'Quiz 3', score: '8/10' }], overdue: ['Essay'],
  merits: [{ category: 'Great effort', points: 2, kind: 'merit' }, { category: 'Late to class', points: 1, kind: 'concern' }],
  nextLessons: [{ title: 'Geometry', when: 'Tue 20 Oct, 16:00' }], dueSoon: [{ title: 'Angles worksheet', due: 'Wed 21 Oct' }], balance: '₦20,000.00',
};

describe('email templates', () => {
  it('every template has a category, and sign-in, billing and applications are essential', () => {
    for (const name of Object.keys(templates) as TemplateName[]) expect(CATEGORY[name], name).toBeDefined();
    for (const name of ['accountActivation', 'passwordRecovery', 'invoiceIssued', 'paymentReminder', 'paymentReceipt'] as const) expect(CATEGORY[name]).toBe('essential');
    expect(CATEGORY.weeklyReport).toBe('reports');
    expect(CATEGORY.upcomingClass).toBe('reminders');
  });

  it('the welcome email gives sign-in details and a link, never a password', () => {
    const r = templates.accountActivation({ name: 'Tobi', link: 'https://x.test/set?t=1', role: 'student', studentCode: 'TA-0042', email: 'tobi@example.test' }, SITE);
    expect(r.subject).toMatch(/sign-in details/);
    expect(r.text).toContain('TA-0042');
    expect(r.text).toContain('tobi@example.test');
    expect(r.text).toContain(`${SITE}/login`);
    expect(r.html).toContain('https://x.test/set?t=1');
    // The details list the ID and email only; the one password mention is the set-password link.
    expect(r.text).not.toMatch(/(^|· )Password:/m);
    expect(r.text).toContain('Set my password: https://x.test/set?t=1');
    const parent = templates.accountActivation({ name: 'Mrs Ade', link: 'https://x.test/l', role: 'parent', childNames: ['Tobi', 'Kemi'] }, SITE);
    expect(parent.text).toContain('linked to Tobi and Kemi');
  });

  it('the weekly report escapes names and titles and shows the balance only to parents', () => {
    const r = templates.weeklyReport(report, SITE);
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('<b>Ade</b>');
    expect(r.html).toContain('Algebra &lt;script&gt;');
    expect(r.text).toContain('Lessons attended: 2/3');
    expect(r.text).toContain('Quiz 3: 8/10');
    expect(r.text).toContain('Late to class');
    expect(r.text).toContain('₦20,000.00');
    const learner = templates.weeklyReport({ ...report, forParent: false, balance: null }, SITE);
    expect(learner.text).not.toContain('Balance');
    expect(learner.subject).toMatch(/Your week/);
  });

  it('leaves a marker where the preferences link goes, and a hidden preview line', () => {
    const r = templates.upcomingClass({ name: 'Ada', title: 'Algebra', when: 'tomorrow 16:00', where: 'Online', childName: 'Tobi' }, SITE);
    expect(r.html).toContain(MANAGE_MARKER);
    expect(r.html).toContain('display:none');
    expect(r.text).toContain('Tobi has a class');
  });
});

describe('weekly report helpers', () => {
  it('describes attendance plainly', () => {
    expect(attendanceLabel('present')).toBe('attended');
    expect(attendanceLabel('late')).toBe('attended (late)');
    expect(attendanceLabel('absent')).toBe('missed');
    expect(attendanceLabel(null)).toBe('not recorded yet');
    expect(attendanceLabel('present', true)).toBe('cancelled');
  });

  it('labels the seven days ending on the given day in the academy time zone', () => {
    expect(weekLabel(new Date('2026-10-16T15:00:00Z'), 'Africa/Lagos')).toBe('10 Oct – 16 Oct 2026');
  });

  it('treats a week with nothing in it as empty', () => {
    const empty = { ...report, lessons: { attended: 0, total: 0, items: [] }, handedIn: [], marked: [], overdue: [], merits: [], nextLessons: [], dueSoon: [] };
    expect(isEmptyReport(empty)).toBe(true);
    expect(isEmptyReport({ ...empty, dueSoon: [{ title: 'x', due: 'y' }] })).toBe(false);
  });
});

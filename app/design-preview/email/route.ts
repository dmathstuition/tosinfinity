import { MANAGE_MARKER, templates } from '@/lib/email/templates';

/**
 * DEVELOPMENT ONLY. Renders an email template with sample data so its design can be
 * checked in a browser: /design-preview/email?t=weeklyReport. 404 in production.
 */
export function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const site = new URL(request.url).origin;
  const t = new URL(request.url).searchParams.get('t') ?? 'weeklyReport';
  const samples = {
    weeklyReport: () => templates.weeklyReport({
      name: 'Sample', studentName: 'Sample Learner', forParent: true, weekLabel: '10 Oct – 16 Oct 2026',
      lessons: { attended: 2, total: 3, items: [
        { title: 'WAEC Mathematics: Algebra', when: 'Mon 12 Oct', status: 'attended' },
        { title: 'WAEC Mathematics: Indices', when: 'Wed 14 Oct', status: 'attended (late)' },
        { title: 'IGCSE Physics: Forces', when: 'Fri 16 Oct', status: 'missed' },
      ] },
      handedIn: ['Fractions practice sheet'], marked: [{ title: 'Algebra quiz', score: '8/10' }], overdue: ['Physics revision questions'],
      merits: [{ category: 'Great effort', points: 2, kind: 'merit' }, { category: 'Homework not done', points: 1, kind: 'concern' }],
      nextLessons: [{ title: 'WAEC Mathematics: Logarithms', when: 'Mon 19 Oct, 16:00' }], dueSoon: [{ title: 'Indices worksheet', due: 'Wed 21 Oct' }],
      balance: '₦20,000.00',
    }, site),
    accountActivation: () => templates.accountActivation({ name: 'Sample Learner', link: `${site}/login`, role: 'student', studentCode: 'TA-0000', email: 'learner@example.test' }, site),
    upcomingClass: () => templates.upcomingClass({ name: 'Sample Parent', title: 'WAEC Mathematics: Logarithms', when: 'Mon 19 Oct 2026, 16:00 (Africa/Lagos time)', where: 'Online. Join from your portal timetable.', childName: 'Sample' }, site),
    assignmentDue: () => templates.assignmentDue({ name: 'Sample', title: 'Indices worksheet', due: 'tomorrow, Wed 21 Oct 2026, 18:00' }, site),
  } as const;
  const render = samples[t as keyof typeof samples] ?? samples.weeklyReport;
  const html = render().html.replace(MANAGE_MARKER, ` <a href="${site}/email/preferences?token=sample" style="color:inherit">Manage email preferences</a>`);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

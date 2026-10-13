import { Logo } from '@/components/brand/Logo';
import type { ReportContent } from '@/lib/reports';
import { formatDate } from '@/lib/time';

/** Printable progress report. Used by the Owner preview and by student/parent views. */
export function ReportDocument({ content, periodStart, periodEnd, draft }: { content: ReportContent; periodStart: string; periodEnd: string; draft?: boolean }) {
  const a = content.attendance;
  const attended = a.present + a.late;
  const average = content.assessments.length
    ? Math.round(content.assessments.reduce((s, x) => s + (x.max ? (x.score / x.max) * 100 : 0), 0) / content.assessments.length)
    : null;
  const Block = ({ title, text }: { title: string; text: string }) =>
    text ? (
      <section className="mt-6 break-inside-avoid">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 whitespace-pre-line">{text}</p>
      </section>
    ) : null;

  return (
    <article data-theme="light" className="mx-auto max-w-3xl rounded-card border border-line bg-white p-6 text-ink shadow-card print:border-0 print:p-0 print:shadow-none sm:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-gold pb-5">
        <Logo size={48} />
        <div className="text-right">
          <p className="font-heading text-xl font-semibold text-navy">Progress report</p>
          <p className="text-sm text-muted">{formatDate(periodStart)} to {formatDate(periodEnd)}</p>
        </div>
      </header>
      {draft && <p className="no-print mt-4 rounded-lg bg-gold/20 px-3 py-2 text-sm font-semibold">Draft: not yet visible to the family.</p>}

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div><dt className="text-sm text-muted">Student</dt><dd className="font-semibold">{content.student_name}</dd></div>
        <div><dt className="text-sm text-muted">Class</dt><dd className="font-semibold">{content.student_class || '—'}</dd></div>
        <div><dt className="text-sm text-muted">Subjects studied</dt><dd className="font-semibold">{content.subjects.join(', ') || '—'}</dd></div>
      </dl>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-lg font-semibold">Attendance</h2>
        {a.total ? (
          <p className="mt-1">
            Attended {attended} of {a.total} lessons ({Math.round((attended / a.total) * 100)}%).{' '}
            <span className="text-muted">Present {a.present} · Late {a.late} · Absent {a.absent} · Excused {a.excused}</span>
          </p>
        ) : <p className="mt-1 text-muted">No lessons were recorded in this period.</p>}
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-lg font-semibold">Assessments and grades</h2>
        {content.assessments.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Assessment</th><th scope="col" className="py-2 pr-3 font-medium">Date</th>
                <th scope="col" className="py-2 pr-3 font-medium">Mark</th><th scope="col" className="py-2 font-medium">%</th>
              </tr></thead>
              <tbody>
                {content.assessments.map((x, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-2 pr-3">{x.title}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(x.date)}</td>
                    <td className="py-2 pr-3 tabular-nums">{x.score} / {x.max}</td>
                    <td className="py-2 tabular-nums">{x.max ? Math.round((x.score / x.max) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
              {average !== null && <tfoot><tr><td colSpan={3} className="py-2 pr-3 font-semibold">Average</td><td className="py-2 font-semibold tabular-nums">{average}%</td></tr></tfoot>}
            </table>
          </div>
        ) : <p className="mt-1 text-muted">No marked assessments in this period.</p>}
      </section>

      <Block title="Strengths" text={content.strengths} />
      <Block title="Areas for improvement" text={content.improvements} />
      <Block title="Teacher’s comments" text={content.comments} />
      {content.targets.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h2 className="text-lg font-semibold">Learning targets</h2>
          <ul className="mt-1 list-disc space-y-1 pl-6">{content.targets.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      )}
      <Block title="Recommended next steps" text={content.next_steps} />

      <footer className="mt-10 border-t border-line pt-4 text-sm text-muted">Tosinfinity Academy · Private home and online tutoring</footer>
    </article>
  );
}

export function CertificateDocument({ studentName, title, description, issuedOn, code }: { studentName: string; title: string; description: string; issuedOn: string; code: string }) {
  return (
    <article data-theme="light" className="mx-auto max-w-3xl rounded-card border-8 border-double border-gold bg-white p-8 text-center text-ink shadow-card print:shadow-none sm:p-14">
      <div className="flex justify-center"><Logo size={64} /></div>
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-accent">Certificate</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-navy sm:text-4xl">{title}</h1>
      <p className="mt-8 text-muted">This certificate is awarded to</p>
      <p className="mt-2 font-heading text-3xl font-semibold text-royal">{studentName}</p>
      {description && <p className="mx-auto mt-6 max-w-xl whitespace-pre-line">{description}</p>}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-6 text-left text-sm">
        <div><p className="text-muted">Issued</p><p className="font-semibold">{formatDate(issuedOn)}</p></div>
        <div className="text-right"><p className="text-muted">Certificate reference</p><p className="font-semibold tabular-nums">{code.toUpperCase()}</p></div>
      </div>
      <p className="mt-6 border-t border-line pt-4 text-sm text-muted">Tosinfinity Academy</p>
    </article>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/portal/PrintButton';
import { ReportDocument } from '@/components/portal/ReportDocument';
import { ActionForm } from '@/components/ui/ActionForm';
import { Badge, Card, PageHeader } from '@/components/ui/primitives';
import { aiConfigured } from '@/lib/ai';
import { isUuid, ownerContext } from '@/lib/owner';
import type { ReportContent } from '@/lib/reports';
import { deleteReportAction, saveReportAction, setReportPublishedAction } from '../actions';
import { AiReportButton } from './AiReportButton';

export const metadata = { title: 'Report' };

export default async function ReportPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();
  const { supabase } = await ownerContext();
  const { data: r } = await supabase.from('reports').select('*').eq('id', params.id).maybeSingle();
  if (!r) notFound();
  const c = r.content as ReportContent;
  const published = r.status === 'published';
  const area = (name: keyof ReportContent, label: string, rows = 3, hint?: string) => (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <textarea id={name} name={name} rows={rows} defaultValue={Array.isArray(c[name]) ? (c[name] as string[]).join('\n') : String(c[name] ?? '')} className="field" aria-describedby={hint ? `${name}-hint` : undefined} />
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );

  return (
    <>
      <p className="no-print mb-3 text-sm"><Link href="/owner/reports" className="text-link hover:underline">← Reports</Link></p>
      <div className="no-print">
        <PageHeader
          title={`Report: ${c.student_name}`}
          actions={
            <>
              <Badge tone={published ? 'green' : 'neutral'}>{r.status}</Badge>
              <PrintButton />
            </>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="no-print space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Review and edit</h2>
            <ActionForm action={saveReportAction} submitLabel="Save report" variant="secondary" hidden={{ id: r.id }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="student_class" className="label">Class</label><input id="student_class" name="student_class" defaultValue={c.student_class} className="field" /></div>
                <div><label htmlFor="subjects" className="label">Subjects (comma separated)</label><input id="subjects" name="subjects" defaultValue={c.subjects.join(', ')} className="field" /></div>
              </div>
              {area('strengths', 'Strengths')}
              {area('improvements', 'Areas for improvement')}
              {area('comments', 'Teacher’s comments', 4)}
              {aiConfigured() && <AiReportButton reportId={r.id} targetId="comments" />}
              {area('targets', 'Measurable learning targets', 3, 'One per line, for example: Score 70% or more on the next fractions quiz.')}
              {area('next_steps', 'Recommended next steps')}
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="refresh" className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
                <span>Refresh attendance and assessment figures from current records when saving.</span>
              </label>
            </ActionForm>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">{published ? 'Published' : 'Publish'}</h2>
            <p className="mb-3 mt-1 text-sm text-muted">
              {published ? 'The student and linked parents can read this report.' : 'Check the preview first. Publishing makes it visible to the student and linked parents and notifies them.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionForm action={setReportPublishedAction} submitLabel={published ? 'Return to draft' : 'Publish report'} variant={published ? 'outline' : 'primary'} hidden={{ id: r.id, publish: String(!published) }} confirm={published ? undefined : 'Publish this report to the family?'} />
              <ActionForm action={deleteReportAction} submitLabel="Delete" variant="outline" hidden={{ id: r.id }} confirm="Delete this report permanently?" />
            </div>
          </Card>
        </div>
        <div>
          <ReportDocument content={c} periodStart={r.period_start} periodEnd={r.period_end} draft={!published} />
        </div>
      </div>
    </>
  );
}

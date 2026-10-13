import { ActionForm } from '@/components/ui/ActionForm';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { emailConfigured } from '@/lib/email';
import { ownerContext } from '@/lib/owner';
import { formatDate } from '@/lib/time';
import { deleteNoticeAction, publishNoticeAction } from './actions';

export const metadata = { title: 'Announcements' };
const LABEL: Record<string, string> = { everyone: 'All students and parents', all_students: 'All students', all_parents: 'All parents', selected: 'Selected people' };

export default async function NoticesPage() {
  const { supabase } = await ownerContext();
  const [{ data: notices }, { data: people }] = await Promise.all([
    supabase.from('notices').select('id, title, body, audience, published_at, notice_recipients(count)').order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, full_name, role').in('role', ['student', 'parent']).eq('status', 'active').order('role', { ascending: false }).order('full_name'),
  ]);
  return (
    <>
      <PageHeader title="Announcements" description="Publish notices to students, parents or selected families." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-semibold">New announcement</h2>
          <ActionForm action={publishNoticeAction} submitLabel="Publish announcement" resetOnSuccess confirm="Publish this announcement now?">
            <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" required className="field" /></div>
            <div><label htmlFor="body" className="label">Message</label><textarea id="body" name="body" rows={5} required className="field" /></div>
            <div>
              <label htmlFor="audience" className="label">Send to</label>
              <select id="audience" name="audience" defaultValue="everyone" className="field">
                {Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="label">Selected people <span className="font-normal text-muted">(used only with “Selected people”)</span></legend>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
                {(people ?? []).map((p) => (
                  <label key={p.id} className="flex min-h-[36px] items-center gap-3 text-sm">
                    <input type="checkbox" name="recipients" value={p.id} className="h-5 w-5 accent-[rgb(var(--royal))]" />
                    <span>{p.full_name} <span className="capitalize text-muted">({p.role})</span></span>
                  </label>
                ))}
                {!people?.length && <p className="text-sm text-muted">No students or parents yet.</p>}
              </div>
              <label className="mt-2 flex items-center gap-3 text-sm">
                <input type="checkbox" name="include_parents" className="h-5 w-5 accent-[rgb(var(--royal))]" />
                Also include the parents of selected students (whole family)
              </label>
            </fieldset>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="send_email" className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
              <span>Also send by email{!emailConfigured() && <span className="text-muted"> (email is not configured yet, so only in-app delivery will happen)</span>}</span>
            </label>
          </ActionForm>
        </Card>
        <div>
          {notices?.length ? (
            <ul className="space-y-4">
              {notices.map((n) => (
                <li key={n.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold">{n.title}</h3>
                      <Badge tone="blue">{LABEL[n.audience]}{n.audience === 'selected' ? ` (${(n.notice_recipients as Array<{ count: number }>)[0]?.count ?? 0})` : ''}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{n.published_at ? formatDate(n.published_at) : 'Draft'}</p>
                    <p className="mt-3 whitespace-pre-line text-sm">{n.body}</p>
                    <div className="mt-3"><ActionForm action={deleteNoticeAction} submitLabel="Remove" variant="outline" size="sm" hidden={{ id: n.id }} confirm="Remove this announcement for everyone?" /></div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No announcements yet" />}
        </div>
      </div>
    </>
  );
}

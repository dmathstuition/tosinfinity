import { ActionForm } from '@/components/ui/ActionForm';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { publicEnv } from '@/lib/env';
import { formatBytes } from '@/lib/files';
import { ownerContext } from '@/lib/owner';
import { formatDate } from '@/lib/time';
import { createMaterialAction, deleteMaterialAction, updateMaterialSharingAction } from './actions';
import { UploadFields } from './UploadFields';

export const metadata = { title: 'Resources' };

export default async function ResourcesPage() {
  const { supabase } = await ownerContext();
  const [{ data: materials }, { data: students }, { data: programmes }] = await Promise.all([
    supabase.from('materials').select('*, material_students(student_id), programme:programmes(title)').order('created_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('id, full_name, student_code').eq('role', 'student').eq('status', 'active').order('full_name'),
    supabase.from('programmes').select('id, title').order('sort_order'),
  ]);

  const studentBoxes = (selected: string[] = [], prefix = 'n') => (
    <fieldset>
      <legend className="label">Share with students</legend>
      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
        {(students ?? []).map((s) => (
          <label key={`${prefix}-${s.id}`} className="flex min-h-[36px] items-center gap-3 text-sm">
            <input type="checkbox" name="students" value={s.id} defaultChecked={selected.includes(s.id)} className="h-5 w-5 accent-[rgb(var(--royal))]" />
            {s.full_name}
          </label>
        ))}
        {!students?.length && <p className="text-sm text-muted">No active students yet.</p>}
      </div>
    </fieldset>
  );
  const programmeSelect = (value: string | null, id: string) => (
    <div>
      <label htmlFor={id} className="label">Share with everyone enrolled on</label>
      <select id={id} name="programme_id" defaultValue={value ?? ''} className="field">
        <option value="">No programme</option>
        {(programmes ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <PageHeader title="Learning resources" description="PDFs, worksheets, revision notes, images and presentations." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-semibold">Upload a resource</h2>
          <ActionForm action={createMaterialAction} submitLabel="Save resource" resetOnSuccess>
            <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" required className="field" /></div>
            <div><label htmlFor="description" className="label">Description</label><textarea id="description" name="description" rows={2} className="field" /></div>
            <UploadFields />
            {programmeSelect(null, 'new-programme')}
            {studentBoxes()}
          </ActionForm>
        </Card>

        <div>
          {materials?.length ? (
            <ul className="space-y-4">
              {materials.map((m) => {
                const shared = (m.material_students as Array<{ student_id: string }>).map((x) => x.student_id);
                const prog = Array.isArray(m.programme) ? m.programme[0] : m.programme;
                const href = m.bucket === 'handouts'
                  ? `${publicEnv.supabaseUrl}/storage/v1/object/public/handouts/${encodeURIComponent(m.path)}`
                  : `/api/files?bucket=materials&path=${encodeURIComponent(m.path)}`;
                return (
                  <li key={m.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold">{m.title}</h3>
                          <p className="text-sm text-muted">{formatDate(m.created_at)} · {formatBytes(m.size_bytes)}{prog ? ` · ${prog.title}` : ''}</p>
                        </div>
                        <Badge tone={m.bucket === 'handouts' ? 'orange' : 'blue'}>{m.bucket === 'handouts' ? 'Public' : `Private · ${shared.length} student${shared.length === 1 ? '' : 's'}`}</Badge>
                      </div>
                      {m.description && <p className="mt-2 text-sm">{m.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ButtonLink href={href} external variant="outline" size="sm">Open</ButtonLink>
                        <ActionForm action={deleteMaterialAction} submitLabel="Delete" variant="outline" size="sm" hidden={{ id: m.id }} confirm="Delete this resource and its file?" />
                      </div>
                      {m.bucket === 'materials' && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-semibold text-link">Change sharing</summary>
                          <div className="mt-3">
                            <ActionForm action={updateMaterialSharingAction} submitLabel="Update sharing" variant="secondary" size="sm" hidden={{ id: m.id }}>
                              {programmeSelect(m.programme_id, `prog-${m.id}`)}
                              {studentBoxes(shared, m.id)}
                            </ActionForm>
                          </div>
                        </details>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState title="No resources yet">Upload a file to share it with students or a whole programme.</EmptyState>}
        </div>
      </div>
    </>
  );
}

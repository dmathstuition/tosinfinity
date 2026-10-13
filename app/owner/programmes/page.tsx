import { ActionForm } from '@/components/ui/ActionForm';
import { Badge, Card, PageHeader } from '@/components/ui/primitives';
import { ownerContext } from '@/lib/owner';
import { CATEGORY_LABEL } from '@/lib/programmes';
import { deleteProgrammeAction, saveProgrammeAction } from './actions';

export const metadata = { title: 'Programmes' };

type Row = { id: string; title: string; slug: string; category: string; level: string | null; summary: string; description: string; sort_order: number; is_published: boolean };

function Fields({ p, prefix }: { p?: Row; prefix: string }) {
  const id = (n: string) => `${prefix}-${n}`;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={id('title')} className="label">Title</label><input id={id('title')} name="title" required defaultValue={p?.title} className="field" /></div>
        <div>
          <label htmlFor={id('category')} className="label">Category</label>
          <select id={id('category')} name="category" defaultValue={p?.category ?? 'mathematics'} className="field">
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label htmlFor={id('level')} className="label">Level</label><input id={id('level')} name="level" defaultValue={p?.level ?? ''} placeholder="e.g. JSS1–JSS3" className="field" /></div>
        <div><label htmlFor={id('sort')} className="label">Order on the website</label><input id={id('sort')} name="sort_order" type="number" min={0} max={9999} defaultValue={p?.sort_order ?? 0} className="field" aria-describedby={id('sort-hint')} /><p id={id('sort-hint')} className="mt-1 text-xs text-muted">Lower numbers appear first.</p></div>
        <div className="sm:col-span-2"><label htmlFor={id('slug')} className="label">Web address</label><input id={id('slug')} name="slug" defaultValue={p?.slug} placeholder="Leave blank to create from the title" className="field" /></div>
      </div>
      <div><label htmlFor={id('summary')} className="label">Short summary (shown on cards)</label><textarea id={id('summary')} name="summary" rows={2} maxLength={300} defaultValue={p?.summary} className="field" /></div>
      <div><label htmlFor={id('description')} className="label">Full description (Markdown)</label><textarea id={id('description')} name="description" rows={5} defaultValue={p?.description} className="field" /></div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="is_published" defaultChecked={p?.is_published ?? false} className="mt-0.5 h-5 w-5 accent-[rgb(var(--royal))]" />
        <span>Show on the public website. Tick only for programmes you actually offer.</span>
      </label>
    </>
  );
}

export default async function ProgrammesPage() {
  const { supabase } = await ownerContext();
  const { data } = await supabase.from('programmes').select('*').order('sort_order');
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader title="Programme catalogue" description="Add, edit, hide or reorder the subjects and programmes shown on the website." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit">
          <h2 className="mb-4 text-lg font-semibold">Add a programme</h2>
          <ActionForm action={saveProgrammeAction} submitLabel="Add programme" resetOnSuccess><Fields prefix="new" /></ActionForm>
        </Card>
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id}>
              <details className="card p-0">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
                  <span className="min-w-0">
                    <span className="font-semibold">{p.title}</span>
                    <span className="block text-sm text-muted">{CATEGORY_LABEL[p.category as keyof typeof CATEGORY_LABEL]}{p.level ? ` · ${p.level}` : ''} · order {p.sort_order}</span>
                  </span>
                  <Badge tone={p.is_published ? 'green' : 'neutral'}>{p.is_published ? 'On website' : 'Hidden'}</Badge>
                </summary>
                <div className="border-t border-line p-4">
                  <ActionForm action={saveProgrammeAction} submitLabel="Save" variant="secondary" hidden={{ id: p.id }}><Fields p={p} prefix={p.id} /></ActionForm>
                  <div className="mt-4 border-t border-line pt-4">
                    <ActionForm action={deleteProgrammeAction} submitLabel="Delete programme" variant="outline" size="sm" hidden={{ id: p.id }} confirm={`Delete “${p.title}”?`} />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

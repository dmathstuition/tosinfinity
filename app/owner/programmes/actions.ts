'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';
import { PROGRAMMES_TAG } from '@/lib/programmes';

const schema = z.object({
  title: z.string().trim().min(2, 'Give the programme a title').max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'The web address may contain only lowercase letters, numbers and hyphens').max(100),
  category: z.enum(['mathematics', 'science', 'exam_prep']),
  level: z.string().trim().max(60),
  summary: z.string().trim().max(300),
  description: z.string().max(10000),
  sort_order: z.coerce.number().int().min(0).max(9999),
});

function refresh() {
  revalidateTag(PROGRAMMES_TAG);
  revalidatePath('/', 'layout');
}

export async function saveProgrammeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  const title = str(fd, 'title', 200);
  const parsed = schema.safeParse({
    title, slug: str(fd, 'slug', 200) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    category: str(fd, 'category'), level: str(fd, 'level', 80), summary: str(fd, 'summary', 400),
    description: String(fd.get('description') ?? ''), sort_order: str(fd, 'sort_order') || '0',
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Please check the form.');
  const row = { ...parsed.data, level: parsed.data.level || null, is_published: fd.get('is_published') === 'on' };
  const { error } = isUuid(id)
    ? await supabase.from('programmes').update(row).eq('id', id)
    : await supabase.from('programmes').insert(row);
  if (error) return fail(error.code === '23505' ? 'Another programme already uses that web address.' : 'Could not save the programme.');
  await audit(isUuid(id) ? 'programme.updated' : 'programme.created', 'programme', isUuid(id) ? id : null, { slug: row.slug, published: row.is_published });
  refresh();
  revalidatePath('/owner/programmes');
  return ok(row.is_published ? 'Saved and shown on the website.' : 'Saved. Hidden from the website.');
}

export async function deleteProgrammeAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown programme.');
  const { error } = await supabase.from('programmes').delete().eq('id', id);
  if (error) return fail('This programme has enrolled students, so it cannot be deleted. Hide it from the website instead.');
  await audit('programme.deleted', 'programme', id);
  refresh();
  revalidatePath('/owner/programmes');
  return ok('Programme deleted.');
}

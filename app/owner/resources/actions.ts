'use server';

import { revalidatePath } from 'next/cache';
import { FILE_RULES } from '@/lib/files';
import { notifyFamilies } from '@/lib/notify';
import { type ActionState, fail, isUuid, ok, ownerContext, str } from '@/lib/owner';

export async function createMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const title = str(fd, 'title', 160);
  const bucket = str(fd, 'bucket') === 'handouts' ? 'handouts' : 'materials';
  const path = str(fd, `file_path_${bucket}`, 500);
  const type = str(fd, `file_path_${bucket}_type`, 120);
  if (title.length < 2) return fail('Give the resource a title.');
  if (!path) return fail('Upload a file first.');
  if (!(type in FILE_RULES[bucket].types)) return fail('That file type is not allowed.');
  // Confirm the object really exists in the chosen bucket before recording it.
  const { data: found } = await supabase.storage.from(bucket).list('', { search: path, limit: 1 });
  if (!found?.some((f) => f.name === path)) return fail('The uploaded file could not be found. Please upload it again.');

  const programme = str(fd, 'programme_id');
  const students = fd.getAll('students').map(String).filter(isUuid);
  const { data, error } = await supabase
    .from('materials')
    .insert({
      title, description: str(fd, 'description', 1000), bucket, path, mime_type: type,
      size_bytes: Number(str(fd, `file_path_${bucket}_size`)) || null, programme_id: isUuid(programme) ? programme : null,
    })
    .select('id')
    .single();
  if (error) return fail('Could not save the resource.');
  if (bucket === 'materials' && students.length) {
    await supabase.from('material_students').insert(students.map((s) => ({ material_id: data.id, student_id: s })));
    await notifyFamilies(supabase, students, { title: 'New learning material', body: title, path: '/materials' });
  }
  revalidatePath('/owner/resources');
  return ok('Resource saved.');
}

export async function updateMaterialSharingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown resource.');
  const students = fd.getAll('students').map(String).filter(isUuid);
  const programme = str(fd, 'programme_id');
  await supabase.from('materials').update({ programme_id: isUuid(programme) ? programme : null }).eq('id', id);
  const { data: before } = await supabase.from('material_students').select('student_id').eq('material_id', id);
  const had = new Set((before ?? []).map((b) => b.student_id));
  await supabase.from('material_students').delete().eq('material_id', id);
  if (students.length) await supabase.from('material_students').insert(students.map((s) => ({ material_id: id, student_id: s })));
  const added = students.filter((s) => !had.has(s));
  if (added.length) {
    const { data: m } = await supabase.from('materials').select('title').eq('id', id).maybeSingle();
    await notifyFamilies(supabase, added, { title: 'New learning material', body: m?.title ?? '', path: '/materials' });
  }
  revalidatePath('/owner/resources');
  return ok('Sharing updated.');
}

export async function deleteMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const id = str(fd, 'id');
  if (!isUuid(id)) return fail('Unknown resource.');
  const { data: m } = await supabase.from('materials').select('bucket, path, title').eq('id', id).maybeSingle();
  if (!m) return fail('Unknown resource.');
  await supabase.storage.from(m.bucket).remove([m.path]);
  await supabase.from('materials').delete().eq('id', id);
  await audit('material.deleted', 'material', id, { title: m.title });
  revalidatePath('/owner/resources');
  return ok('Resource deleted.');
}

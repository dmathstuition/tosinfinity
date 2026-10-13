import { NextResponse } from 'next/server';
import { ownerContext } from '@/lib/owner';
import { csvCell } from '@/lib/validation/student';

export const dynamic = 'force-dynamic';

const COLUMNS = ['student_code', 'full_name', 'email', 'phone', 'date_of_birth', 'school_year', 'curriculum', 'delivery', 'location', 'status', 'created_at'] as const;

/** Owner-only export. Private teaching notes are deliberately not included. */
export async function GET() {
  const { supabase, audit } = await ownerContext();
  const { data, error } = await supabase.from('profiles').select(COLUMNS.join(', ')).eq('role', 'student').order('full_name');
  if (error) return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const csv = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  await audit('students.exported', 'profile', null, { count: rows.length });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tosinfinity-students-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

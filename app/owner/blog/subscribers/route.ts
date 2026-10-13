import { NextResponse } from 'next/server';
import { ownerContext } from '@/lib/owner';
import { csvCell } from '@/lib/validation/student';

export const dynamic = 'force-dynamic';

/** Owner-only export of newsletter subscribers with their consent record. */
export async function GET() {
  const { supabase, audit } = await ownerContext();
  const { data } = await supabase.from('blog_subscribers').select('email, status, consent_at, verified_at, unsubscribed_at').order('created_at');
  const columns = ['email', 'status', 'consent_at', 'verified_at', 'unsubscribed_at'] as const;
  const csv = [columns.join(','), ...(data ?? []).map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  await audit('subscribers.exported', 'blog_subscriber', null, { count: data?.length ?? 0 });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tosinfinity-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

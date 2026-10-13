import { NextResponse, type NextRequest } from 'next/server';
import { getSessionProfile } from '@/lib/auth';
import { PRIVATE_BUCKETS } from '@/lib/files';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Private file access. The signed URL is created with the caller's own session, so
 * Supabase Storage policies decide whether this user may read this object: asking for
 * another family's path simply fails. Links last 60 seconds and are never cached.
 */
export async function GET(request: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const bucket = request.nextUrl.searchParams.get('bucket') ?? '';
  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!(PRIVATE_BUCKETS as readonly string[]).includes(bucket) || !path || path.includes('..') || path.length > 500) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { data, error } = await createClient().storage.from(bucket).createSignedUrl(path, 60, { download: true });
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

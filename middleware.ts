import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const AREAS: Array<{ prefix: string; role: 'owner' | 'student' | 'parent' }> = [
  { prefix: '/owner', role: 'owner' },
  { prefix: '/portal', role: 'student' },
  { prefix: '/parent', role: 'parent' },
];
const HOME = { owner: '/owner', student: '/portal', parent: '/parent' } as const;

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const area = AREAS.find(
    (a) => request.nextUrl.pathname === a.prefix || request.nextUrl.pathname.startsWith(a.prefix + '/'),
  );

  if (!url || !key) {
    // Not configured: private areas are unreachable; public pages still render.
    return area ? NextResponse.redirect(new URL('/login', request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Refreshes the session and verifies it with the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (area) {
    const deny = (to: string) => {
      const redirect = NextResponse.redirect(new URL(to, request.url));
      for (const c of response.cookies.getAll()) redirect.cookies.set(c);
      return redirect;
    };
    if (!user) return deny('/login');
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile || profile.status !== 'active') return deny('/login');
    if (profile.role !== area.role) return deny(HOME[profile.role as keyof typeof HOME] ?? '/login');
    response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|icons/|sw.js|manifest.webmanifest|api/webhooks|api/cron).*)'],
};

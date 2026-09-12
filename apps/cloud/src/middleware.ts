/**
 * Middleware: renova a sessão Supabase e protege rotas autenticadas.
 * A autorização fina (organização/cliente) é feita no servidor por rota (ADR-0002);
 * aqui apenas garantimos sessão válida e redirecionamos anônimos.
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/signup', '/reset-password', '/invite', '/config', '/api/v1/health'];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  // Sem configuração: deixa a página de diagnóstico responder (não simula login).
  if (!url || !anon) {
    if (pathname.startsWith('/config')) return NextResponse.next();
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/config';
    return NextResponse.redirect(redirect);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!user && !isPublic && (pathname.startsWith('/app') || pathname.startsWith('/platform'))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    redirect.searchParams.set('next', pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

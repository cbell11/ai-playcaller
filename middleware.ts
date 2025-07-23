import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Create a Supabase client using the newer package
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if the user is authenticated
  const isAuthenticated = !!session;
  const isAuthPage = req.nextUrl.pathname === '/auth';
  const isResetPasswordPage = req.nextUrl.pathname === '/auth/reset-password';
  
  // If user is on the auth page and is already authenticated, redirect to setup
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/setup', req.url));
  }

  // Skip auth check for public routes
  const isPublicRoute = [
    '/auth',
    '/auth/reset-password', // Allow access to reset password page
    '/_next',
    '/api',
    '/favicon.ico',
  ].some(path => req.nextUrl.pathname.startsWith(path));

  // If user is not authenticated and not on a public route, redirect to auth
  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth', req.url));
  }

  return res;
}

// Run middleware on all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 
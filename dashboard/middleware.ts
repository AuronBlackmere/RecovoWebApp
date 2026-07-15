import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require auth
const PUBLIC_ROUTES = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublic) return NextResponse.next();

  // In production: check session cookie / Firebase auth token
  // For now we pass through and let client handle auth redirect
  // TODO: Verify Firebase ID token from cookie for server-side protection
  // const token = request.cookies.get('firebase-token');
  // if (!token) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

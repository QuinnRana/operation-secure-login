import { NextResponse } from 'next/server';

export function middleware() {
  const response = NextResponse.next();
  // No intermediary/browser should store authenticated HTML or action results.
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export const config = { matcher: ['/', '/account/:path*', '/dashboard/:path*', '/recover/:path*'] };

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me-please-1234567890');

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = pathname === '/' || pathname === '/calendar' || pathname.startsWith('/calendar/');

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/', '/calendar', '/calendar/:path*'],
};

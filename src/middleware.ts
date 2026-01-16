import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Define public paths that don't need auth
    const isPublicPath = path === '/login' || path.startsWith('/_next') || path === '/favicon.ico' || path.startsWith('/api/auth');

    // Check for auth token
    const token = request.cookies.get('auth_token')?.value;

    // 1. If trying to access protected route without token -> Redirect to Login
    if (!isPublicPath && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. If trying to access Login WITH token -> Redirect to Home (Dashboard)
    if (path === '/login' && token) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

// Ensure middleware runs on relevant paths
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (Login API)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)',
    ],
};

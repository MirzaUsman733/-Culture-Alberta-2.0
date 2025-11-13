import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // PERFORMANCE: Skip middleware for admin routes (no caching, no prefetching)
  if (request.nextUrl.pathname.startsWith('/admin') || 
      request.nextUrl.pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  const response = NextResponse.next()

  // PERFORMANCE: Aggressive edge caching for instant loads (only public pages)
  if (request.nextUrl.pathname.startsWith('/articles/')) {
    // Cache article pages aggressively (5 min CDN, 10 min stale-while-revalidate)
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600, max-age=60')
  } else if (request.nextUrl.pathname === '/' || 
             request.nextUrl.pathname === '/edmonton' || 
             request.nextUrl.pathname === '/calgary' ||
             request.nextUrl.pathname === '/culture' ||
             request.nextUrl.pathname === '/food-drink' ||
             request.nextUrl.pathname === '/events' ||
             request.nextUrl.pathname === '/guides' ||
             request.nextUrl.pathname === '/best-of') {
    // Cache main pages aggressively (2 min CDN, 5 min stale-while-revalidate)
    response.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300, max-age=30')
  }

  // PERFORMANCE: Add prefetch hints for faster navigation (only public routes)
  if (request.nextUrl.pathname.startsWith('/articles/')) {
    response.headers.set('Link', '</articles>; rel=prefetch, </events>; rel=prefetch')
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/articles/:path*',
    '/edmonton',
    '/calgary', 
    '/culture',
    '/food-drink',
    '/events',
    '/best-of',
    '/admin/:path*',
    '/api/admin/:path*'
  ]
}
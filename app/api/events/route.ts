import { NextResponse } from 'next/server'
import { loadOptimizedFallback } from '@/lib/optimized-fallback'

export const revalidate = 60

export async function GET() {
  try {
    const fallbackArticles = await loadOptimizedFallback()
    const events = fallbackArticles.filter(article => article.type === 'event')
    
    return NextResponse.json(events, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to load events:', error)
    }
    return NextResponse.json([], { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  }
}

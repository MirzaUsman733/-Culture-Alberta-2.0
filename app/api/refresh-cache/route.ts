import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { clearArticlesCache } from '@/lib/supabase-articles'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST() {
  try {
    clearArticlesCache()
    
    const pathsToRevalidate = [
      '/',
      '/edmonton',
      '/calgary',
      '/food-drink',
      '/culture',
      '/events',
      '/articles',
    ]
    
    pathsToRevalidate.forEach(path => {
      revalidatePath(path)
    })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cache refreshed - newest articles will now show',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error refreshing cache:', error)
    }
    return NextResponse.json(
      { 
        error: 'Failed to refresh cache', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  return POST()
}

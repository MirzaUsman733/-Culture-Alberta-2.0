import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { clearArticlesCache } from '@/lib/fast-articles'
import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function transformArticle(article: any) {
  return {
    id: article.id,
    title: article.title,
    content: article.content || '',
    excerpt: article.excerpt || '',
    category: article.category || '',
    categories: article.categories || [article.category || ''],
    location: article.location || '',
    author: article.author || '',
    tags: article.tags || [],
    type: article.type || 'article',
    status: article.status || 'published',
    imageUrl: article.image_url || '',
    date: article.created_at || new Date().toISOString(),
    createdAt: article.created_at || new Date().toISOString(),
    updatedAt: article.updated_at || article.created_at || new Date().toISOString(),
    // Trending flags
    trendingHome: article.trending_home ?? false,
    trendingEdmonton: article.trending_edmonton ?? false,
    trendingCalgary: article.trending_calgary ?? false,
    // Featured flags
    featuredHome: article.featured_home ?? false,
    featuredEdmonton: article.featured_edmonton ?? false,
    featuredCalgary: article.featured_calgary ?? false
  }
}

function transformEvent(event: any) {
  return {
    id: event.id,
    title: event.title || '',
    content: event.description || '',
    excerpt: event.excerpt || (event.description ? event.description.substring(0, 150) + '...' : ''),
    category: event.category || '',
    categories: [event.category || ''],
    location: event.location || '',
    author: event.organizer || 'Event Organizer',
    tags: event.tags || [],
    type: 'event',
    status: event.status || 'published',
    imageUrl: event.image_url || '',
    date: event.event_date || event.created_at || new Date().toISOString(),
    createdAt: event.created_at || new Date().toISOString(),
    updatedAt: event.updated_at || event.created_at || new Date().toISOString(),
    trendingHome: event.featured_home ?? false,
    trendingEdmonton: event.featured_edmonton ?? false,
    trendingCalgary: event.featured_calgary ?? false,
    featuredHome: event.featured_home ?? false,
    featuredEdmonton: event.featured_edmonton ?? false,
    featuredCalgary: event.featured_calgary ?? false,
    eventDate: event.event_date || undefined,
    eventEndDate: event.event_end_date || undefined,
    websiteUrl: event.website_url || undefined,
    organizer: event.organizer || undefined,
    organizerContact: event.organizer_contact || undefined
  }
}

async function fetchAndTransformContent(limit?: number) {
  if (!supabase) {
    throw new Error('Supabase client is not initialized')
  }

  const articleFields = [
    'id',
    'title',
    'excerpt',
    'content',
    'category',
    'categories',
    'location',
    'author',
    'tags',
    'type',
    'status',
    'created_at',
    'updated_at',
    'trending_home',
    'trending_edmonton',
    'trending_calgary',
    'featured_home',
    'featured_edmonton',
    'featured_calgary',
    'image_url'
  ].join(',')

  const eventFields = [
    'id',
    'title',
    'excerpt',
    'description',
    'category',
    'location',
    'organizer',
    'tags',
    'status',
    'created_at',
    'updated_at',
    'featured_home',
    'featured_edmonton',
    'featured_calgary',
    'image_url',
    'event_date',
    'event_end_date',
    'organizer_contact',
    'website_url'
  ].join(',')

  // Build queries
  let articlesQuery = supabase
    .from('articles')
    .select(articleFields, { count: 'exact' })
    .order('created_at', { ascending: false })
  
  let eventsQuery = supabase
    .from('events')
    .select(eventFields, { count: 'exact' })
    .order('created_at', { ascending: false })
  
  // Apply limit if provided
  if (limit && limit > 0) {
    articlesQuery = articlesQuery.limit(limit)
    eventsQuery = eventsQuery.limit(limit)
  }

  const queryPromise = Promise.all([
    articlesQuery,
    eventsQuery
  ])
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Sync query timeout')), 30000) // 30 second timeout
  )

  const [articlesResult, eventsResult] = await Promise.race([
    queryPromise,
    timeoutPromise
  ]) as any[]

  if (articlesResult.error) {
    throw new Error(`Supabase articles request failed: ${articlesResult.error.message}`)
  }

  if (eventsResult.error) {
    throw new Error(`Supabase events request failed: ${eventsResult.error.message}`)
  }

  const transformedArticles = (articlesResult.data || []).map(transformArticle)
  const transformedEvents = (eventsResult.data || []).map(transformEvent)

  return { transformedArticles, transformedEvents }
}

async function writeFallbackFiles(allContent: any[]): Promise<boolean> {
  try {
    const optimizedFallbackPath = path.join(process.cwd(), 'optimized-fallback.json')
    await fs.writeFile(optimizedFallbackPath, JSON.stringify(allContent, null, 2))
    
    const articlesPath = path.join(process.cwd(), 'lib', 'data', 'articles.json')
    await fs.writeFile(articlesPath, JSON.stringify(allContent, null, 2))
    clearArticlesCache()
    
    return true
  } catch (fileError) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Could not write to local file (this is normal in production):', fileError)
    }
    return false
  }
}

function revalidateAllPages() {
  try {
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
    
    // Revalidate dynamic paths
    revalidatePath('/articles/[slug]', 'page')
    revalidatePath('/events/[slug]', 'page')
  } catch (revalidateError) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Revalidation failed, but sync was successful:', revalidateError)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit && typeof body.limit === 'number' ? body.limit : undefined
    
    const { transformedArticles, transformedEvents } = await fetchAndTransformContent(limit)
    const allContent = [...transformedArticles, ...transformedEvents]
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    const fileWritten = await writeFallbackFiles(allContent)
    revalidateAllPages()
    
    return NextResponse.json({ 
      success: true, 
      message: `Synced ${transformedArticles.length} articles and ${transformedEvents.length} events${fileWritten ? ' to local file' : ''} and triggered page revalidation`,
      timestamp: new Date().toISOString(),
      environment: isProduction ? 'production' : 'development',
      fileWritten,
      articlesCount: transformedArticles.length,
      eventsCount: transformedEvents.length,
      totalCount: allContent.length,
      downloadUrl: '/api/sync-articles/download'
    })
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error syncing articles:', error)
    }
    return NextResponse.json(
      { 
        error: 'Failed to sync articles', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined
    
    const { transformedArticles, transformedEvents } = await fetchAndTransformContent(limit)
    const allContent = [...transformedArticles, ...transformedEvents]
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    const fileWritten = await writeFallbackFiles(allContent)
    revalidateAllPages()
    
    return NextResponse.json({ 
      success: true, 
      message: `Synced ${transformedArticles.length} articles and ${transformedEvents.length} events${fileWritten ? ' to local file' : ''} and triggered page revalidation`,
      timestamp: new Date().toISOString(),
      environment: isProduction ? 'production' : 'development',
      fileWritten,
      articlesCount: transformedArticles.length,
      eventsCount: transformedEvents.length,
      totalCount: allContent.length,
      downloadUrl: '/api/sync-articles/download'
    })
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error syncing articles:', error)
    }
    return NextResponse.json(
      { 
        error: 'Failed to sync articles', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

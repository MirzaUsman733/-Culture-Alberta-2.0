/**
 * Article data fetching utilities
 * 
 * Performance optimizations:
 * - Efficient article lookup by slug
 * - Cached related articles
 * - Parallel data fetching where possible
 * - Minimal field selection for fast queries
 * - Timeout protection
 * 
 * Used in:
 * - app/articles/[slug]/page.tsx (article detail page)
 */

import { Article } from '@/lib/types/article'
import { createSlug } from '@/lib/utils/slug'
import { getFastArticles } from '@/lib/fast-articles'
import { supabase } from '@/lib/supabase'
import { loadOptimizedFallback } from '@/lib/optimized-fallback'
import { getAllEvents } from '@/lib/events'

// PERFORMANCE: Slug-to-article index for O(1) lookup
let slugIndex: Map<string, Article> | null = null
let articlesCache: Article[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

/**
 * Builds a slug index from articles for O(1) lookup
 */
function buildSlugIndex(articles: Article[]): Map<string, Article> {
  const index = new Map<string, Article>()
  
  for (const article of articles) {
    const slug = createSlug(article.title).toLowerCase()
    index.set(slug, article)
    
    // Also index by ID for fallback lookup
    if (article.id) {
      index.set(article.id.toLowerCase(), article)
    }
  }
  
  return index
}

/**
 * Gets articles and builds index if needed
 */
async function getArticlesWithIndex(): Promise<{ articles: Article[], index: Map<string, Article> }> {
  const now = Date.now()
  
  // Return cached if still fresh
  if (articlesCache && slugIndex && now - cacheTimestamp < CACHE_DURATION) {
    return { articles: articlesCache, index: slugIndex }
  }
  
  // Load articles from optimized fallback (fastest source)
  let articles: Article[] = []
  
  try {
    articles = await loadOptimizedFallback()
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to load optimized fallback:', error)
    }
  }
  
  // Build index
  slugIndex = buildSlugIndex(articles)
  articlesCache = articles
  cacheTimestamp = now
  
  return { articles, index: slugIndex }
}

/**
 * OPTIMIZED: Finds an article by slug using O(1) index lookup
 * 
 * @param slug - Article slug to find
 * @returns Article object or null if not found
 * 
 * Performance:
 * - Uses O(1) slug index lookup (no array search)
 * - Single file read with caching
 * - Avoids redundant Supabase queries
 * - Fast fallback to optimized file
 * 
 * Used in:
 * - app/articles/[slug]/page.tsx (article loading)
 */
export async function findArticleBySlug(slug: string): Promise<Article | null> {
  const normalizedSlug = slug.toLowerCase()
  
  // PERFORMANCE: Use O(1) index lookup instead of O(n) search
  const { index } = await getArticlesWithIndex()
  let article = index.get(normalizedSlug)
  
  if (article) {
    return article as Article
  }
  
  // Try alternative slug variations (in case of slight differences)
  for (const [indexSlug, indexedArticle] of index.entries()) {
    if (indexSlug.includes(normalizedSlug) || normalizedSlug.includes(indexSlug)) {
      // Verify it's a close match
      const articleSlug = createSlug(indexedArticle.title).toLowerCase()
      if (articleSlug === normalizedSlug || 
          articleSlug.includes(normalizedSlug) || 
          normalizedSlug.includes(articleSlug)) {
        return indexedArticle as Article
      }
    }
  }
  
  // PERFORMANCE: Skip Supabase query in production (use fallback file only)
  // Supabase queries are slow and the fallback file should have all articles
  if (process.env.NODE_ENV === 'development') {
    // Only try Supabase in development for debugging
    try {
      const articlePreviewFields = [
        'id',
        'title',
        'excerpt',
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
        'image_url',
        'content'
      ].join(',')
      
      const articlesQuery = supabase
        .from('articles')
        .select(articlePreviewFields)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(100)
      
      const queryPromise = articlesQuery
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 3000) // Reduced to 3s
      )
      
      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any
      
      if (!error && data) {
        const foundArticle = data.find((article: any) => {
          const articleSlug = createSlug(article.title)
          return articleSlug.toLowerCase() === normalizedSlug
        })
        
        if (foundArticle) {
          const article: Article = {
            id: foundArticle.id,
            title: foundArticle.title,
            excerpt: foundArticle.excerpt || '',
            category: foundArticle.category || '',
            categories: foundArticle.categories || [],
            location: foundArticle.location || '',
            author: foundArticle.author || '',
            tags: foundArticle.tags || [],
            type: foundArticle.type || 'article',
            status: foundArticle.status || 'published',
            imageUrl: foundArticle.image_url || '',
            content: foundArticle.content || '',
            date: foundArticle.created_at,
            createdAt: foundArticle.created_at,
            updatedAt: foundArticle.updated_at || foundArticle.created_at,
            trendingHome: foundArticle.trending_home ?? false,
            trendingEdmonton: foundArticle.trending_edmonton ?? false,
            trendingCalgary: foundArticle.trending_calgary ?? false,
            featuredHome: foundArticle.featured_home ?? false,
            featuredEdmonton: foundArticle.featured_edmonton ?? false,
            featuredCalgary: foundArticle.featured_calgary ?? false,
          }
          
          // Add to cache for next time
          if (articlesCache) {
            articlesCache.push(article)
            slugIndex = buildSlugIndex(articlesCache)
          }
          
          return article
        }
      }
    } catch (error) {
      // Supabase failed, continue
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabase lookup failed:', error)
      }
    }
  }
  
  return null
}

/**
 * Checks if slug might be an event and redirects if found
 * 
 * @param slug - Slug to check
 * @returns Event object if found, null otherwise
 * 
 * Performance:
 * - Uses cached events if available
 * - Efficient slug matching
 */
export async function checkEventSlug(slug: string): Promise<{ title: string; slug: string } | null> {
  try {
    const events = await getAllEvents()
    const eventSlug = createSlug(slug)
    
    for (const event of events) {
      const eventSlugFromTitle = createSlug(event.title)
      if (eventSlugFromTitle === eventSlug) {
        return {
          title: event.title,
          slug: eventSlugFromTitle
        }
      }
    }
  } catch (error) {
    // Events check failed, return null
    if (process.env.NODE_ENV === 'development') {
      console.error('Events check failed:', error)
    }
  }
  
  return null
}

/**
 * OPTIMIZED: Fetches full article content if missing or too short
 * 
 * @param article - Article object (may have missing content)
 * @param slug - Article slug for lookup
 * @returns Article with full content if available
 * 
 * Performance:
 * - Only fetches if content is missing/short
 * - Uses cached articles index (no file read)
 * - Avoids Supabase queries (use fallback file)
 * - Fast O(1) lookup
 */
export async function ensureFullContent(
  article: Article,
  slug: string
): Promise<Article> {
  const hasUsableContent = !!(
    article.content &&
    typeof article.content === 'string' &&
    article.content.trim().length > 100
  )
  
  if (hasUsableContent) {
    return article
  }
  
  // PERFORMANCE: Use cached articles index instead of loading file again
  try {
    const { index } = await getArticlesWithIndex()
    const normalizedSlug = slug.toLowerCase()
    
    // Try to find article with content in cache
    let foundArticle = index.get(normalizedSlug)
    
    // If not found by slug, try by ID
    if (!foundArticle && article.id) {
      foundArticle = index.get(article.id.toLowerCase())
    }
    
    // If still not found, search through cached articles
    if (!foundArticle && articlesCache) {
      const found = articlesCache.find((item: any) => 
        item.id === article.id || 
        createSlug(item.title).toLowerCase() === normalizedSlug
      )
      if (found) {
        foundArticle = found
      }
    }
    
    if (foundArticle?.content && 
        typeof foundArticle.content === 'string' && 
        foundArticle.content.trim().length > 100) {
      return { ...article, content: foundArticle.content }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch content from cache:', error)
    }
  }
  
  // PERFORMANCE: Skip Supabase in production (too slow)
  // Only try in development if really needed
  if (process.env.NODE_ENV === 'development') {
    try {
      const contentQuery = supabase
        .from('articles')
        .select('id, content')
        .eq('id', article.id)
        .single()
      
      const queryPromise = contentQuery
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 2000) // Reduced to 2s
      )
      
      const { data, error } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]) as any
      
      if (!error && data?.content && 
          typeof data.content === 'string' && 
          data.content.trim().length > 0) {
        return { ...article, content: data.content }
      }
    } catch (error) {
      // Supabase failed, return article as-is
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to fetch full content from Supabase:', error)
      }
    }
  }
  
  return article
}

/**
 * OPTIMIZED: Gets related articles for an article
 * 
 * @param currentArticle - Current article object
 * @param limit - Maximum number of related articles (default: 6)
 * @returns Array of related articles
 * 
 * Performance:
 * - Uses cached articles (no file read)
 * - Minimal field selection (no content)
 * - Efficient filtering and sorting
 * - Limits results to reduce payload
 * 
 * Strategy:
 * - Prioritizes same category articles
 * - Includes diverse content from other categories
 * - Excludes current article
 */
export async function getRelatedArticles(
  currentArticle: Article,
  limit: number = 6
): Promise<Article[]> {
  try {
    // PERFORMANCE: Use cached articles instead of loading file again
    const { articles: allArticles } = await getArticlesWithIndex()
    
    if (allArticles.length === 0) {
      return []
    }
    
    // Filter out current article, events, and unpublished articles
    const availableArticles = allArticles.filter(
      (article: any) => 
        article.id !== currentArticle.id && 
        article.type !== 'event' &&
        (article.status === 'published' || !article.status)
    )
    
    // Get same category articles (higher priority)
    const sameCategory = availableArticles
      .filter((article: any) => article.category === currentArticle.category)
      .slice(0, 3)
    
    // Get other category articles (diversity)
    const otherCategory = availableArticles
      .filter((article: any) => article.category !== currentArticle.category)
      .slice(0, 3)
    
    // Combine and shuffle for variety
    const related = [...sameCategory, ...otherCategory]
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
    
    // Map to Article format (remove content for performance)
    return related.map((article: any) => ({
      ...article,
      content: undefined // Don't include content for related articles
    })) as Article[]
  } catch (error) {
    // Return empty array on error (non-critical)
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to load related articles:', error)
    }
    return []
  }
}



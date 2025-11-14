/**
 * Script to migrate existing articles to use SEO-friendly slugs
 * Run this script to update all existing articles with proper slugs
 */

const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = 'https://itdmwpbsnviassgqfhxk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZG13cGJzbnZpYXNzZ3FmaHhrIiwicm9sZSI6InNlY3JldF9yb2xlIiwiaWF0IjoxNzUzNDg1OTY1LCJleHAiOjIwNjkwNjE5NjV9.y2BQmRJ5a0JqkFqH62Wl6J7d60fD5h5K8i8L9m9N'

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Generate SEO-friendly slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 100) // Limit length
}

/**
 * Generate unique slug by appending number if needed
 */
async function generateUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug
  let counter = 1
  
  while (true) {
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .neq('id', excludeId || '')
      .limit(1)
    
    if (error) {
      console.error('Error checking slug uniqueness:', error)
      break
    }
    
    if (!data || data.length === 0) {
      break // Slug is unique
    }
    
    slug = `${baseSlug}-${counter}`
    counter++
  }
  
  return slug
}

/**
 * Migrate all articles to use proper slugs
 */
async function migrateArticleSlugs() {
  try {
    console.log('Starting article slug migration...')
    
    // Get all articles without slugs or with ID-based slugs
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, slug')
      .order('created_at', { ascending: true })
    
    if (fetchError) {
      console.error('Error fetching articles:', fetchError)
      return
    }
    
    console.log(`Found ${articles.length} articles to process`)
    
    let updated = 0
    let skipped = 0
    
    for (const article of articles) {
      // Skip if already has a proper slug (not ID-based)
      if (article.slug && !article.slug.startsWith('article-') && !article.slug.includes('it4u5nhfo')) {
        console.log(`Skipping article "${article.title}" - already has proper slug: ${article.slug}`)
        skipped++
        continue
      }
      
      // Generate new slug from title
      const baseSlug = generateSlug(article.title)
      const uniqueSlug = await generateUniqueSlug(baseSlug, article.id)
      
      // Update the article with the new slug
      const { error: updateError } = await supabase
        .from('articles')
        .update({ slug: uniqueSlug })
        .eq('id', article.id)
      
      if (updateError) {
        console.error(`Error updating article "${article.title}":`, updateError)
        continue
      }
      
      console.log(`Updated article "${article.title}" with slug: ${uniqueSlug}`)
      updated++
    }
    
    console.log(`\nMigration complete!`)
    console.log(`- Updated: ${updated} articles`)
    console.log(`- Skipped: ${skipped} articles`)
    console.log(`- Total processed: ${articles.length} articles`)
    
  } catch (error) {
    console.error('Migration failed:', error)
  }
}

// Run the migration
if (require.main === module) {
  migrateArticleSlugs()
}

module.exports = { migrateArticleSlugs, generateSlug, generateUniqueSlug }
